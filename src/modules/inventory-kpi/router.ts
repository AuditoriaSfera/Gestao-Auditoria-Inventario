import { z } from 'zod'
import { createTRPCRouter, protectedProcedure } from '@/server/trpc/init'

export const inventoryKpiRouter = createTRPCRouter({
  getByCycle: protectedProcedure
    .input(z.object({ cycleId: z.string() }))
    .query(async ({ input, ctx }) => {
      return ctx.db.inventoryTeamKpi.findFirst({
        where: { cycleId: input.cycleId, isOfficial: true },
        include: { members: true },
        orderBy: { version: 'desc' },
      })
    }),

  compare: protectedProcedure
    .input(z.object({
      storeId: z.string().optional(),
      limit: z.number().default(10),
    }))
    .query(async ({ input, ctx }) => {
      const cycles = await ctx.db.inventoryCycle.findMany({
        where: {
          deletedAt: null,
          status: 'FINALIZED',
          ...(input.storeId && { storeId: input.storeId }),
        },
        orderBy: { date: 'desc' },
        take: input.limit,
        include: {
          store: { select: { id: true, code: true, name: true } },
          teamKpis: { where: { isOfficial: true }, take: 1 },
        },
      })
      return cycles
    }),
})
