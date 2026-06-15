import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { createTRPCRouter, protectedProcedure } from '@/server/trpc/init'
import { paginate, buildPaginationMeta } from '@/lib/utils'
import { hasPermission, hasStoreAccess, type Session } from '@/modules/core/auth/session'
import { classifyLine, deriveNature, parseQuantity, type ClassificationRule } from './classification'
import { CDE_CATEGORIES, CDE_OFFICIAL_CATEGORIES, CDE_SLA_DEADLINE_HOURS, CDE_SLA_WARNING_HOURS } from './constants'

// ----------------------------------------------------------------
// Permissões e escopo (Auditor / Administrador / Gerente de loja)
// ----------------------------------------------------------------

/** Lojas acessíveis: null = todas (admin/auditor/scopeAll); array = restrito. */
function scopeStoreIds(session: Session): string[] | null {
  const { roles, storeScopes } = session.user
  if (roles.includes('platform-admin') || roles.includes('audit-corporate')) return null
  if (storeScopes.some((s) => s.scopeAll)) return null
  return storeScopes.map((s) => s.storeId).filter((x): x is string => Boolean(x))
}

function isAdmin(session: Session): boolean {
  return session.user.roles.includes('platform-admin') || hasPermission(session, 'cde', 'edit-params')
}

function canImport(session: Session): boolean {
  const { roles } = session.user
  return roles.includes('platform-admin') || roles.includes('audit-corporate') || hasPermission(session, 'cde', 'import')
}

function canValidateStore(session: Session, storeId: string): boolean {
  const { roles } = session.user
  if (roles.includes('platform-admin') || roles.includes('audit-corporate')) return true
  return hasStoreAccess(session, storeId)
}

/** Cláusula de escopo para incluir no `where` do Prisma. */
function scopeWhere(session: Session): Record<string, unknown> {
  const ids = scopeStoreIds(session)
  if (ids === null) return {}
  return { storeId: { in: ids.length > 0 ? ids : ['__none__'] } }
}

const CATEGORY_VALUES = [...CDE_OFFICIAL_CATEGORIES, 'PENDENTE_PARAM'] as const

// ----------------------------------------------------------------
// Router
// ----------------------------------------------------------------

