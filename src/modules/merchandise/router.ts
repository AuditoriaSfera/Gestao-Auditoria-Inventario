import { z } from 'zod'
import { createTRPCRouter, protectedProcedure } from '@/server/trpc/init'
import { paginate, buildPaginationMeta } from '@/lib/utils'

export const merchandiseRouter = createTRPCRouter({
  list: protectedProcedure
    .input(z.object({
      page: z.number().default(1),
      pageSize: z.number().default(20),
      storeId: z.string().optional(),
      status: z.string().optional(),
    }))
    .query(async ({ input, ctx }) => {
      const { skip, take } = paginate(input.page, input.pageSize)
      const where: any = {
        deletedAt: null,
        ...(input.storeId && { storeId: input.storeId }),
        ...(input.status && { status: input.status }),
      }
      const [conferences, total] = await Promise.all([
        ctx.db.merchandiseConference.findMany({
          where, skip, take, orderBy: { receivedAt: 'desc' },
          include: { store: { select: { id: true, code: true, name: true } } },
        }),
        ctx.db.merchandiseConference.count({ where }),
      ])
      return { conferences, meta: buildPaginationMeta(total, input.page, input.pageSize) }
    }),

  kpiSummary: protectedProcedure
    .input(z.object({ storeId: z.string().optional(), startDate: z.date(), endDate: z.date() }))
    .query(async ({ input, ctx }) => {
      const where: any = {
        deletedAt: null,
        ...(input.storeId && { storeId: input.storeId }),
        receivedAt: { gte: input.startDate, lte: input.endDate },
      }
      const records = await ctx.db.merchandiseConference.findMany({ where })
      const total = records.length
      const withDivergence = records.filter(r => Number(r.divergenceQty) !== 0).length
      const totalDivergenceValue = records.reduce((acc, r) => acc + Number(r.divergenceValue ?? 0), 0)
      const avgConferenceTime = records.length > 0
        ? records.reduce((acc, r) => acc + (r.conferenceTimeMinutes ?? 0), 0) / records.length
        : 0

      return { total, withDivergence, totalDivergenceValue, avgConferenceTime }
    }),
})
