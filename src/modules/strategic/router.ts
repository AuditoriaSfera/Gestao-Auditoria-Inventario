import { z } from 'zod'
import { createTRPCRouter, protectedProcedure } from '@/server/trpc/init'

export const strategicRouter = createTRPCRouter({
  executiveSummary: protectedProcedure
    .input(z.object({
      startDate: z.date(),
      endDate: z.date(),
      regionId: z.string().optional(),
      storeId: z.string().optional(),
    }))
    .query(async ({ input, ctx }) => {
      const storeFilter: any = input.storeId
        ? { storeId: input.storeId }
        : input.regionId
        ? { store: { regionId: input.regionId } }
        : {}

      const [
        inventories,
        pendingCount,
        writeOffTotals,
        auditRounds,
        noteTransitsLate,
        assetsDivergent,
      ] = await Promise.all([
        ctx.db.inventoryCycle.findMany({
          where: {
            deletedAt: null,
            status: 'FINALIZED',
            date: { gte: input.startDate, lte: input.endDate },
            ...storeFilter,
          },
          select: { lossValue: true, gainValue: true, netBalance: true, lossPercent: true },
        }),

        ctx.db.pendingItem.count({
          where: {
            deletedAt: null,
            status: { notIn: ['CLOSED', 'CANCELLED'] },
            ...(input.storeId && { storeId: input.storeId }),
          },
        }),

        ctx.db.writeOff.findMany({
          where: {
            deletedAt: null,
            date: { gte: input.startDate, lte: input.endDate },
            ...storeFilter,
          },
          select: { totalCost: true, totalValue: true },
        }),

        ctx.db.auditRound.count({
          where: {
            deletedAt: null,
            status: 'COMPLETED',
            completedAt: { gte: input.startDate, lte: input.endDate },
            ...(input.storeId && { storeId: input.storeId }),
          },
        }),

        ctx.db.noteTransit.count({
          where: {
            deletedAt: null,
            expectedAt: { lt: new Date() },
            status: { notIn: ['RECEIVED', 'CANCELLED'] },
            ...(input.storeId && { destinationStoreId: input.storeId }),
          },
        }),

        ctx.db.asset.count({
          where: {
            deletedAt: null,
            status: { in: ['DIVERGENT', 'LOST'] },
            ...(input.storeId && { storeId: input.storeId }),
          },
        }),
      ])

      const totalInventoryLoss = inventories.reduce((acc, i) => acc + Number(i.lossValue ?? 0), 0)
      const totalWriteOffLoss = writeOffTotals.reduce((acc, w) => acc + Number(w.totalCost ?? 0), 0)

      return {
        inventoriesCount: inventories.length,
        totalInventoryLoss,
        totalWriteOffLoss,
        totalLoss: totalInventoryLoss + totalWriteOffLoss,
        pendingCount,
        auditRoundsCompleted: auditRounds,
        noteTransitsLate,
        assetsDivergent,
      }
    }),

  storeRanking: protectedProcedure
    .input(z.object({
      startDate: z.date(),
      endDate: z.date(),
      regionId: z.string().optional(),
      metric: z.enum(['loss', 'pending', 'compliance']).default('loss'),
      limit: z.number().default(20),
    }))
    .query(async ({ input, ctx }) => {
      const cycles = await ctx.db.inventoryCycle.findMany({
        where: {
          deletedAt: null,
          status: 'FINALIZED',
          date: { gte: input.startDate, lte: input.endDate },
        },
        include: {
          store: {
            select: { id: true, code: true, name: true, region: { select: { name: true } } },
          },
        },
      })

      const byStore = new Map<string, {
        storeId: string
        storeName: string
        storeCode: string
        region: string
        totalLoss: number
        lossPercent: number
        inventoryCount: number
      }>()

      for (const cycle of cycles) {
        const existing = byStore.get(cycle.storeId) ?? {
          storeId: cycle.storeId,
          storeName: cycle.store.name,
          storeCode: cycle.store.code,
          region: cycle.store.region?.name ?? '',
          totalLoss: 0,
          lossPercent: 0,
          inventoryCount: 0,
        }
        existing.totalLoss += Number(cycle.lossValue ?? 0)
        existing.lossPercent = Number(cycle.lossPercent ?? 0)
        existing.inventoryCount++
        byStore.set(cycle.storeId, existing)
      }

      return Array.from(byStore.values())
        .sort((a, b) => b.totalLoss - a.totalLoss)
        .slice(0, input.limit)
    }),
})
