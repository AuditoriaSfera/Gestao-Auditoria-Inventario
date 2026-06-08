import { z } from 'zod'
import { createTRPCRouter, protectedProcedure } from '@/server/trpc/init'
import { paginate, buildPaginationMeta } from '@/lib/utils'

export const writeOffsRouter = createTRPCRouter({
  list: protectedProcedure
    .input(z.object({
      page: z.number().default(1),
      pageSize: z.number().default(20),
      storeId: z.string().optional(),
      startDate: z.date().optional(),
      endDate: z.date().optional(),
      status: z.string().optional(),
    }))
    .query(async ({ input, ctx }) => {
      const { skip, take } = paginate(input.page, input.pageSize)
      const where: any = {
        deletedAt: null,
        ...(input.storeId && { storeId: input.storeId }),
        ...(input.status && { status: input.status }),
        ...(input.startDate && { date: { gte: input.startDate } }),
        ...(input.endDate && { date: { lte: input.endDate } }),
      }
      const [writeOffs, total] = await Promise.all([
        ctx.db.writeOff.findMany({
          where, skip, take,
          orderBy: { date: 'desc' },
          include: { store: { select: { id: true, code: true, name: true } } },
        }),
        ctx.db.writeOff.count({ where }),
      ])
      return { writeOffs, meta: buildPaginationMeta(total, input.page, input.pageSize) }
    }),

  getItems: protectedProcedure
    .input(z.object({ writeOffId: z.string(), type: z.string().optional() }))
    .query(async ({ input, ctx }) => {
      return ctx.db.writeOffItem.findMany({
        where: {
          writeOffId: input.writeOffId,
          ...(input.type && { type: input.type }),
        },
        orderBy: { totalCost: 'asc' },
      })
    }),

  topOffenders: protectedProcedure
    .input(z.object({
      startDate: z.date(),
      endDate: z.date(),
      storeId: z.string().optional(),
      limit: z.number().default(10),
    }))
    .query(async ({ input, ctx }) => {
      const items = await ctx.db.writeOffItem.findMany({
        where: {
          writeOff: {
            deletedAt: null,
            date: { gte: input.startDate, lte: input.endDate },
            ...(input.storeId && { storeId: input.storeId }),
          },
        },
        orderBy: { totalCost: 'asc' },
        take: input.limit * 5,
      })

      const bySku = new Map<string, { sku: string; description: string; totalLoss: number; qty: number }>()
      for (const item of items) {
        const existing = bySku.get(item.sku) ?? { sku: item.sku, description: item.description, totalLoss: 0, qty: 0 }
        existing.totalLoss += Number(item.totalCost ?? 0)
        existing.qty += Number(item.quantity)
        bySku.set(item.sku, existing)
      }

      return Array.from(bySku.values())
        .sort((a, b) => b.totalLoss - a.totalLoss)
        .slice(0, input.limit)
    }),
})
