import { z } from 'zod'
import { createTRPCRouter, protectedProcedure } from '@/server/trpc/init'
import { paginate, buildPaginationMeta } from '@/lib/utils'

export const auditTripsRouter = createTRPCRouter({
  list: protectedProcedure
    .input(z.object({
      page: z.number().default(1),
      pageSize: z.number().default(20),
      collaboratorId: z.string().optional(),
      status: z.string().optional(),
    }))
    .query(async ({ input, ctx }) => {
      const { skip, take } = paginate(input.page, input.pageSize)
      const where: any = {
        deletedAt: null,
        ...(input.collaboratorId && { collaboratorId: input.collaboratorId }),
        ...(input.status && { status: input.status }),
      }
      const [trips, total] = await Promise.all([
        ctx.db.auditTrip.findMany({
          where, skip, take, orderBy: { startDate: 'desc' },
          include: {
            collaborator: { select: { id: true, name: true, role: true } },
            expenses: { where: { deletedAt: null }, select: { value: true } },
          },
        }),
        ctx.db.auditTrip.count({ where }),
      ])
      // calcular total gasto e saldo em runtime
      const enriched = trips.map((t: any) => ({
        ...t,
        spentAmount: t.expenses.reduce((s: number, e: any) => s + Number(e.value), 0),
        balance: t.releasedAmount - t.expenses.reduce((s: number, e: any) => s + Number(e.value), 0),
      }))
      return { trips: enriched, meta: buildPaginationMeta(total, input.page, input.pageSize) }
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input, ctx }) => {
      const trip = await ctx.db.auditTrip.findUniqueOrThrow({
        where: { id: input.id },
        include: {
          collaborator: true,
          expenses: { where: { deletedAt: null }, orderBy: { date: 'desc' } },
          formLinks: { where: { deletedAt: null }, include: { response: true } },
        },
      })
      const spentAmount = trip.expenses.reduce((s: number, e: any) => s + Number(e.value), 0)
      return { ...trip, spentAmount, balance: trip.releasedAmount - spentAmount }
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
      return ctx.db.auditTrip.update({ where: { id }, data })
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
      returnProofNote: z.string().optional(),
      returnedAt: z.date().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const { id, ...data } = input
      return ctx.db.auditTrip.update({ where: { id }, data })
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
