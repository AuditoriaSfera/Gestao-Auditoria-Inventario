import { z } from 'zod'
import { createTRPCRouter, protectedProcedure } from '@/server/trpc/init'

export const inventoryCostRouter = createTRPCRouter({
  getByCycle: protectedProcedure
    .input(z.object({ cycleId: z.string() }))
    .query(async ({ input, ctx }) => {
      return ctx.db.inventoryCost.findFirst({
        where: { cycleId: input.cycleId },
        include: { items: true, costCenter: true },
      })
    }),

  upsert: protectedProcedure
    .input(z.object({
      cycleId: z.string(),
      costCenterId: z.string().optional(),
      collaboratorsCount: z.number().default(0),
      totalHours: z.number().default(0),
      teamCost: z.number().default(0),
      externalSupportCost: z.number().default(0),
      otherCosts: z.number().default(0),
      observations: z.string().optional(),
      items: z.array(z.object({
        description: z.string(),
        type: z.enum(['FIXED', 'VARIABLE']),
        value: z.number(),
      })).default([]),
    }))
    .mutation(async ({ input, ctx }) => {
      const { items, ...data } = input
      const totalCost = data.teamCost + data.externalSupportCost + data.otherCosts
        + items.reduce((acc, i) => acc + i.value, 0)

      const cycle = await ctx.db.inventoryCycle.findUniqueOrThrow({
        where: { id: input.cycleId },
        include: { teamKpis: { where: { isOfficial: true }, take: 1 } },
      })
      const kpi = cycle.teamKpis[0]
      const totalPieces = kpi ? Number(kpi.totalPiecesCounted) : 0
      const totalSku = kpi ? kpi.totalSkuCounted : 0

      const existing = await ctx.db.inventoryCost.findFirst({ where: { cycleId: input.cycleId } })

      if (existing) {
        await ctx.db.inventoryCostItem.deleteMany({ where: { costId: existing.id } })
        return ctx.db.inventoryCost.update({
          where: { id: existing.id },
          data: {
            ...data,
            totalCost,
            costPerPiece: totalPieces > 0 ? totalCost / totalPieces : null,
            costPerSku: totalSku > 0 ? totalCost / totalSku : null,
            items: { create: items },
          },
        })
      }

      return ctx.db.inventoryCost.create({
        data: {
          ...data,
          totalCost,
          costPerPiece: totalPieces > 0 ? totalCost / totalPieces : null,
          costPerSku: totalSku > 0 ? totalCost / totalSku : null,
          createdBy: ctx.session.user.id,
          items: { create: items },
        },
      })
    }),
})
