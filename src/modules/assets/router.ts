import { z } from 'zod'
import { createTRPCRouter, protectedProcedure } from '@/server/trpc/init'
import { paginate, buildPaginationMeta } from '@/lib/utils'


export const assetsRouter = createTRPCRouter({
  create: protectedProcedure
    .input(z.object({
      assetCode: z.string().min(1),
      description: z.string().min(2),
      category: z.string().min(1),
      subcategory: z.string().optional(),
      brand: z.string().optional(),
      model: z.string().optional(),
      serialNumber: z.string().optional(),
      storeId: z.string().min(1),
      acquisitionDate: z.date().optional(),
      acquisitionValue: z.number().positive().optional(),
      usefulLifeYears: z.number().int().positive().optional(),
      location: z.string().optional(),
      noteNumber: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      return ctx.db.asset.create({
        data: { ...input, createdBy: ctx.session.user.id },
      })
    }),

  list: protectedProcedure
    .input(z.object({
      page: z.number().default(1),
      pageSize: z.number().default(20),
      storeId: z.string().optional(),
      status: z.enum(['ACTIVE', 'TRANSFERRED', 'MAINTENANCE', 'WRITTEN_OFF', 'LOST', 'DIVERGENT', 'UNDER_REVIEW']).optional(),
      category: z.string().optional(),
      search: z.string().optional(),
    }))
    .query(async ({ input, ctx }) => {
      const { skip, take } = paginate(input.page, input.pageSize)
      const where: any = {
        deletedAt: null,
        ...(input.storeId && { storeId: input.storeId }),
        ...(input.status && { status: input.status }),
        ...(input.category && { category: input.category }),
        ...(input.search && {
          OR: [
            { assetCode: { contains: input.search } },
            { description: { contains: input.search } },
            { serialNumber: { contains: input.search } },
          ],
        }),
      }
      const [assets, total] = await Promise.all([
        ctx.db.asset.findMany({
          where, skip, take, orderBy: { assetCode: 'asc' },
          include: { store: { select: { id: true, code: true, name: true } } },
        }),
        ctx.db.asset.count({ where }),
      ])
      return { assets, meta: buildPaginationMeta(total, input.page, input.pageSize) }
    }),

  transfer: protectedProcedure
    .input(z.object({
      assetId: z.string(),
      toStoreId: z.string(),
      justification: z.string().min(5),
    }))
    .mutation(async ({ input, ctx }) => {
      const asset = await ctx.db.asset.findUniqueOrThrow({ where: { id: input.assetId } })
      await ctx.db.assetMovement.create({
        data: {
          assetId: input.assetId,
          type: 'TRANSFER',
          fromStoreId: asset.storeId,
          toStoreId: input.toStoreId,
          justification: input.justification,
          responsibleId: ctx.session.user.id,
          occurredAt: new Date(),
          createdBy: ctx.session.user.id,
        },
      })
      return ctx.db.asset.update({
        where: { id: input.assetId },
        data: {
          storeId: input.toStoreId,
          status: 'TRANSFERRED' as 'TRANSFERRED',
        },
      })
    }),

  writeOff: protectedProcedure
    .input(z.object({ assetId: z.string(), justification: z.string().min(10) }))
    .mutation(async ({ input, ctx }) => {
      const asset = await ctx.db.asset.findUniqueOrThrow({ where: { id: input.assetId } })
      await ctx.db.assetMovement.create({
        data: {
          assetId: input.assetId,
          type: 'WRITE_OFF',
          fromStoreId: asset.storeId,
          justification: input.justification,
          responsibleId: ctx.session.user.id,
          occurredAt: new Date(),
          createdBy: ctx.session.user.id,
        },
      })
      return ctx.db.asset.update({
        where: { id: input.assetId },
        data: { status: 'WRITTEN_OFF' as const },
      })
    }),
})
