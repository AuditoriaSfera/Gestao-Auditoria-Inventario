import { z } from 'zod'
import { createTRPCRouter, protectedProcedure } from '@/server/trpc/init'
import { paginate, buildPaginationMeta } from '@/lib/utils'
type NoteTransitStatus = 'PENDING' | 'IN_TRANSIT' | 'RECEIVED' | 'LATE' | 'CANCELLED' | 'DIVERGENT'

// ----------------------------------------------------------------
// Helpers de importação de planilha
// ----------------------------------------------------------------

/** Normaliza um cabeçalho: minúsculo, sem acento, sem espaços extras. */
function normalizeHeader(h: string): string {
  return String(h)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
}

/** Mapa de aliases de cabeçalho → campo canônico. */
const HEADER_ALIASES: Record<string, string[]> = {
  noteNumber: ['no nota', 'n nota', 'numero nota', 'numero da nota', 'nota', 'nf', 'nfe', 'numero', 'n da nota', 'nº nota'],
  noteType: ['tipo', 'tipo nota', 'tipo da nota'],
  destinationCode: ['loja destino', 'codigo loja', 'cod loja', 'loja', 'codigo', 'destino', 'codigo destino', 'loja (codigo)'],
  issuedAt: ['emissao', 'data emissao', 'data de emissao', 'emitido em', 'dt emissao'],
  expectedAt: ['previsao', 'data previsao', 'previsto', 'previsao entrega', 'dt previsao'],
  totalValue: ['valor', 'valor total', 'total', 'vlr', 'vlr total'],
}

/** Dado um objeto com chaves de cabeçalho cru, retorna campos canônicos. */
function mapRow(raw: Record<string, any>): Record<string, any> {
  const normalized: Record<string, any> = {}
  for (const [k, v] of Object.entries(raw)) {
    normalized[normalizeHeader(k)] = v
  }
  const out: Record<string, any> = {}
  for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
    for (const alias of aliases) {
      if (normalized[alias] !== undefined && normalized[alias] !== null && normalized[alias] !== '') {
        out[field] = normalized[alias]
        break
      }
    }
  }
  return out
}

/** Converte data vinda do Excel (Date, número serial ou string dd/mm/aaaa). */
function parseDate(v: any): Date | null {
  if (v === undefined || v === null || v === '') return null
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v
  if (typeof v === 'number') {
    // serial do Excel (dias desde 1899-12-30)
    const ms = Math.round((v - 25569) * 86400 * 1000)
    const d = new Date(ms)
    return isNaN(d.getTime()) ? null : d
  }
  const s = String(v).trim()
  const br = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/)
  if (br) {
    const [, dd, mm, yyyy] = br
    const year = yyyy.length === 2 ? 2000 + Number(yyyy) : Number(yyyy)
    const d = new Date(year, Number(mm) - 1, Number(dd))
    return isNaN(d.getTime()) ? null : d
  }
  const d = new Date(s)
  return isNaN(d.getTime()) ? null : d
}

/** Torna um valor seguro para colunas Json do Prisma (Date → ISO, objetos do exceljs → texto). */
function toJsonSafe(v: any): any {
  if (v === null || v === undefined) return null
  if (v instanceof Date) return v.toISOString()
  if (Array.isArray(v)) return v.map(toJsonSafe)
  if (typeof v === 'object') {
    if ('result' in v) return toJsonSafe((v as any).result)
    if ('text' in v) return toJsonSafe((v as any).text)
    const out: Record<string, any> = {}
    for (const [k, val] of Object.entries(v)) out[k] = toJsonSafe(val)
    return out
  }
  return v
}

/** Converte valor monetário (aceita formato brasileiro "1.234,56"). */
function parseNumber(v: any): number | null {
  if (v === undefined || v === null || v === '') return null
  if (typeof v === 'number') return v
  let s = String(v).trim().replace(/[R$\s]/g, '')
  if (s.includes(',')) {
    s = s.replace(/\./g, '').replace(',', '.')
  }
  const n = Number(s)
  return isNaN(n) ? null : n
}

