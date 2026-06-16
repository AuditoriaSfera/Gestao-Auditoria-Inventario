import { z } from 'zod'
import { createTRPCRouter, protectedProcedure } from '@/server/trpc/init'
import { paginate, buildPaginationMeta } from '@/lib/utils'
import type { AuditExpense, AuditTrip, AuditorBaseCost } from '@prisma/client'

export const auditCostRouter = createTRPCRouter({
  listExpenses: protectedProcedure
    .input(z.object({
      page: z.number().default(1),
      pageSize: z.number().default(20),
      auditorId: z.string().optional(),
      type: z.string().optional(),
      startDate: z.date().optional(),
      endDate: z.date().optional(),
    }))
    .query(async ({ input, ctx }) => {
      const { skip, take } = paginate(input.page, input.pageSize)
      const where: any = {
        deletedAt: null,
        ...(input.auditorId && { auditorId: input.auditorId }),
        ...(input.type && { type: input.type }),
        ...(input.startDate && { date: { gte: input.startDate } }),
        ...(input.endDate && { date: { lte: input.endDate } }),
      }
      const [expenses, total] = await Promise.all([
        ctx.db.auditExpense.findMany({
          where, skip, take, orderBy: { date: 'desc' },
          include: { trip: { select: { id: true, description: true } } },
        }),
        ctx.db.auditExpense.count({ where }),
      ])
      return { expenses, meta: buildPaginationMeta(total, input.page, input.pageSize) }
    }),

  createExpense: protectedProcedure
    .input(z.object({
      tripId: z.string().optional(),
      auditorId: z.string(),
      collaboratorId: z.string().optional(),
      storeId: z.string().optional(),
      storeName: z.string().optional(),
      cityUf: z.string().optional(),
      costCenterId: z.string().optional(),
      type: z.string(),
      subtype: z.string().optional(),
      paymentMethod: z.string().optional(),
      date: z.date(),
      value: z.number().positive(),
      description: z.string().optional(),
      observations: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      return ctx.db.auditExpense.create({
        data: { ...input, createdBy: ctx.session.user.id },
      })
    }),

  updateExpense: protectedProcedure
    .input(z.object({
      id: z.string(),
      auditorId: z.string(),
      collaboratorId: z.string().optional(),
      storeId: z.string().optional(),
      storeName: z.string().optional(),
      cityUf: z.string().optional(),
      type: z.string(),
      subtype: z.string().optional(),
      paymentMethod: z.string().optional(),
      date: z.date(),
      value: z.number().positive(),
      description: z.string().optional(),
      observations: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const { id, ...data } = input
      return ctx.db.auditExpense.update({ where: { id }, data })
    }),

  deleteExpense: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      return ctx.db.auditExpense.update({
        where: { id: input.id },
        data: { deletedAt: new Date() },
      })
    }),

  setExpenseAttachment: protectedProcedure
    .input(z.object({ id: z.string(), attachmentUrl: z.string().optional() }))
    .mutation(async ({ input, ctx }) => {
      return ctx.db.auditExpense.update({
        where: { id: input.id },
        data: { attachmentUrl: input.attachmentUrl ?? null },
      })
    }),

  updateExpenseValue: protectedProcedure
    .input(z.object({ id: z.string(), value: z.number().positive() }))
    .mutation(async ({ input, ctx }) => {
      return ctx.db.auditExpense.update({ where: { id: input.id }, data: { value: input.value } })
    }),

  listAvailableMonths: protectedProcedure
    .query(async ({ ctx }) => {
      const expenses = await ctx.db.auditExpense.findMany({
        where: { deletedAt: null },
        select: { date: true },
        orderBy: { date: 'desc' },
      })
      const seen = new Set<string>()
      const months: { year: number; month: number; label: string }[] = []
      const MONTHS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
      for (const e of expenses) {
        const d = new Date(e.date)
        const key = `${d.getFullYear()}-${d.getMonth()}`
        if (!seen.has(key)) {
          seen.add(key)
          months.push({ year: d.getFullYear(), month: d.getMonth() + 1, label: `${MONTHS[d.getMonth()]}/${d.getFullYear()}` })
        }
      }
      return months
    }),

  // Painel mensal — identificado automaticamente pela data do lançamento
  monthlyPanel: protectedProcedure
    .input(z.object({
      year: z.number(),
      month: z.number().min(1).max(12),
      auditorId: z.string().optional(),
    }))
    .query(async ({ input, ctx }) => {
      const startDate = new Date(input.year, input.month - 1, 1)
      const endDate = new Date(input.year, input.month, 0, 23, 59, 59)

      const expenses = await ctx.db.auditExpense.findMany({
        where: {
          deletedAt: null,
          date: { gte: startDate, lte: endDate },
          ...(input.auditorId && { auditorId: input.auditorId }),
        },
      })

      const totalTripCost = expenses.reduce((acc: number, e: AuditExpense) => acc + Number(e.value), 0)

      const auditorIds = Array.from(new Set(expenses.map((e: AuditExpense) => e.auditorId)))
      const baseCosts = await ctx.db.auditorBaseCost.findMany({
        where: {
          auditorId: { in: auditorIds },
          validFrom: { lte: endDate },
          OR: [{ validUntil: null }, { validUntil: { gte: startDate } }],
        },
      })

      const teamCost = baseCosts.reduce((acc: number, c: AuditorBaseCost) => acc + Number(c.monthlyCost), 0)
      const totalOperationCost = totalTripCost + teamCost

      const tripsInPeriod = await ctx.db.auditTrip.findMany({
        where: {
          deletedAt: null,
          startDate: { gte: startDate },
          endDate: { lte: endDate },
          ...(input.auditorId && { auditorId: input.auditorId }),
        },
      })
      const totalStoresVisited = tripsInPeriod.reduce((acc: number, t: AuditTrip) => acc + t.storesCount, 0)

      const byType = expenses.reduce((acc: Record<string, number>, e: AuditExpense) => {
        acc[e.type] = (acc[e.type] ?? 0) + Number(e.value)
        return acc
      }, {} as Record<string, number>)

      return {
        totalTripCost,
        teamCost,
        totalOperationCost,
        totalStoresVisited,
        avgCostPerStore: totalStoresVisited > 0 ? totalTripCost / totalStoresVisited : 0,
        avgTotalCostPerStore: totalStoresVisited > 0 ? totalOperationCost / totalStoresVisited : 0,
        byType,
      }
    }),
})
