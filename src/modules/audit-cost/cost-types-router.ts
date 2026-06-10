import { z } from 'zod'
import { createTRPCRouter, protectedProcedure } from '@/server/trpc/init'

export const auditCostTypesRouter = createTRPCRouter({
  list: protectedProcedure
    .input(z.object({ includeInactive: z.boolean().optional() }).optional())
    .query(async ({ input, ctx }) => {
      return ctx.db.auditCostType.findMany({
        where: { deletedAt: null, ...(input?.includeInactive ? {} : { isActive: true }) },
        orderBy: { name: 'asc' },
      })
    }),

  create: protectedProcedure
    .input(z.object({ name: z.string().min(1) }))
    .mutation(async ({ input, ctx }) => {
      return ctx.db.auditCostType.create({
        data: { name: input.name.trim(), createdBy: ctx.session.user.id },
      })
    }),

  update: protectedProcedure
    .input(z.object({ id: z.string(), name: z.string().min(1).optional(), isActive: z.boolean().optional() }))
    .mutation(async ({ input, ctx }) => {
      const { id, name, ...rest } = input
      return ctx.db.auditCostType.update({
        where: { id },
        data: { ...rest, ...(name ? { name: name.trim() } : {}) },
      })
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      return ctx.db.auditCostType.update({ where: { id: input.id }, data: { deletedAt: new Date() } })
    }),
})