export const cdeRouter = createTRPCRouter({
  /** Lojas acessíveis ao usuário (para filtros das telas). */
  accessibleStores: protectedProcedure.query(async ({ ctx }) => {
    const ids = scopeStoreIds(ctx.session)
    return ctx.db.store.findMany({
      where: { deletedAt: null, status: 'ACTIVE', ...(ids !== null && { id: { in: ids } }) },
      select: { id: true, code: true, name: true },
      orderBy: { name: 'asc' },
    })
  }),

  /** Indica as capacidades do usuário atual no módulo. */
  myCapabilities: protectedProcedure.query(({ ctx }) => ({
    isAdmin: isAdmin(ctx.session),
    canImport: canImport(ctx.session),
    canReclassify: isAdmin(ctx.session),
    scopeAll: scopeStoreIds(ctx.session) === null,
  })),

  // ----------------------------------------------------------------
  // PAINEL / DASHBOARD
  // ----------------------------------------------------------------
  dashboard: protectedProcedure
    .input(
      z.object({
        startDate: z.date(),
        endDate: z.date(),
        storeId: z.string().optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      const where: any = {
        deletedAt: null,
        date: { gte: input.startDate, lte: input.endDate },
        ...(input.storeId && { storeId: input.storeId }),
        ...scopeWhere(ctx.session),
      }

      const lines = await ctx.db.cdeLine.findMany({
        where,
        select: {
          storeId: true,
          status: true,
          category: true,
          nature: true,
          date: true,
          createdAt: true,
          validatedAt: true,
          store: { select: { code: true, name: true } },
        },
      })

      const total = lines.length
      const count = (s: string) => lines.filter((l) => l.status === s).length
      const volume = {
        total,
        pending: count('PENDING_VALIDATION'),
        correct: count('CORRECT'),
        incorrect: count('INCORRECT'),
        regularized: count('REGULARIZED'),
        pendingParam: count('PENDING_PARAM'),
      }

      // ---- SLA por loja (importação → 24h) ----
      const now = Date.now()
      const byStore = new Map<string, typeof lines>()
      for (const l of lines) {
        const arr = byStore.get(l.storeId) ?? []
        arr.push(l)
        byStore.set(l.storeId, arr)
      }

      const storesSla = Array.from(byStore.entries()).map(([storeId, sLines]) => {
        const store = sLines[0].store
        const importedAt = Math.min(...sLines.map((l) => new Date(l.createdAt).getTime()))
        const deadline = importedAt + CDE_SLA_DEADLINE_HOURS * 3600000
        const pendingCount = sLines.filter(
          (l) => l.status === 'PENDING_VALIDATION' || l.status === 'PENDING_PARAM'
        ).length
        const validatedCount = sLines.length - pendingCount
        const done = pendingCount === 0
        const validatedTimes = sLines
          .filter((l) => l.validatedAt)
          .map((l) => new Date(l.validatedAt as Date).getTime())
        const lastValidatedAt = validatedTimes.length ? Math.max(...validatedTimes) : null
        const msLeft = deadline - now

        let state: 'GREEN' | 'YELLOW' | 'RED' = 'YELLOW'
        if (done) state = 'GREEN'
        else if (msLeft < 0) state = 'RED'
        else if (msLeft <= CDE_SLA_WARNING_HOURS * 3600000) state = 'YELLOW'
        else state = 'YELLOW' // ainda no prazo (distinção via hoursLeft)

        const withinDeadline = done && lastValidatedAt !== null && lastValidatedAt <= deadline
        const validationHours =
          done && lastValidatedAt !== null ? (lastValidatedAt - importedAt) / 3600000 : null

        return {
          storeId,
          storeCode: store?.code ?? '',
          storeName: store?.name ?? '',
          total: sLines.length,
          validatedCount,
          pendingCount,
          done,
          overdue: !done && msLeft < 0,
          stillInTime: !done && msLeft >= 0,
          nearDeadline: !done && msLeft >= 0 && msLeft <= CDE_SLA_WARNING_HOURS * 3600000,
          withinDeadline,
          hoursLeft: msLeft / 3600000,
          validationHours,
          importedAt: new Date(importedAt),
          deadline: new Date(deadline),
          state,
          progress: sLines.length ? Math.round((validatedCount / sLines.length) * 100) : 0,
        }
      })

      const slaSummary = {
        validatedWithinDeadline: storesSla.filter((s) => s.withinDeadline).length,
        stillInTime: storesSla.filter((s) => s.stillInTime && !s.nearDeadline).length,
        nearDeadline: storesSla.filter((s) => s.nearDeadline).length,
        overdue: storesSla.filter((s) => s.overdue).length,
        done: storesSla.filter((s) => s.done).length,
        avgValidationHours: (() => {
          const vals = storesSla.map((s) => s.validationHours).filter((x): x is number => x !== null)
          return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null
        })(),
      }

      // ---- Qualidade ----
      const incorrectLines = lines.filter((l) => l.status === 'INCORRECT')
      const incorrectByStoreMap = new Map<string, { name: string; code: string; count: number }>()
      for (const l of incorrectLines) {
        const cur = incorrectByStoreMap.get(l.storeId) ?? {
          name: l.store?.name ?? '',
          code: l.store?.code ?? '',
          count: 0,
        }
        cur.count++
        incorrectByStoreMap.set(l.storeId, cur)
      }
      const incorrectByStore = Array.from(incorrectByStoreMap.entries())
        .map(([storeId, v]) => ({ storeId, ...v }))
        .sort((a, b) => b.count - a.count)

      const incorrectByCategoryMap = new Map<string, number>()
      for (const l of incorrectLines) {
        incorrectByCategoryMap.set(l.category, (incorrectByCategoryMap.get(l.category) ?? 0) + 1)
      }
      const incorrectByCategory = Array.from(incorrectByCategoryMap.entries())
        .map(([category, countv]) => ({ category, count: countv }))
        .sort((a, b) => b.count - a.count)

      // Evolução diária correto x incorreto
      const dailyMap = new Map<string, { correct: number; incorrect: number }>()
      for (const l of lines) {
        const key = new Date(l.date).toISOString().slice(0, 10)
        const cur = dailyMap.get(key) ?? { correct: 0, incorrect: 0 }
        if (l.status === 'CORRECT') cur.correct++
        if (l.status === 'INCORRECT') cur.incorrect++
        dailyMap.set(key, cur)
      }
      const dailyEvolution = Array.from(dailyMap.entries())
        .map(([date, v]) => ({ date, ...v }))
        .sort((a, b) => a.date.localeCompare(b.date))

      return {
        volume,
        slaSummary,
        storesSla: storesSla.sort((a, b) => b.progress - a.progress),
        quality: {
          incorrectByStore,
          incorrectByCategory,
          topDivergenceStore: incorrectByStore[0] ?? null,
          topIncorrectCategory: incorrectByCategory[0] ?? null,
          dailyEvolution,
        },
      }
    }),

  /**
   * Resumo compacto de KPIs (consumido pelo dashboard executivo da plataforma).
   * Mantido com assinatura retrocompatível, mapeado ao novo modelo de linhas.
   */
  kpiSummary: protectedProcedure
    .input(
      z.object({
        startDate: z.date(),
        endDate: z.date(),
        regionId: z.string().optional(),
        storeId: z.string().optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      const where: any = {
        deletedAt: null,
        date: { gte: input.startDate, lte: input.endDate },
        ...(input.storeId && { storeId: input.storeId }),
        ...scopeWhere(ctx.session),
      }
      const lines = await ctx.db.cdeLine.findMany({ where, select: { status: true } })
      const total = lines.length
      const accepted = lines.filter((l) => l.status === 'CORRECT').length
      const contested = lines.filter((l) => l.status === 'INCORRECT').length
      const noResponse = lines.filter(
        (l) => l.status === 'PENDING_VALIDATION' || l.status === 'PENDING_PARAM'
      ).length
      return {
        total,
        accepted,
        contested,
        noResponse,
        acceptRate: total > 0 ? (accepted / total) * 100 : 0,
        contestRate: total > 0 ? (contested / total) * 100 : 0,
        noResponseRate: total > 0 ? (noResponse / total) * 100 : 0,
      }
    }),

  // ----------------------------------------------------------------
  // VALIDAÇÃO — listagem de linhas
  // ----------------------------------------------------------------
  listLines: protectedProcedure
    .input(
      z.object({
        page: z.number().default(1),
        pageSize: z.number().default(50),
        storeId: z.string().optional(),
        status: z.string().optional(),
        category: z.enum(CATEGORY_VALUES).optional(),
        documento: z.string().optional(),
        startDate: z.date().optional(),
        endDate: z.date().optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      const { skip, take } = paginate(input.page, input.pageSize)
      const where: any = {
        deletedAt: null,
        ...(input.storeId && { storeId: input.storeId }),
        ...(input.status && { status: input.status }),
        ...(input.category && { category: input.category }),
        ...(input.documento && { documento: { contains: input.documento, mode: 'insensitive' } }),
        ...(input.startDate && { date: { gte: input.startDate } }),
        ...(input.endDate && { date: { lte: input.endDate } }),
        ...scopeWhere(ctx.session),
      }

      const [lines, total] = await Promise.all([
        ctx.db.cdeLine.findMany({
          where,
          skip,
          take,
          orderBy: [{ date: 'desc' }, { documento: 'asc' }],
          include: { store: { select: { id: true, code: true, name: true } } },
        }),
        ctx.db.cdeLine.count({ where }),
      ])
      return { lines, meta: buildPaginationMeta(total, input.page, input.pageSize) }
    }),

  /** Linhas agrupadas por Documento (unidade de validação). */
  listDocuments: protectedProcedure
    .input(
      z.object({
        page: z.number().default(1),
        pageSize: z.number().default(20),
        storeId: z.string().optional(),
        status: z.string().optional(),
        startDate: z.date().optional(),
        endDate: z.date().optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      const where: any = {
        deletedAt: null,
        ...(input.storeId && { storeId: input.storeId }),
        ...(input.status && { status: input.status }),
        ...(input.startDate && { date: { gte: input.startDate } }),
        ...(input.endDate && { date: { lte: input.endDate } }),
        ...scopeWhere(ctx.session),
      }

      const lines = await ctx.db.cdeLine.findMany({
        where,
        orderBy: [{ date: 'desc' }, { documento: 'asc' }],
        include: { store: { select: { id: true, code: true, name: true } } },
      })

      // Agrupa por documento + loja + data
      const groups = new Map<string, typeof lines>()
      for (const l of lines) {
        const key = `${l.documento}|${l.storeId}|${new Date(l.date).toISOString().slice(0, 10)}`
        const arr = groups.get(key) ?? []
        arr.push(l)
        groups.set(key, arr)
      }

      const allDocs = Array.from(groups.entries()).map(([key, gLines]) => {
        const statuses = new Set(gLines.map((l) => l.status))
        let groupStatus = 'MIXED'
        if (statuses.size === 1) groupStatus = gLines[0].status
        else if (gLines.some((l) => l.status === 'PENDING_PARAM')) groupStatus = 'PENDING_PARAM'
        else if (gLines.some((l) => l.status === 'PENDING_VALIDATION')) groupStatus = 'PENDING_VALIDATION'
        return {
          key,
          documento: gLines[0].documento,
          store: gLines[0].store,
          date: gLines[0].date,
          lineCount: gLines.length,
          groupStatus,
          hasPendingParam: gLines.some((l) => l.status === 'PENDING_PARAM'),
          totalQtd: gLines.reduce((s, l) => s + Number(l.qtdMovimento), 0),
          lines: gLines,
        }
      })

      const total = allDocs.length
      const start = (input.page - 1) * input.pageSize
      const documents = allDocs.slice(start, start + input.pageSize)
      return { documents, meta: buildPaginationMeta(total, input.page, input.pageSize) }
    }),

  // ----------------------------------------------------------------
  // VALIDAÇÃO — ações
  // ----------------------------------------------------------------
  validateLine: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        action: z.enum(['CORRECT', 'INCORRECT', 'FORWARDED_AUDIT']),
        reason: z.string().optional(),
        attachmentRef: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const line = await ctx.db.cdeLine.findUniqueOrThrow({ where: { id: input.id } })
      if (!canValidateStore(ctx.session, line.storeId)) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Sem permissão para validar esta loja.' })
      }
      if (line.status === 'PENDING_PARAM') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Movimentação pendente de parametrização. Aguarde a classificação pelo administrador.',
        })
      }
      validateActionFields(input.action, input.reason, input.attachmentRef)

      const updated = await applyValidation(ctx.db, line.id, ctx.session.user.id, input.action, input.reason, input.attachmentRef)
      await logActivity(ctx.db, line.id, ctx.session.user.id, `Validação: ${input.action}`, { from: line.status, to: updated.status })
      return updated
    }),

  validateDocument: protectedProcedure
    .input(
      z.object({
        documento: z.string(),
        storeId: z.string(),
        date: z.date(),
        action: z.enum(['CORRECT', 'INCORRECT', 'FORWARDED_AUDIT']),
        reason: z.string().optional(),
        attachmentRef: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      if (!canValidateStore(ctx.session, input.storeId)) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Sem permissão para validar esta loja.' })
      }
      validateActionFields(input.action, input.reason, input.attachmentRef)

      const dayStart = new Date(input.date); dayStart.setHours(0, 0, 0, 0)
      const dayEnd = new Date(input.date); dayEnd.setHours(23, 59, 59, 999)

      // PENDENTE_PARAM ficam bloqueadas e não são validadas em bloco.
      const lines = await ctx.db.cdeLine.findMany({
        where: {
          deletedAt: null,
          documento: input.documento,
          storeId: input.storeId,
          date: { gte: dayStart, lte: dayEnd },
          status: { not: 'PENDING_PARAM' },
        },
        select: { id: true },
      })
      if (lines.length === 0) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Nenhuma linha validável neste documento (verifique itens pendentes de parametrização).' })
      }

      for (const l of lines) {
        const updated = await applyValidation(ctx.db, l.id, ctx.session.user.id, input.action, input.reason, input.attachmentRef)
        await logActivity(ctx.db, l.id, ctx.session.user.id, `Validação em bloco (documento): ${input.action}`, { to: updated.status })
      }
      return { validated: lines.length }
    }),

  /** Regulariza uma linha incorreta (tratativa registrada). */
  regularizeLine: protectedProcedure
    .input(z.object({ id: z.string(), note: z.string().min(3, 'Descreva a tratativa.') }))
    .mutation(async ({ input, ctx }) => {
      const line = await ctx.db.cdeLine.findUniqueOrThrow({ where: { id: input.id } })
      if (!canValidateStore(ctx.session, line.storeId)) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Sem permissão para esta loja.' })
      }
      if (line.status !== 'INCORRECT') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Apenas itens incorretos podem ser regularizados.' })
      }
      const updated = await ctx.db.cdeLine.update({
        where: { id: line.id },
        data: {
          status: 'REGULARIZED',
          regularizationNote: input.note,
          regularizedAt: new Date(),
          regularizedById: ctx.session.user.id,
          updatedBy: ctx.session.user.id,
        },
      })
      await logActivity(ctx.db, line.id, ctx.session.user.id, 'Regularização', { to: 'REGULARIZED' })
      return updated
    }),

  // ----------------------------------------------------------------
  // RECLASSIFICAÇÃO (somente Administrador)
  // ----------------------------------------------------------------
  reclassifyLine: protectedProcedure
    .input(z.object({ id: z.string(), category: z.enum(CDE_OFFICIAL_CATEGORIES) }))
    .mutation(async ({ input, ctx }) => {
      if (!isAdmin(ctx.session)) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Somente o administrador pode reclassificar.' })
      }
      const line = await ctx.db.cdeLine.findUniqueOrThrow({ where: { id: input.id } })
      const newStatus = line.status === 'PENDING_PARAM' ? 'PENDING_VALIDATION' : line.status
      const updated = await ctx.db.cdeLine.update({
        where: { id: input.id },
        data: {
          category: input.category,
          categoryManual: true,
          categoryRuleId: null,
          status: newStatus,
          updatedBy: ctx.session.user.id,
        },
      })
      await logActivity(ctx.db, line.id, ctx.session.user.id, 'Reclassificação manual', {
        from: line.category,
        to: input.category,
      })
      return updated
    }),

  // ----------------------------------------------------------------
  // PARAMETRIZAÇÃO — regras de classificação
  // ----------------------------------------------------------------
  rulesList: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.cdeClassificationRule.findMany({
      where: { deletedAt: null },
      orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
    })
  }),

  ruleCreate: protectedProcedure
    .input(
      z.object({
        priority: z.number().default(100),
        field: z.enum(['movimentacao', 'movimento', 'descricao', 'lancamento']).default('movimentacao'),
        matchType: z.enum(['EQUALS', 'CONTAINS', 'STARTS_WITH', 'REGEX']).default('CONTAINS'),
        pattern: z.string().min(1),
        natureFilter: z.enum(['ENTRADA', 'SAIDA', 'NEUTRA']).optional(),
        category: z.enum(CDE_OFFICIAL_CATEGORIES),
        description: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      if (!isAdmin(ctx.session)) throw new TRPCError({ code: 'FORBIDDEN' })
      return ctx.db.cdeClassificationRule.create({
        data: { ...input, createdBy: ctx.session.user.id },
      })
    }),

  ruleUpdate: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        priority: z.number().optional(),
        field: z.enum(['movimentacao', 'movimento', 'descricao', 'lancamento']).optional(),
        matchType: z.enum(['EQUALS', 'CONTAINS', 'STARTS_WITH', 'REGEX']).optional(),
        pattern: z.string().min(1).optional(),
        natureFilter: z.enum(['ENTRADA', 'SAIDA', 'NEUTRA']).nullable().optional(),
        category: z.enum(CDE_OFFICIAL_CATEGORIES).optional(),
        isActive: z.boolean().optional(),
        description: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      if (!isAdmin(ctx.session)) throw new TRPCError({ code: 'FORBIDDEN' })
      const { id, ...data } = input
      return ctx.db.cdeClassificationRule.update({
        where: { id },
        data: { ...data, updatedBy: ctx.session.user.id },
      })
    }),

  ruleDelete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      if (!isAdmin(ctx.session)) throw new TRPCError({ code: 'FORBIDDEN' })
      return ctx.db.cdeClassificationRule.update({
        where: { id: input.id },
        data: { deletedAt: new Date(), isActive: false },
      })
    }),

  /** Reaplica as regras às linhas pendentes de parametrização. */
  applyRulesToPending: protectedProcedure.mutation(async ({ ctx }) => {
    if (!isAdmin(ctx.session)) throw new TRPCError({ code: 'FORBIDDEN' })
    const rules = await loadRules(ctx.db)
    const pending = await ctx.db.cdeLine.findMany({
      where: { deletedAt: null, status: 'PENDING_PARAM', categoryManual: false },
    })
    let reclassified = 0
    for (const l of pending) {
      const { category, ruleId } = classifyLine(
        {
          movimentacao: l.movimentacao,
          movimento: l.movimento,
          descricao: l.descricao,
          lancamento: l.lancamento,
          nature: l.nature as any,
        },
        rules
      )
      if (category !== CDE_CATEGORIES.PENDENTE_PARAM) {
        await ctx.db.cdeLine.update({
          where: { id: l.id },
          data: { category, categoryRuleId: ruleId, status: 'PENDING_VALIDATION' },
        })
        reclassified++
      }
    }
    return { reclassified, remaining: pending.length - reclassified }
  }),

  // ----------------------------------------------------------------
  // IMPORTAÇÃO — confirmação/persistência
  // ----------------------------------------------------------------
  importCommit: protectedProcedure
    .input(
      z.object({
        fileName: z.string(),
        fileSize: z.number().default(0),
        fileHash: z.string(),
        referenceDate: z.date().optional(),
        force: z.boolean().default(false),
        rows: z
          .array(
            z.object({
              loja: z.string().nullable().optional(),
              movimentacao: z.string().nullable().optional(),
              local: z.string().nullable().optional(),
              lancamento: z.string().nullable().optional(),
              movimento: z.string().nullable().optional(),
              cod: z.string().nullable().optional(),
              descricao: z.string().nullable().optional(),
              documento: z.string(),
              complemento: z.string().nullable().optional(),
              saldoAnterior: z.number().nullable().optional(),
              qtdMovimento: z.union([z.number(), z.string()]),
              saldoAtual: z.number().nullable().optional(),
            })
          )
          .min(1, 'A planilha não contém linhas.'),
      })
    )
    .mutation(async ({ input, ctx }) => {
      if (!canImport(ctx.session)) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Sem permissão para importar.' })
      }

      // Checagem de duplicidade pelo hash do arquivo.
      const existing = await ctx.db.importBatch.findFirst({
        where: { module: 'cde', fileHash: input.fileHash, status: { in: ['PUBLISHED', 'PARTIALLY_PUBLISHED'] } },
      })
      if (existing && !input.force) {
        return {
          duplicate: true,
          existingBatchId: existing.id,
          message: 'Este arquivo já foi importado anteriormente.',
        }
      }

      const referenceDate = input.referenceDate ?? startOfToday()
      const userId = ctx.session.user.id

      const stores = await ctx.db.store.findMany({ select: { id: true, code: true } })
      const storeByCode = new Map(stores.map((s) => [String(s.code).trim().toUpperCase(), s.id]))
      const rules = await loadRules(ctx.db)

      const batch = await ctx.db.importBatch.create({
        data: {
          module: 'cde',
          fileType: input.fileName.toLowerCase().endsWith('.csv') ? 'csv' : 'xlsx',
          originalName: input.fileName,
          storedPath: '(importação direta)',
          fileHash: input.fileHash,
          fileSize: input.fileSize,
          status: 'VALIDATING',
          totalRows: input.rows.length,
          uploadedById: userId,
        },
      })

      type RowError = { rowNumber: number; message: string }
      const errors: RowError[] = []
      let published = 0
      let pendingParam = 0
      const data: any[] = []

      for (let i = 0; i < input.rows.length; i++) {
        const r = input.rows[i]
        const rowNumber = i + 2
        const documento = String(r.documento ?? '').trim()
        if (!documento) { errors.push({ rowNumber, message: 'Documento ausente' }); continue }

        const lojaCode = r.loja ? String(r.loja).trim().toUpperCase() : ''
        const storeId = storeByCode.get(lojaCode)
        if (!storeId) {
          errors.push({ rowNumber, message: `Loja não encontrada: ${r.loja ?? '(vazio)'}` })
          continue
        }

        const qtd = parseQuantity(r.qtdMovimento)
        const nature = deriveNature(qtd)
        const { category, ruleId } = classifyLine(
          {
            movimentacao: r.movimentacao,
            movimento: r.movimento,
            descricao: r.descricao,
            lancamento: r.lancamento,
            nature,
          },
          rules
        )
        const status = category === CDE_CATEGORIES.PENDENTE_PARAM ? 'PENDING_PARAM' : 'PENDING_VALIDATION'
        if (status === 'PENDING_PARAM') pendingParam++

        data.push({
          importBatchId: batch.id,
          storeId,
          date: referenceDate,
          loja: r.loja ?? null,
          movimentacao: r.movimentacao ?? null,
          local: r.local ?? null,
          lancamento: r.lancamento ?? null,
          movimento: r.movimento ?? null,
          cod: r.cod ?? null,
          descricao: r.descricao ?? null,
          documento,
          complemento: r.complemento ?? null,
          saldoAnterior: r.saldoAnterior ?? null,
          qtdMovimento: qtd ?? 0,
          saldoAtual: r.saldoAtual ?? null,
          nature,
          category,
          categoryRuleId: ruleId,
          status,
          createdBy: userId,
        })
        published++
      }

      if (data.length > 0) {
        await ctx.db.cdeLine.createMany({ data })
      }

      const finalStatus = errors.length === 0 ? 'PUBLISHED' : published > 0 ? 'PARTIALLY_PUBLISHED' : 'FAILED'
      await ctx.db.importBatch.update({
        where: { id: batch.id },
        data: {
          status: finalStatus,
          validRows: published,
          invalidRows: input.rows.length - published,
          publishedRows: published,
          publishedAt: published > 0 ? new Date() : null,
          errorSummary: errors.length > 0 ? `${errors.length} linha(s) com erro` : null,
        },
      })
      if (errors.length > 0) {
        await ctx.db.importError.createMany({
          data: errors.map((e) => ({ batchId: batch.id, rowNumber: e.rowNumber, errorCode: 'IMPORT_ERROR', message: e.message })),
        })
      }

      return {
        duplicate: false,
        batchId: batch.id,
        total: input.rows.length,
        published,
        invalid: input.rows.length - published,
        pendingParam,
        errors: errors.slice(0, 50),
        status: finalStatus,
      }
    }),

  // ----------------------------------------------------------------
  // HISTÓRICO
  // ----------------------------------------------------------------
  importHistory: protectedProcedure
    .input(z.object({ page: z.number().default(1), pageSize: z.number().default(20) }))
    .query(async ({ input, ctx }) => {
      const { skip, take } = paginate(input.page, input.pageSize)
      const where = { module: 'cde' }
      const [batches, total] = await Promise.all([
        ctx.db.importBatch.findMany({
          where,
          skip,
          take,
          orderBy: { createdAt: 'desc' },
          include: { uploadedBy: { select: { name: true } } },
        }),
        ctx.db.importBatch.count({ where }),
      ])
      return { batches, meta: buildPaginationMeta(total, input.page, input.pageSize) }
    }),

  lineHistory: protectedProcedure
    .input(z.object({ lineId: z.string() }))
    .query(async ({ input, ctx }) => {
      return ctx.db.activityHistory.findMany({
        where: { module: 'cde', recordId: input.lineId },
        orderBy: { createdAt: 'desc' },
        include: { actor: { select: { name: true } } },
      })
    }),
})

