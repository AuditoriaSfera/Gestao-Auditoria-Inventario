import { z } from 'zod'
import { createTRPCRouter, protectedProcedure } from '@/server/trpc/init'
import { paginate, buildPaginationMeta } from '@/lib/utils'

export const importsRouter = createTRPCRouter({
  listBatches: protectedProcedure
    .input(
      z.object({
        page: z.number().default(1),
        pageSize: z.number().default(20),
        module: z.string().optional(),
        status: z.string().optional(),
        startDate: z.date().optional(),
        endDate: z.date().optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      const { skip, take } = paginate(input.page, input.pageSize)
      const where: any = {
        ...(input.module && { module: input.module }),
        ...(input.status && { status: input.status }),
        ...(input.startDate && { createdAt: { gte: input.startDate } }),
        ...(input.endDate && { createdAt: { lte: input.endDate } }),
      }

      const [batches, total] = await Promise.all([
        ctx.db.importBatch.findMany({
          where,
          skip,
          take,
          orderBy: { createdAt: 'desc' },
          include: {
            uploadedBy: { select: { id: true, name: true } },
            layout: { select: { id: true, name: true } },
          },
        }),
        ctx.db.importBatch.count({ where }),
      ])

      return { batches, meta: buildPaginationMeta(total, input.page, input.pageSize) }
    }),

  getBatchDetails: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input, ctx }) => {
      return ctx.db.importBatch.findUniqueOrThrow({
        where: { id: input.id },
        include: {
          uploadedBy: { select: { id: true, name: true } },
          layout: true,
          layoutVersion: true,
          errors: { orderBy: { rowNumber: 'asc' } },
        },
      })
    }),

  getBatchItems: protectedProcedure
    .input(
      z.object({
        batchId: z.string(),
        page: z.number().default(1),
        pageSize: z.number().default(50),
        onlyInvalid: z.boolean().optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      const { skip, take } = paginate(input.page, input.pageSize)
      const where: any = {
        batchId: input.batchId,
        ...(input.onlyInvalid && { isValid: false }),
      }

      const [items, total] = await Promise.all([
        ctx.db.importBatchItem.findMany({
          where,
          skip,
          take,
          orderBy: { rowNumber: 'asc' },
        }),
        ctx.db.importBatchItem.count({ where }),
      ])

      return { items, meta: buildPaginationMeta(total, input.page, input.pageSize) }
    }),

  listLayouts: protectedProcedure
    .input(z.object({ module: z.string().optional() }))
    .query(async ({ input, ctx }) => {
      return ctx.db.importLayout.findMany({
        where: {
          deletedAt: null,
          isActive: true,
          ...(input.module && { module: input.module }),
        },
        include: {
          versions: {
            where: { isActive: true },
            orderBy: { version: 'desc' },
            take: 1,
          },
        },
      })
    }),

  cancelBatch: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const batch = await ctx.db.importBatch.findUniqueOrThrow({ where: { id: input.id } })
      if (['PUBLISHED', 'PUBLISHING'].includes(batch.status)) {
        throw new Error('Não é possível cancelar uma importação já publicada.')
      }
      return ctx.db.importBatch.update({
        where: { id: input.id },
        data: { status: 'CANCELLED' },
      })
    }),
})