export const noteTransitRouter = createTRPCRouter({
  list: protectedProcedure
    .input(
      z.object({
        page: z.number().default(1),
        pageSize: z.number().default(20),
        storeId: z.string().optional(),
        status: z.enum(['PENDING', 'IN_TRANSIT', 'RECEIVED', 'LATE', 'CANCELLED', 'DIVERGENT']).optional(),
        startDate: z.date().optional(),
        endDate: z.date().optional(),
        supplierId: z.string().optional(),
        lateOnly: z.boolean().optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      const { skip, take } = paginate(input.page, input.pageSize)
      const now = new Date()
      const where: any = {
        deletedAt: null,
        ...(input.storeId && { destinationStoreId: input.storeId }),
        ...(input.status && { status: input.status }),
        ...(input.supplierId && { supplierId: input.supplierId }),
        ...(input.startDate && { issuedAt: { gte: input.startDate } }),
        ...(input.endDate && { issuedAt: { lte: input.endDate } }),
        ...(input.lateOnly && {
          expectedAt: { lt: now },
          status: { notIn: ['RECEIVED', 'CANCELLED']  },
        }),
      }

      const [transits, total] = await Promise.all([
        ctx.db.noteTransit.findMany({
          where,
          skip,
          take,
          orderBy: { issuedAt: 'desc' },
          include: {
            destinationStore: { select: { id: true, code: true, name: true } },
            supplier: { select: { id: true, name: true } },
          },
        }),
        ctx.db.noteTransit.count({ where }),
      ])

      return { transits, meta: buildPaginationMeta(total, input.page, input.pageSize) }
    }),

  updateStatus: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        status: z.enum(['PENDING', 'IN_TRANSIT', 'RECEIVED', 'LATE', 'CANCELLED', 'DIVERGENT']),
        receivedAt: z.date().optional(),
        justification: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const transit = await ctx.db.noteTransit.findUniqueOrThrow({ where: { id: input.id } })
      const leadTimeHours =
        input.receivedAt && transit.issuedAt
          ? Math.round((input.receivedAt.getTime() - transit.issuedAt.getTime()) / 3600000)
          : transit.leadTimeHours

      return ctx.db.noteTransit.update({
        where: { id: input.id },
        data: {
          status: input.status,
          receivedAt: input.receivedAt,
          justification: input.justification,
          leadTimeHours,
        },
      })
    }),

  kpiSummary: protectedProcedure
    .input(z.object({ storeId: z.string().optional(), regionId: z.string().optional() }))
    .query(async ({ input, ctx }) => {
      const now = new Date()
      const baseWhere: any = {
        deletedAt: null,
        ...(input.storeId && { destinationStoreId: input.storeId }),
      }

      const [pending, late, received] = await Promise.all([
        ctx.db.noteTransit.count({ where: { ...baseWhere, status: 'PENDING' } }),
        ctx.db.noteTransit.count({
          where: {
            ...baseWhere,
            expectedAt: { lt: now },
            status: { notIn: ['RECEIVED', 'CANCELLED'] },
          },
        }),
        ctx.db.noteTransit.count({ where: { ...baseWhere, status: 'RECEIVED' } }),
      ])

      return { pending, late, received }
    }),

  /**
   * Importa notas em trânsito a partir de linhas de uma planilha.
   * O arquivo é lido no navegador (exceljs) e as linhas chegam aqui já como objetos.
   * Cada linha é validada e, se válida, gravada (upsert) em NoteTransit.
   * Um ImportBatch é criado para registrar o lote no histórico (Central de Importações).
   */
  importRows: protectedProcedure
    .input(
      z.object({
        fileName: z.string(),
        fileSize: z.number().default(0),
        rows: z.array(z.record(z.any())).min(1, 'A planilha não contém linhas.'),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.session.user.id

      // Cache de lojas por código para evitar N queries
      const stores = await ctx.db.store.findMany({ select: { id: true, code: true } })
      const storeByCode = new Map(stores.map((s) => [String(s.code).trim().toUpperCase(), s.id]))

      type RowError = { rowNumber: number; message: string }
      const errors: RowError[] = []
      let valid = 0
      let published = 0

      // Cria o lote (registro de auditoria/histórico)
      const batch = await ctx.db.importBatch.create({
        data: {
          module: 'note-transit',
          fileType: input.fileName.toLowerCase().endsWith('.csv') ? 'csv' : 'xlsx',
          originalName: input.fileName,
          storedPath: '(importação direta)',
          fileHash: `inline-${Date.now()}`,
          fileSize: input.fileSize,
          status: 'VALIDATING',
          totalRows: input.rows.length,
          uploadedById: userId,
        },
      })

      for (let i = 0; i < input.rows.length; i++) {
        const rowNumber = i + 2 // +2: linha 1 é o cabeçalho na planilha
        const mapped = mapRow(input.rows[i])

        const noteNumber = mapped.noteNumber != null ? String(mapped.noteNumber).trim() : ''
        const destinationCode = mapped.destinationCode != null ? String(mapped.destinationCode).trim() : ''
        const issuedAt = parseDate(mapped.issuedAt)
        const expectedAt = parseDate(mapped.expectedAt)
        const totalValue = parseNumber(mapped.totalValue)
        const noteType = mapped.noteType != null && String(mapped.noteType).trim() !== '' ? String(mapped.noteType).trim() : 'NF-e'

        // Validações
        const rowErrors: string[] = []
        if (!noteNumber) rowErrors.push('Nº da nota ausente')
        if (!destinationCode) rowErrors.push('Código da loja destino ausente')
        const storeId = storeByCode.get(destinationCode.toUpperCase())
        if (destinationCode && !storeId) rowErrors.push(`Loja destino não encontrada: ${destinationCode}`)
        if (!issuedAt) rowErrors.push('Data de emissão inválida ou ausente')

        if (rowErrors.length > 0 || !storeId || !issuedAt) {
          errors.push({ rowNumber, message: rowErrors.join('; ') })
          await ctx.db.importBatchItem.create({
            data: {
              batchId: batch.id,
              rowNumber,
              rawData: toJsonSafe(input.rows[i]),
              isValid: false,
              errors: rowErrors.join('; '),
            },
          })
          continue
        }

        valid++

        try {
          const record = await ctx.db.noteTransit.upsert({
            where: { noteNumber_destinationStoreId: { noteNumber, destinationStoreId: storeId } },
            update: {
              noteType,
              issuedAt,
              expectedAt: expectedAt ?? undefined,
              totalValue: totalValue ?? undefined,
            },
            create: {
              noteNumber,
              noteType,
              destinationStoreId: storeId,
              issuedAt,
              expectedAt: expectedAt ?? undefined,
              totalValue: totalValue ?? undefined,
              status: 'PENDING',
              importBatchId: batch.id,
              createdBy: userId,
            },
          })
          published++
          await ctx.db.importBatchItem.create({
            data: {
              batchId: batch.id,
              rowNumber,
              rawData: toJsonSafe(input.rows[i]),
              parsedData: toJsonSafe({ noteNumber, noteType, destinationCode, issuedAt, expectedAt, totalValue }),
              isValid: true,
              isPublished: true,
              publishedAt: new Date(),
              recordId: record.id,
              businessKey: `${noteNumber}|${storeId}`,
            },
          })
        } catch (e) {
          const msg = e instanceof Error ? e.message : 'Erro ao gravar'
          errors.push({ rowNumber, message: msg })
        }
      }

      const finalStatus = errors.length === 0 ? 'PUBLISHED' : published > 0 ? 'PARTIALLY_PUBLISHED' : 'FAILED'

      await ctx.db.importBatch.update({
        where: { id: batch.id },
        data: {
          status: finalStatus,
          validRows: valid,
          invalidRows: input.rows.length - valid,
          publishedRows: published,
          publishedAt: published > 0 ? new Date() : undefined,
          errorSummary: errors.length > 0 ? `${errors.length} linha(s) com erro` : undefined,
        },
      })

      if (errors.length > 0) {
        await ctx.db.importError.createMany({
          data: errors.map((e) => ({
            batchId: batch.id,
            rowNumber: e.rowNumber,
            errorCode: 'IMPORT_ERROR',
            message: e.message,
          })),
        })
      }

      return {
        batchId: batch.id,
        total: input.rows.length,
        published,
        invalid: input.rows.length - valid,
        errors: errors.slice(0, 50),
        status: finalStatus,
      }
    }),
})
