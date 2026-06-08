import { z } from 'zod'
import { createTRPCRouter, protectedProcedure } from '@/server/trpc/init'
import { paginate, buildPaginationMeta } from '@/lib/utils'
type NoteTransitStatus = 'PENDING' | 'IN_TRANSIT' | 'RECEIVED' | 'LATE' | 'CANCELLED' | 'DIVERGENT'

export const noteTransitRouter = createTRPCRouter({
  list: protectedProcedure
    .input(
      z.object({
        page: z.number().default(1),
        pageSize: z.number().default(20),
        storeId: z.string().optional(),
        status: z.enum(['PENDING', 'IN_TRANSIT', 'RECEIVED', 'LATE', 'CANCELLED', 'DIVERGENT']).optional(),
        startDate: z.date().optional(),
        endDate: z.date().optional(),
        supplierId: z.string().optional(),
        lateOnly: z.boolean().optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      const { skip, take } = paginate(input.page, input.pageSize)
      const now = new Date()
      const where: any = {
        deletedAt: null,
        ...(input.storeId && { destinationStoreId: input.storeId }),
        ...(input.status && { status: input.status }),
        ...(input.supplierId && { supplierId: input.supplierId }),
        ...(input.startDate && { issuedAt: { gte: input.startDate } }),
        ...(input.endDate && { issuedAt: { lte: input.endDate } }),
        ...(input.lateOnly && {
          expectedAt: { lt: now },
          status: { notIn: ['RECEIVED', 'CANCELLED']  },
        }),
      }

      const [transits, total] = await Promise.all([
        ctx.db.noteTransit.findMany({
          where,
          skip,
          take,
          orderBy: { issuedAt: 'desc' },
          include: {
            destinationStore: { select: { id: true, code: true, name: true } },
            supplier: { select: { id: true, name: true } },
          },
        }),
        ctx.db.noteTransit.count({ where }),
      ])

      return { transits, meta: buildPaginationMeta(total, input.page, input.pageSize) }
    }),

  updateStatus: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        status: z.enum(['PENDING', 'IN_TRANSIT', 'RECEIVED', 'LATE', 'CANCELLED', 'DIVERGENT']),
        receivedAt: z.date().optional(),
        justification: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const transit = await ctx.db.noteTransit.findUniqueOrThrow({ where: { id: input.id } })
      const leadTimeHours =
        input.receivedAt && transit.issuedAt
          ? Math.round((input.receivedAt.getTime() - transit.issuedAt.getTime()) / 3600000)
          : transit.leadTimeHours

      return ctx.db.noteTransit.update({
        where: { id: input.id },
        data: {
          status: input.status,
          receivedAt: input.receivedAt,
          justification: input.justification,
          leadTimeHours,
        },
      })
    }),

  kpiSummary: protectedProcedure
    .input(z.object({ storeId: z.string().optional(), regionId: z.string().optional() }))
    .query(async ({ input, ctx }) => {
      const now = new Date()
      const baseWhere: any = {
        deletedAt: null,
        ...(input.storeId && { destinationStoreId: input.storeId }),
      }

      const [pending, late, received] = await Promise.all([
        ctx.db.noteTransit.count({ where: { ...baseWhere, status: 'PENDING' } }),
        ctx.db.noteTransit.count({
          where: {
            ...baseWhere,
            expectedAt: { lt: now },
            status: { notIn: ['RECEIVED', 'CANCELLED'] },
          },
        }),
        ctx.db.noteTransit.count({ where: { ...baseWhere, status: 'RECEIVED' } }),
      ])

      return { pending, late, received }
    }),
})
