import { z } from 'zod'
import { createTRPCRouter, protectedProcedure } from '@/server/trpc/init'
import { paginate, buildPaginationMeta } from '@/lib/utils'
type InventoryStatus = 'AWAITING_IMPORT' | 'IMPORTED' | 'IN_ANALYSIS' | 'IN_CLOSING' | 'FINALIZED' | 'REVISED' | 'CANCELLED' | 'REOPENED'
import { calculateInventoryKpi } from './service'

export const inventoryRouter = createTRPCRouter({
  list: protectedProcedure
    .input(
      z.object({
        page: z.number().default(1),
        pageSize: z.number().default(20),
        storeId: z.string().optional(),
        regionId: z.string().optional(),
        status: z.enum(['AWAITING_IMPORT', 'IMPORTED', 'IN_ANALYSIS', 'IN_CLOSING', 'FINALIZED', 'REVISED', 'CANCELLED', 'REOPENED']).optional(),
        startDate: z.date().optional(),
        endDate: z.date().optional(),
        period: z.string().optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      const { skip, take } = paginate(input.page, input.pageSize)
      const where: any = {
        deletedAt: null,
        ...(input.storeId && { storeId: input.storeId }),
        ...(input.status && { status: input.status }),
        ...(input.period && { period: input.period }),
        ...(input.startDate && { date: { gte: input.startDate } }),
        ...(input.endDate && { date: { lte: input.endDate } }),
      }

      const [cycles, total] = await Promise.all([
        ctx.db.inventoryCycle.findMany({
          where,
          skip,
          take,
          orderBy: { date: 'desc' },
          include: {
            store: { select: { id: true, code: true, name: true, region: { select: { name: true } } } },
            closings: { where: { isOfficial: true }, take: 1 },
          },
        }),
        ctx.db.inventoryCycle.count({ where }),
      ])

      return { cycles, meta: buildPaginationMeta(total, input.page, input.pageSize) }
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input, ctx }) => {
      return ctx.db.inventoryCycle.findUniqueOrThrow({
        where: { id: input.id },
        include: {
          store: { include: { region: true } },
          closings: { orderBy: { version: 'desc' } },
          teamKpis: { orderBy: { version: 'desc' }, take: 1 },
          costs: true,
          imports: { orderBy: { importedAt: 'desc' } },
        },
      })
    }),

  create: protectedProcedure
    .input(z.object({
      storeId: z.string().min(1),
      inventoryType: z.enum(['FULL', 'PARTIAL', 'CATEGORY']),
      date: z.date(),
      period: z.string().optional(),
      observations: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const lastCycle = await ctx.db.inventoryCycle.findFirst({
        where: { storeId: input.storeId, deletedAt: null },
        orderBy: { cycleNumber: 'desc' },
        select: { cycleNumber: true },
      })
      const cycleNumber = (lastCycle?.cycleNumber ?? 0) + 1
      return ctx.db.inventoryCycle.create({
        data: { ...input, cycleNumber, createdBy: ctx.session.user.id },
      })
    }),

  getItems: protectedProcedure
    .input(
      z.object({
        cycleId: z.string(),
        page: z.number().default(1),
        pageSize: z.number().default(50),
        status: z.string().optional(),
        search: z.string().optional(),
        categoryId: z.string().optional(),
        onlyDivergent: z.boolean().optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      const { skip, take } = paginate(input.page, input.pageSize)
      const where: any = {
        cycleId: input.cycleId,
        ...(input.status && { status: input.status }),
        ...(input.categoryId && { categoryId: input.categoryId }),
        ...(input.search && {
          OR: [
            { sku: { contains: input.search } },
            { description: { contains: input.search } },
          ],
        }),
        ...(input.onlyDivergent && { divergenceQty: { not: 0 } }),
      }

      const [items, total] = await Promise.all([
        ctx.db.inventoryItem.findMany({
          where,
          skip,
          take,
          orderBy: [{ lossValue: 'asc' }, { divergenceQty: 'asc' }],
        }),
        ctx.db.inventoryItem.count({ where }),
      ])

      return { items, meta: buildPaginationMeta(total, input.page, input.pageSize) }
    }),

  close: protectedProcedure
    .input(
      z.object({
        cycleId: z.string(),
        collaboratorsCount: z.number().min(1),
        collaboratorNames: z.array(z.string()).optional(),
        startTime: z.date().optional(),
        endTime: z.date().optional(),
        totalDurationMin: z.number().optional(),
        recountCount: z.number().default(0),
        recountReason: z.string().optional(),
        hadExternalSupport: z.boolean().default(false),
        hadSalesSupport: z.boolean().default(false),
        incidents: z.string().optional(),
        observations: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { cycleId, collaboratorNames, ...closingData } = input
      const cycle = await ctx.db.inventoryCycle.findUniqueOrThrow({
        where: { id: cycleId },
        include: { items: true, closings: true },
      })

      const newVersion = (cycle.closings.length ?? 0) + 1

      // Calcular totais a partir dos items
      const totals = cycle.items.reduce(
        (acc, item) => {
          acc.expectedQty += Number(item.expectedQty)
          acc.countedQty += Number(item.countedQty)
          acc.divergenceQty += Number(item.divergenceQty)
          if (Number(item.lossValue) > 0) acc.lossValue += Number(item.lossValue)
          if (Number(item.gainValue) > 0) acc.gainValue += Number(item.gainValue)
          return acc
        },
        { expectedQty: 0, countedQty: 0, divergenceQty: 0, lossValue: 0, gainValue: 0 }
      )

      const netBalance = totals.gainValue - totals.lossValue
      const lossPercent = totals.expectedQty > 0 ? (totals.lossValue / totals.expectedQty) * 100 : 0
      const accuracy = totals.expectedQty > 0 ? (1 - Math.abs(totals.divergenceQty) / totals.expectedQty) * 100 : 0

      const closing = await ctx.db.inventoryClosing.create({
        data: {
          cycleId,
          version: newVersion,
          isOfficial: true,
          collaboratorsCount: closingData.collaboratorsCount,
          collaboratorNames: collaboratorNames ? JSON.stringify(collaboratorNames) : null,
          startTime: closingData.startTime,
          endTime: closingData.endTime,
          totalDurationMin: closingData.totalDurationMin,
          recountCount: closingData.recountCount,
          recountReason: closingData.recountReason,
          hadExternalSupport: closingData.hadExternalSupport,
          hadSalesSupport: closingData.hadSalesSupport,
          incidents: closingData.incidents,
          observations: closingData.observations,
          expectedQty: totals.expectedQty,
          countedQty: totals.countedQty,
          divergenceQty: totals.divergenceQty,
          lossValue: totals.lossValue,
          gainValue: totals.gainValue,
          netBalance,
          lossPercent,
          accuracy,
          closedById: ctx.session.user.id,
          closedAt: new Date(),
          createdBy: ctx.session.user.id,
        },
      })

      // Marcar closings anteriores como não-oficiais
      await ctx.db.inventoryClosing.updateMany({
        where: { cycleId, id: { not: closing.id } },
        data: { isOfficial: false },
      })

      // Atualizar cycle com os resultados oficiais
      await ctx.db.inventoryCycle.update({
        where: { id: cycleId },
        data: {
          status: 'FINALIZED',
          expectedQty: totals.expectedQty,
          countedQty: totals.countedQty,
          divergenceQty: totals.divergenceQty,
          lossValue: totals.lossValue,
          gainValue: totals.gainValue,
          netBalance,
          lossPercent,
          accuracy,
          closedById: ctx.session.user.id,
          closedAt: new Date(),
        },
      })

      // Calcular e salvar KPI do time
      await calculateInventoryKpi(ctx.db, cycleId, closing, cycle.items)

      return closing
    }),

  reopen: protectedProcedure
    .input(z.object({ cycleId: z.string(), reason: z.string().min(10) }))
    .mutation(async ({ input, ctx }) => {
      const official = await ctx.db.inventoryClosing.findFirst({
        where: { cycleId: input.cycleId, isOfficial: true },
      })
      if (official) {
        await ctx.db.inventoryClosing.update({
          where: { id: official.id },
          data: {
            reopenedById: ctx.session.user.id,
            reopenedAt: new Date(),
            reopenReason: input.reason,
          },
        })
      }

      await ctx.db.inventoryCycle.update({
        where: { id: input.cycleId },
        data: { status: 'REOPENED', updatedBy: ctx.session.user.id },
      })

      await ctx.db.activityHistory.create({
        data: {
          module: 'inventory',
          recordId: input.cycleId,
          action: 'REOPENED',
          description: `Inventário reaberto. Motivo: ${input.reason}`,
          actorId: ctx.session.user.id,
        },
      })

      return { success: true }
    }),

  categoryBreakdown: protectedProcedure
    .input(z.object({ cycleId: z.string() }))
    .query(async ({ input, ctx }) => {
      const items = await ctx.db.inventoryItem.findMany({
        where: { cycleId: input.cycleId },
      })

      const byCategory = new Map<string, {
        categoryId: string | null
        totalExpected: number
        totalCounted: number
        totalDivergence: number
        totalLoss: number
        totalGain: number
        skuCount: number
        divergentSkuCount: number
      }>()

      for (const item of items) {
        const key = item.categoryId ?? 'SEM_CATEGORIA'
        const existing = byCategory.get(key) ?? {
          categoryId: item.categoryId,
          totalExpected: 0,
          totalCounted: 0,
          totalDivergence: 0,
          totalLoss: 0,
          totalGain: 0,
          skuCount: 0,
          divergentSkuCount: 0,
        }
        existing.totalExpected += Number(item.expectedQty)
        existing.totalCounted += Number(item.countedQty)
        existing.totalDivergence += Number(item.divergenceQty)
        existing.totalLoss += Number(item.lossValue ?? 0)
        existing.totalGain += Number(item.gainValue ?? 0)
        existing.skuCount++
        if (Number(item.divergenceQty) !== 0) existing.divergentSkuCount++
        byCategory.set(key, existing)
      }

      return Array.from(byCategory.entries())
        .map(([key, val]) => ({ key, ...val }))
        .sort((a, b) => b.totalLoss - a.totalLoss)
    }),
})
