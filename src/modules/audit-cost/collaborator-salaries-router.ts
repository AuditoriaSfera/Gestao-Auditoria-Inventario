import { z } from 'zod'
import { createTRPCRouter, protectedProcedure } from '@/server/trpc/init'
import { paginate, buildPaginationMeta } from '@/lib/utils'

export const auditCollaboratorSalariesRouter = createTRPCRouter({
  list: protectedProcedure
    .input(z.object({
      page:           z.number().default(1),
      pageSize:       z.number().default(50),
      collaboratorId: z.string().optional(),
      status:         z.string().optional(),
      search:         z.string().optional(),
    }))
    .query(async ({ input, ctx }) => {
      const { skip, take } = paginate(input.page, input.pageSize)
      const where: any = {
        deletedAt: null,
        ...(input.collaboratorId && { collaboratorId: input.collaboratorId }),
        ...(input.status && { status: input.status }),
        ...(input.search && { collaborator: { name: { contains: input.search, mode: 'insensitive' } } }),
      }
      const [items, total] = await Promise.all([
        ctx.db.auditCollaboratorSalary.findMany({
          where, skip, take, orderBy: { vigenciaInicio: 'desc' },
          include: { collaborator: { select: { id: true, name: true, role: true, isActive: true } } },
        }),
        ctx.db.auditCollaboratorSalary.count({ where }),
      ])
      return { items, meta: buildPaginationMeta(total, input.page, input.pageSize) }
    }),

  listActiveByMonth: protectedProcedure
    .input(z.object({
      year:  z.number(),
      month: z.number(),
    }))
    .query(async ({ input, ctx }) => {
      const { year, month } = input
      const periodStart = new Date(year, month - 1, 1)
      const periodEnd   = new Date(year, month, 0, 23, 59, 59)
      const items = await ctx.db.auditCollaboratorSalary.findMany({
        where: {
          deletedAt: null,
          status: 'ACTIVE',
          vigenciaInicio: { lte: periodEnd },
          OR: [
            { vigenciaFim: null },
            { vigenciaFim: { gte: periodStart } },
          ],
        },
        include: { collaborator: { select: { id: true, name: true, role: true } } },
        orderBy: { vigenciaInicio: 'desc' },
      })
      // Return only the latest record per collaborator (most recent vigenciaInicio)
      const seen = new Set<string>()
      const deduped: typeof items = []
      for (const item of items) {
        if (!seen.has(item.collaboratorId)) {
          seen.add(item.collaboratorId)
          deduped.push(item)
        }
      }
      return deduped
    }),

  create: protectedProcedure
    .input(z.object({
      collaboratorId: z.string().min(1),
      cargo:          z.string().optional(),
      tipoTime:       z.enum(['campo', 'administrativo']).optional(),
      salarioBase:    z.number().min(0),
      encargos:       z.number().min(0).default(0),
      vigenciaInicio: z.date(),
      vigenciaFim:    z.date().optional(),
      observacao:     z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      return ctx.db.auditCollaboratorSalary.create({
        data: {
          ...input,
          status:    'ACTIVE',
          createdBy: ctx.session.user.id,
        },
      })
    }),

  update: protectedProcedure
    .input(z.object({
      id:             z.string(),
      cargo:          z.string().optional(),
      tipoTime:       z.enum(['campo', 'administrativo']).optional(),
      salarioBase:    z.number().min(0).optional(),
      encargos:       z.number().min(0).optional(),
      vigenciaInicio: z.date().optional(),
      vigenciaFim:    z.date().optional().nullable(),
      observacao:     z.string().optional().nullable(),
    }))
    .mutation(async ({ input, ctx }) => {
      const { id, ...data } = input
      return ctx.db.auditCollaboratorSalary.update({
        where: { id },
        data: { ...data, updatedBy: ctx.session.user.id },
      })
    }),

  inactivate: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      return ctx.db.auditCollaboratorSalary.update({
        where: { id: input.id },
        data: { status: 'INACTIVE', updatedBy: ctx.session.user.id },
      })
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      return ctx.db.auditCollaboratorSalary.update({
        where: { id: input.id },
        data: { deletedAt: new Date() },
      })
    }),
})
