import { z } from 'zod'
import { createTRPCRouter, protectedProcedure } from '@/server/trpc/init'

export const auditCollaboratorsRouter = createTRPCRouter({
  list: protectedProcedure
    .input(z.object({ includeInactive: z.boolean().optional() }).optional())
    .query(async ({ input, ctx }) => {
      return ctx.db.auditCollaborator.findMany({
        where: { deletedAt: null, ...(input?.includeInactive ? {} : { isActive: true }) },
        orderBy: { name: 'asc' },
      })
    }),

  create: protectedProcedure
    .input(z.object({
      name: z.string().min(2),
      role: z.string().optional(),
      phone: z.string().optional(),
      email: z.string().email().optional().or(z.literal('')),
    }))
    .mutation(async ({ input, ctx }) => {
      return ctx.db.auditCollaborator.create({
        data: { ...input, email: input.email || undefined, createdBy: ctx.session.user.id },
      })
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.string(),
      name: z.string().min(2),
      role: z.string().optional(),
      phone: z.string().optional(),
      email: z.string().email().optional().or(z.literal('')),
      isActive: z.boolean().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const { id, ...data } = input
      return ctx.db.auditCollaborator.update({ where: { id }, data: { ...data, email: data.email || undefined } })
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      return ctx.db.auditCollaborator.update({ where: { id: input.id }, data: { deletedAt: new Date() } })
    }),
})
