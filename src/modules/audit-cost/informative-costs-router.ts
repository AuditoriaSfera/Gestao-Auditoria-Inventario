import { z } from 'zod'
import { createTRPCRouter, protectedProcedure } from '@/server/trpc/init'
import { paginate, buildPaginationMeta } from '@/lib/utils'

export const auditInformativeCostsRouter = createTRPCRouter({
  list: protectedProcedure
    .input(z.object({
      page: z.number().default(1),
      pageSize: z.number().default(20),
      tripId: z.string().optional(),
      collaboratorId: z.string().optional(),
      startDate: z.date().optional(),
      endDate: z.date().optional(),
      search: z.string().optional(),
    }))
    .query(async ({ input, ctx }) => {
      const { skip, take } = paginate(input.page, input.pageSize)
      const where: any = {
        deletedAt: null,
        ...(input.tripId && { tripId: input.tripId }),
        ...(input.collaboratorId && { collaboratorId: input.collaboratorId }),
        ...(input.startDate || input.endDate ? { date: {
          ...(input.startDate && { gte: input.startDate }),
          ...(input.endDate   && { lte: input.endDate }),
        }} : {}),
        ...(input.search && { OR: [
          { costCenterName: { contains: input.search, mode: 'insensitive' } },
          { storeName:      { contains: input.search, mode: 'insensitive' } },
          { reason:         { contains: input.search, mode: 'insensitive' } },
          { collaborator:   { name: { contains: input.search, mode: 'insensitive' } } },
        ]}),
      }
      const [items, total] = await Promise.all([
        ctx.db.auditInformativeCost.findMany({
          where, skip, take, orderBy: [{ date: 'desc' }, { createdAt: 'asc' }],
          include: {
            collaborator: { select: { id: true, name: true, role: true } },
            trip: { select: { id: true, reason: true, stores: true, startDate: true, endDate: true } },
          },
        }),
        ctx.db.auditInformativeCost.count({ where }),
      ])
      return { items, meta: buildPaginationMeta(total, input.page, input.pageSize) }
    }),

  create: protectedProcedure
    .input(z.object({
      tripId:          z.string().optional(),
      costCenterName:  z.string().min(1),
      date:            z.date(),
      storeName:       z.string().optional(),
      reason:          z.string().optional(),
      collaboratorId:  z.string().optional(),
      collaboratorIds: z.array(z.string()).optional(),
      value:           z.number().min(0),
      paymentMethod:   z.string().optional(),
      expenseTags:     z.array(z.string()).min(1, 'Selecione ao menos um Tipo de Despesa'),
      attachmentUrls:  z.array(z.string()).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const { attachmentUrls, collaboratorIds, collaboratorId, expenseTags, ...rest } = input
      const primaryCollabId = collaboratorId || collaboratorIds?.[0] || undefined
      return ctx.db.auditInformativeCost.create({
        data: {
          ...rest,
          collaboratorId:  primaryCollabId,
          collaboratorIds: collaboratorIds?.length ? JSON.stringify(collaboratorIds) : null,
          expenseTags:     JSON.stringify(expenseTags),
          attachmentUrls:  attachmentUrls?.length ? JSON.stringify(attachmentUrls) : null,
          auditorId:  ctx.session.user.id,
          createdBy:  ctx.session.user.id,
        },
      })
    }),

  update: protectedProcedure
    .input(z.object({
      id:              z.string(),
      costCenterName:  z.string().min(1).optional(),
      date:            z.date().optional(),
      storeName:       z.string().optional().nullable(),
      reason:          z.string().optional().nullable(),
      collaboratorId:  z.string().optional().nullable(),
      collaboratorIds: z.array(z.string()).optional(),
      value:           z.number().min(0).optional(),
      paymentMethod:   z.string().optional().nullable(),
      expenseTags:     z.array(z.string()).optional(),
      attachmentUrls:  z.array(z.string()).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const { id, attachmentUrls, collaboratorIds, collaboratorId, expenseTags, ...rest } = input
      const primaryCollabId = collaboratorId !== undefined
        ? (collaboratorId || (collaboratorIds?.[0] ?? null))
        : undefined
      return ctx.db.auditInformativeCost.update({
        where: { id },
        data: {
          ...rest,
          ...(primaryCollabId !== undefined && { collaboratorId: primaryCollabId }),
          ...(collaboratorIds !== undefined && { collaboratorIds: collaboratorIds.length ? JSON.stringify(collaboratorIds) : null }),
          ...(expenseTags     !== undefined && { expenseTags:     expenseTags.length     ? JSON.stringify(expenseTags)     : null }),
          ...(attachmentUrls  !== undefined && { attachmentUrls:  attachmentUrls.length  ? JSON.stringify(attachmentUrls)  : null }),
        },
      })
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      return ctx.db.auditInformativeCost.update({
        where: { id: input.id },
        data: { deletedAt: new Date() },
      })
    }),
})
