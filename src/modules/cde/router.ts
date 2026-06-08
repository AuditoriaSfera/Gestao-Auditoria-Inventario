import { z } from 'zod'
import { createTRPCRouter, protectedProcedure } from '@/server/trpc/init'
import { paginate, buildPaginationMeta } from '@/lib/utils'
import type { CdeDailyRecord } from '@prisma/client'

export const cdeRouter = createTRPCRouter({
  list: protectedProcedure
    .input(
      z.object({
        page: z.number().default(1),
        pageSize: z.number().default(20),
        storeId: z.string().optional(),
        startDate: z.date().optional(),
        endDate: z.date().optional(),
        status: z.string().optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      const { skip, take } = paginate(input.page, input.pageSize)
      const where: any = {
        deletedAt: null,
        ...(input.storeId && { storeId: input.storeId }),
        ...(input.status && { status: input.status }),
        ...(input.startDate && { date: { gte: input.startDate } }),
        ...(input.endDate && { date: { lte: input.endDate } }),
      }

      const [records, total] = await Promise.all([
        ctx.db.cdeDailyRecord.findMany({
          where,
          skip,
          take,
          orderBy: { date: 'desc' },
          include: {
            store: { select: { id: true, code: true, name: true } },
          },
        }),
        ctx.db.cdeDailyRecord.count({ where }),
      ])

      return { records, meta: buildPaginationMeta(total, input.page, input.pageSize) }
    }),

  getByStoreAndDate: protectedProcedure
    .input(z.object({ storeId: z.string(), date: z.date() }))
    .query(async ({ input, ctx }) => {
      return ctx.db.cdeDailyRecord.findUnique({
        where: { storeId_date: { storeId: input.storeId, date: input.date } },
        include: { movements: { orderBy: { occurredAt: 'asc' } } },
      })
    }),

  validate: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        action: z.enum(['ACCEPT', 'CONTEST', 'VIEW']),
        reason: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const data: Partial<CdeDailyRecord> & Record<string, unknown> = { updatedBy: ctx.session.user.id }
      const now = new Date()

      if (input.action === 'VIEW') {
        data.status = 'VIEWED'
        data.viewedAt = now
        data.viewedById = ctx.session.user.id
      } else if (input.action === 'ACCEPT') {
        data.status = 'ACCEPTED'
        data.acceptedAt = now
        data.acceptedById = ctx.session.user.id
      } else {
        data.status = 'CONTESTED'
        data.contestedAt = now
        data.contestedById = ctx.session.user.id
        data.contestReason = input.reason
      }

      return ctx.db.cdeDailyRecord.update({ where: { id: input.id }, data })
    }),

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
      }

      const records = await ctx.db.cdeDailyRecord.findMany({ where, select: { status: true } })
      const total = records.length
      const accepted = records.filter((r) => r.status === 'ACCEPTED').length
      const contested = records.filter((r) => r.status === 'CONTESTED').length
      const noResponse = records.filter((r) => r.status === 'PENDING').length

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
})
