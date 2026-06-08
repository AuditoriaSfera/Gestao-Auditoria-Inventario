import { z } from 'zod'
import { createTRPCRouter, protectedProcedure } from '@/server/trpc/init'
import { paginate, buildPaginationMeta } from '@/lib/utils'
type PendingStatus = 'OPEN' | 'IN_ANALYSIS' | 'WAITING_STORE' | 'WAITING_AUDIT' | 'RESOLVED_PENDING_VALIDATION' | 'CLOSED' | 'CANCELLED' | 'EXPIRED' | 'REOPENED'
type PendingCriticality = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
type PendingOrigin = 'AUTOMATIC' | 'MANUAL'

export const pendingRouter = createTRPCRouter({
  list: protectedProcedure
    .input(
      z.object({
        page: z.number().default(1),
        pageSize: z.number().default(20),
        module: z.string().optional(),
        status: z.enum(['OPEN', 'IN_ANALYSIS', 'WAITING_STORE', 'WAITING_AUDIT', 'RESOLVED_PENDING_VALIDATION', 'CLOSED', 'CANCELLED', 'EXPIRED', 'REOPENED']).optional(),
        criticality: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
        storeId: z.string().optional(),
        regionId: z.string().optional(),
        responsibleId: z.string().optional(),
        slaBreached: z.boolean().optional(),
        search: z.string().optional(),
        overdueOnly: z.boolean().optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      const { skip, take } = paginate(input.page, input.pageSize)

      const where: any = {
        deletedAt: null,
        ...(input.module && { module: input.module }),
        ...(input.status && { status: input.status }),
        ...(input.criticality && { criticality: input.criticality }),
        ...(input.storeId && { storeId: input.storeId }),
        ...(input.regionId && { regionId: input.regionId }),
        ...(input.responsibleId && { responsibleId: input.responsibleId }),
        ...(input.slaBreached !== undefined && { slaBreached: input.slaBreached }),
        ...(input.search && {
          OR: [
            { title: { contains: input.search } },
            { description: { contains: input.search } },
          ],
        }),
        ...(input.overdueOnly && {
          dueAt: { lt: new Date() },
          status: { notIn: ['CLOSED', 'CANCELLED'] },
        }),
      }

      const [items, total] = await Promise.all([
        ctx.db.pendingItem.findMany({
          where,
          skip,
          take,
          orderBy: [{ criticality: 'desc' }, { dueAt: 'asc' }, { createdAt: 'desc' }],
          include: {
            store: { select: { id: true, code: true, name: true } },
            responsible: { select: { id: true, name: true, email: true } },
            slaConfig: { select: { id: true, name: true, deadlineHours: true } },
          },
        }),
        ctx.db.pendingItem.count({ where }),
      ])

      return { items, meta: buildPaginationMeta(total, input.page, input.pageSize) }
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input, ctx }) => {
      return ctx.db.pendingItem.findUniqueOrThrow({
        where: { id: input.id },
        include: {
          store: true,
          responsible: { select: { id: true, name: true, email: true } },
          slaConfig: true,
          interactions: {
            include: {
              author: { select: { id: true, name: true, avatarUrl: true } },
            },
            orderBy: { createdAt: 'asc' },
          },
        },
      })
    }),

  create: protectedProcedure
    .input(
      z.object({
        module: z.string(),
        recordId: z.string().optional(),
        type: z.string(),
        title: z.string().min(3),
        description: z.string().min(10),
        criticality: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).default('MEDIUM'),
        origin: z.enum(['AUTOMATIC', 'MANUAL']).default('MANUAL'),
        storeId: z.string().optional(),
        regionId: z.string().optional(),
        responsibleId: z.string().optional(),
        slaConfigId: z.string().optional(),
        dueAt: z.date().optional(),
        observations: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      let dueAt = input.dueAt
      if (!dueAt && input.slaConfigId) {
        const sla = await ctx.db.slaConfig.findUnique({ where: { id: input.slaConfigId } })
        if (sla) {
          dueAt = new Date(Date.now() + sla.deadlineHours * 60 * 60 * 1000)
        }
      }

      const pending = await ctx.db.pendingItem.create({
        data: {
          ...input,
          dueAt,
          openedAt: new Date(),
          createdBy: ctx.session.user.id,
        },
      })

      await ctx.db.activityHistory.create({
        data: {
          module: 'pending',
          recordId: pending.id,
          action: 'CREATED',
          description: `Pendência criada: ${pending.title}`,
          actorId: ctx.session.user.id,
        },
      })

      return pending
    }),

  updateStatus: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        status: z.enum(['OPEN', 'IN_ANALYSIS', 'WAITING_STORE', 'WAITING_AUDIT', 'RESOLVED_PENDING_VALIDATION', 'CLOSED', 'CANCELLED', 'EXPIRED', 'REOPENED']),
        comment: z.string().optional(),
        resolution: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const current = await ctx.db.pendingItem.findUniqueOrThrow({ where: { id: input.id } })

      const updateData: any = {
        status: input.status,
        updatedBy: ctx.session.user.id,
      }

      if (input.status === 'CLOSED') updateData.closedAt = new Date()
      if (input.status === 'RESOLVED_PENDING_VALIDATION') updateData.resolvedAt = new Date()
      if (input.resolution) updateData.resolution = input.resolution

      await ctx.db.pendingItem.update({ where: { id: input.id }, data: updateData })

      await ctx.db.pendingInteraction.create({
        data: {
          pendingId: input.id,
          type: 'status_change',
          content: input.comment ?? `Status alterado para: ${input.status}`,
          fromStatus: current.status,
          toStatus: input.status,
          authorId: ctx.session.user.id,
        },
      })

      return { success: true }
    }),

  addInteraction: protectedProcedure
    .input(
      z.object({
        pendingId: z.string(),
        type: z.string().default('comment'),
        content: z.string().min(1),
        metadata: z.any().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      return ctx.db.pendingInteraction.create({
        data: {
          ...input,
          authorId: ctx.session.user.id,
        },
      })
    }),

  summary: protectedProcedure.query(async ({ ctx }) => {
    const now = new Date()
    const [open, expired, slaBreached, critical] = await Promise.all([
      ctx.db.pendingItem.count({
        where: { deletedAt: null, status: { notIn: ['CLOSED', 'CANCELLED'] } },
      }),
      ctx.db.pendingItem.count({
        where: {
          deletedAt: null,
          status: { notIn: ['CLOSED', 'CANCELLED'] },
          dueAt: { lt: now },
        },
      }),
      ctx.db.pendingItem.count({
        where: { deletedAt: null, slaBreached: true, status: { notIn: ['CLOSED', 'CANCELLED'] } },
      }),
      ctx.db.pendingItem.count({
        where: {
          deletedAt: null,
          criticality: 'CRITICAL',
          status: { notIn: ['CLOSED', 'CANCELLED'] },
        },
      }),
    ])

    return { open, expired, slaBreached, critical }
  }),
})
