import { z } from 'zod'
import { createTRPCRouter, protectedProcedure } from '@/server/trpc/init'
import { paginate, buildPaginationMeta } from '@/lib/utils'

function appendEvent(current: string | null | undefined, event: object): string {
  const arr = current ? JSON.parse(current) : []
  return JSON.stringify([...arr, { ...event, date: new Date().toISOString() }])
}

export const auditTripsRouter = createTRPCRouter({
  list: protectedProcedure
    .input(z.object({
      page: z.number().default(1),
      pageSize: z.number().default(20),
      collaboratorId: z.string().optional(),
      collaboratorIds: z.array(z.string()).optional(),
      status: z.string().optional(),
      statusIn: z.array(z.string()).optional(),
      search: z.string().optional(),
      startDateFrom: z.date().optional(),
      startDateTo: z.date().optional(),
      createdAtFrom: z.date().optional(),
      createdAtTo: z.date().optional(),
      rejectedOnly: z.boolean().optional(),
      excludeRejected: z.boolean().optional(),
    }))
    .query(async ({ input, ctx }) => {
      const { skip, take } = paginate(input.page, input.pageSize)
      const collabFilter = input.collaboratorIds?.length
        ? { collaboratorId: { in: input.collaboratorIds } }
        : input.collaboratorId
        ? { collaboratorId: input.collaboratorId }
        : {}
      const where: any = {
        deletedAt: null,
        ...collabFilter,
        ...(input.statusIn?.length ? { status: { in: input.statusIn } } : input.status ? { status: input.status } : {}),
        ...(input.search && { OR: [
          { stores: { contains: input.search, mode: 'insensitive' } },
          { reason: { contains: input.search, mode: 'insensitive' } },
          { collaborator: { name: { contains: input.search, mode: 'insensitive' } } },
        ]}),
        ...(input.startDateFrom || input.startDateTo ? { startDate: {
          ...(input.startDateFrom && { gte: input.startDateFrom }),
          ...(input.startDateTo   && { lte: input.startDateTo }),
        }} : {}),
        ...(input.createdAtFrom || input.createdAtTo ? { createdAt: {
          ...(input.createdAtFrom && { gte: input.createdAtFrom }),
          ...(input.createdAtTo   && { lte: input.createdAtTo }),
        }} : {}),
        ...(input.rejectedOnly    ? { rejectedAt: { not: null } } : {}),
        ...(input.excludeRejected ? { rejectedAt: null }          : {}),
      }
      const [trips, total] = await Promise.all([
        ctx.db.auditTrip.findMany({
          where, skip, take, orderBy: { createdAt: 'desc' },
          include: {
            collaborator: { select: { id: true, name: true, role: true } },
            expenses: { where: { deletedAt: null }, select: { value: true, subtype: true } },
          },
        }),
        ctx.db.auditTrip.count({ where }),
      ])
      // separar adiantado (solicitações) de gasto real (gastos) em runtime
      const enriched = trips.map((t: any) => {
        const advancedAmount = t.expenses
          .filter((e: any) => e.subtype !== 'gasto')
          .reduce((s: number, e: any) => s + Number(e.value), 0) || Number(t.advancedAmount ?? 0)
        const spentAmount = t.expenses
          .filter((e: any) => e.subtype === 'gasto')
          .reduce((s: number, e: any) => s + Number(e.value), 0)
        return { ...t, advancedAmount, spentAmount, balance: advancedAmount - spentAmount }
      })
      return { trips: enriched, meta: buildPaginationMeta(total, input.page, input.pageSize) }
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input, ctx }) => {
      const trip = await ctx.db.auditTrip.findUniqueOrThrow({
        where: { id: input.id },
        include: {
          collaborator: true,
          expenses: { where: { deletedAt: null }, orderBy: [{ date: 'desc' }, { createdAt: 'asc' }] },
          formLinks: { where: { deletedAt: null }, include: { response: true } },
        },
      })
      const advancedAmount = trip.expenses
        .filter((e: any) => e.subtype !== 'gasto')
        .reduce((s: number, e: any) => s + Number(e.value), 0) || Number(trip.advancedAmount ?? 0)
      const spentAmount = trip.expenses
        .filter((e: any) => e.subtype === 'gasto')
        .reduce((s: number, e: any) => s + Number(e.value), 0)
      return { ...trip, advancedAmount, spentAmount, balance: advancedAmount - spentAmount }
    }),

  create: protectedProcedure
    .input(z.object({
      collaboratorId: z.string().min(1),
      stores: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      reason: z.string().optional(),
      startDate: z.date(),
      endDate: z.date(),
      releasedAmount: z.number().min(0).default(0),
      advancedAmount: z.number().min(0).default(0),
      observations: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      return ctx.db.auditTrip.create({
        data: { ...input, auditorId: ctx.session.user.id, createdBy: ctx.session.user.id },
      })
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.string(),
      collaboratorId: z.string().optional(),
      stores: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      reason: z.string().optional(),
      startDate: z.date().optional(),
      endDate: z.date().optional(),
      releasedAmount: z.number().min(0).optional(),
      advancedAmount: z.number().min(0).optional(),
      status: z.string().optional(),
      observations: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const { id, ...data } = input
      const extra: any = {}
      const userName = ctx.session.user.name ?? ctx.session.user.email ?? 'Usuário'
      if (data.status === 'SUBMITTED' || data.status === 'CLOSED') {
        const current = await ctx.db.auditTrip.findUnique({
          where: { id },
          select: { timeline: true, submittedAt: true, submittedBy: true, rejectedAt: true, rejectedBy: true, rejectionReason: true, returnedAmount: true, returnProofUrls: true },
        })
        const existing: any[] = current?.timeline ? JSON.parse(current.timeline) : []
        if (data.status === 'SUBMITTED') {
          extra.submittedAt = new Date()
          extra.submittedBy = userName
          const tlEvent: any = { type: 'submitted', user: userName }
          if (current?.returnedAmount && Number(current.returnedAmount) > 0) tlEvent.returnedAmount = Number(current.returnedAmount)
          if (current?.returnProofUrls) { try { tlEvent.returnProofUrls = JSON.parse(current.returnProofUrls) } catch {} }
          extra.timeline = appendEvent(current?.timeline, tlEvent)
        }
        if (data.status === 'CLOSED') {
          // Backfill submitted/rejected events se não estiverem na timeline
          if (current?.submittedAt && !existing.some((e: any) => e.type === 'submitted')) {
            const bf: any = { type: 'submitted', user: current.submittedBy, date: current.submittedAt.toISOString() }
            if (current?.returnedAmount && Number(current.returnedAmount) > 0) bf.returnedAmount = Number(current.returnedAmount)
            if (current?.returnProofUrls) { try { bf.returnProofUrls = JSON.parse(current.returnProofUrls) } catch {} }
            existing.unshift(bf)
          }
          if (current?.rejectedAt && !existing.some((e: any) => e.type === 'rejected')) {
            existing.push({ type: 'rejected', user: current.rejectedBy, date: current.rejectedAt.toISOString(), comment: current.rejectionReason })
          }
          extra.validatedAt = new Date()
          extra.validatedBy = userName
          extra.timeline = appendEvent(JSON.stringify(existing), { type: 'validated', user: userName })
        }
      }
      return ctx.db.auditTrip.update({ where: { id }, data: { ...data, ...extra } })
    }),

  reject: protectedProcedure
    .input(z.object({ id: z.string(), reason: z.string().min(1) }))
    .mutation(async ({ input, ctx }) => {
      const userName = ctx.session.user.name ?? ctx.session.user.email ?? 'Financeiro'
      const current = await ctx.db.auditTrip.findUnique({
        where: { id: input.id },
        select: { timeline: true, submittedAt: true, submittedBy: true, returnedAmount: true, returnProofUrls: true },
      })
      // Backfill submitted event se ainda não estiver na timeline
      const existing: any[] = current?.timeline ? JSON.parse(current.timeline) : []
      if (current?.submittedAt && !existing.some((e: any) => e.type === 'submitted')) {
        const bf: any = { type: 'submitted', user: current.submittedBy, date: current.submittedAt.toISOString() }
        if (current?.returnedAmount && Number(current.returnedAmount) > 0) bf.returnedAmount = Number(current.returnedAmount)
        if (current?.returnProofUrls) { try { bf.returnProofUrls = JSON.parse(current.returnProofUrls) } catch {} }
        existing.unshift(bf)
      }
      const timeline = appendEvent(JSON.stringify(existing), { type: 'rejected', user: userName, comment: input.reason })
      return ctx.db.auditTrip.update({
        where: { id: input.id },
        data: { status: 'OPEN', rejectedAt: new Date(), rejectedBy: userName, rejectionReason: input.reason, timeline },
      })
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      return ctx.db.auditTrip.update({ where: { id: input.id }, data: { deletedAt: new Date() } })
    }),

  updateSettlement: protectedProcedure
    .input(z.object({
      id: z.string(),
      advancedAmount: z.number().min(0).optional(),
      returnedAmount: z.number().min(0).optional(),
      returnProofUrl: z.string().optional(),
      returnProofUrls: z.array(z.string()).optional(),
      returnProofNote: z.string().optional(),
      returnedAt: z.date().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const { id, returnProofUrls, ...data } = input
      const extra: any = {}
      if (returnProofUrls !== undefined) extra.returnProofUrls = JSON.stringify(returnProofUrls)
      return ctx.db.auditTrip.update({ where: { id }, data: { ...data, ...extra } })
    }),

  // Retorna todos os períodos (ano+mês) que têm viagens OU despesas
  listAvailablePeriods: protectedProcedure.query(async ({ ctx }) => {
    const MONTHS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
    const [trips, expenses] = await Promise.all([
      ctx.db.auditTrip.findMany({ where: { deletedAt: null }, select: { startDate: true }, orderBy: { startDate: 'desc' } }),
      ctx.db.auditExpense.findMany({ where: { deletedAt: null }, select: { date: true }, orderBy: { date: 'desc' } }),
    ])
    const seen = new Set<string>()
    const periods: { year: number; month: number; label: string }[] = []
    const allDates = [
      ...trips.map((t: any) => new Date(t.startDate)),
      ...expenses.map((e: any) => new Date(e.date)),
    ].filter((d: Date) => !isNaN(d.getTime())).sort((a: Date, b: Date) => b.getTime() - a.getTime())
    for (const d of allDates) {
      const key = `${d.getFullYear()}-${d.getMonth()}`
      if (!seen.has(key)) {
        seen.add(key)
        periods.push({ year: d.getFullYear(), month: d.getMonth() + 1, label: `${MONTHS[d.getMonth()]}/${d.getFullYear()}` })
      }
    }
    return periods
  }),

  exportCsv: protectedProcedure
    .input(z.object({
      collaboratorId: z.string().optional(),
      startDate: z.date().optional(),
      endDate: z.date().optional(),
    }))
    .query(async ({ input, ctx }) => {
      const where: any = { deletedAt: null }
      if (input.collaboratorId) where.collaboratorId = input.collaboratorId
      if (input.startDate) where.startDate = { gte: input.startDate }
      if (input.endDate) where.endDate = { lte: input.endDate }

      const trips = await ctx.db.auditTrip.findMany({
        where,
        include: {
          collaborator: true,
          expenses: { where: { deletedAt: null } },
        },
        orderBy: { startDate: 'desc' },
      })

      const rows: any[] = []
      for (const t of trips) {
        const spentAmount = t.expenses.reduce((s: number, e: any) => s + Number(e.value), 0)
        for (const e of t.expenses) {
          rows.push({
            colaborador: t.collaborator?.name ?? '',
            cargo: t.collaborator?.role ?? '',
            data: new Date(e.date).toLocaleDateString('pt-BR'),
            loja: e.storeName ?? '',
            cidade_uf: e.cityUf ?? t.city ?? '',
            centro_custo: e.type,
            motivo: e.description ?? '',
            forma_pagamento: e.paymentMethod ?? '',
            valor: Number(e.value).toFixed(2).replace('.', ','),
            viagem_id: t.id.slice(0, 8),
            valor_liberado: Number(t.releasedAmount).toFixed(2).replace('.', ','),
            total_gasto: spentAmount.toFixed(2).replace('.', ','),
            saldo: (t.releasedAmount - spentAmount).toFixed(2).replace('.', ','),
            observacoes: e.observations ?? '',
          })
        }
        if (t.expenses.length === 0) {
          rows.push({
            colaborador: t.collaborator?.name ?? '',
            cargo: t.collaborator?.role ?? '',
            data: '',
            loja: t.stores ?? '',
            cidade_uf: t.city ?? '',
            centro_custo: '',
            motivo: t.reason ?? '',
            forma_pagamento: '',
            valor: '',
            viagem_id: t.id.slice(0, 8),
            valor_liberado: Number(t.releasedAmount).toFixed(2).replace('.', ','),
            total_gasto: '0,00',
            saldo: Number(t.releasedAmount).toFixed(2).replace('.', ','),
            observacoes: t.observations ?? '',
          })
        }
      }
      return { rows }
    }),
})