// ----------------------------------------------------------------
// Helpers internos
// ----------------------------------------------------------------

function startOfToday(): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

function validateActionFields(action: string, reason?: string, attachmentRef?: string) {
  if (action === 'INCORRECT' && (!reason || reason.trim().length < 3)) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'Justificativa obrigatória ao marcar como Incorreto.' })
  }
  if (action === 'FORWARDED_AUDIT') {
    if (!reason || reason.trim().length < 3) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'Justificativa obrigatória ao encaminhar para auditoria.' })
    }
    if (!attachmentRef || attachmentRef.trim().length === 0) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'Anexo/evidência obrigatório ao encaminhar para auditoria.' })
    }
  }
}

async function applyValidation(
  db: any,
  id: string,
  userId: string,
  action: 'CORRECT' | 'INCORRECT' | 'FORWARDED_AUDIT',
  reason?: string,
  attachmentRef?: string
) {
  const status = action === 'CORRECT' ? 'CORRECT' : 'INCORRECT'
  return db.cdeLine.update({
    where: { id },
    data: {
      status,
      validationAction: action,
      validationReason: reason ?? null,
      attachmentRef: attachmentRef ?? null,
      forwardedToAudit: action === 'FORWARDED_AUDIT',
      validatedAt: new Date(),
      validatedById: userId,
      updatedBy: userId,
    },
  })
}

async function loadRules(db: any): Promise<ClassificationRule[]> {
  const rows = await db.cdeClassificationRule.findMany({ where: { deletedAt: null, isActive: true } })
  return rows.map((r: any) => ({
    id: r.id,
    priority: r.priority,
    field: r.field,
    matchType: r.matchType,
    pattern: r.pattern,
    natureFilter: r.natureFilter,
    category: r.category,
    isActive: r.isActive,
  }))
}

async function logActivity(db: any, recordId: string, actorId: string, description: string, meta?: Record<string, unknown>) {
  try {
    await db.activityHistory.create({
      data: {
        module: 'cde',
        recordId,
        action: 'STATUS_CHANGED',
        description,
        metadata: meta ? (meta as any) : undefined,
        actorId,
      },
    })
  } catch {
    // histórico é best-effort; não bloqueia a operação principal
  }
}
