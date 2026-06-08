import { z } from 'zod'
import { createTRPCRouter, protectedProcedure, publicProcedure } from '@/server/trpc/init'

export const auditFormsRouter = createTRPCRouter({
  // Listar todos os links de formulário
  listLinks: protectedProcedure
    .input(z.object({
      collaboratorId: z.string().optional(),
      tripId: z.string().optional(),
      status: z.string().optional(),
    }).optional())
    .query(async ({ input, ctx }) => {
      const where: any = { deletedAt: null }
      if (input?.collaboratorId) where.collaboratorId = input.collaboratorId
      if (input?.tripId) where.tripId = input.tripId
      if (input?.status) where.status = input.status
      return ctx.db.auditFormLink.findMany({
        where,
        include: {
          collaborator: { select: { id: true, name: true, phone: true } },
          trip: { select: { id: true, reason: true, city: true } },
          response: true,
        },
        orderBy: { createdAt: 'desc' },
      })
    }),

  // Gerar link para um colaborador
  generateLink: protectedProcedure
    .input(z.object({
      collaboratorId: z.string(),
      tripId: z.string().optional(),
      expiresInDays: z.number().default(7),
    }))
    .mutation(async ({ input, ctx }) => {
      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + input.expiresInDays)
      return ctx.db.auditFormLink.create({
        data: {
          collaboratorId: input.collaboratorId,
          tripId: input.tripId,
          expiresAt,
          createdBy: ctx.session.user.id,
        },
        include: { collaborator: { select: { name: true, phone: true } } },
      })
    }),

  // Marcar como enviado
  markSent: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      return ctx.db.auditFormLink.update({
        where: { id: input.id },
        data: { status: 'SENT', sentAt: new Date() },
      })
    }),

  // Obter dados do formulário público (sem auth) pelo token
  getByToken: publicProcedure
    .input(z.object({ token: z.string() }))
    .query(async ({ input, ctx }) => {
      const link = await ctx.db.auditFormLink.findUnique({
        where: { token: input.token },
        include: {
          collaborator: { select: { id: true, name: true, role: true } },
          trip: { select: { id: true, reason: true, city: true, state: true, stores: true } },
          response: true,
        },
      })
      if (!link || link.deletedAt) return null

      // Marcar como visualizado se ainda não foi
      if (link.status === 'SENT' || link.status === 'NOT_SENT') {
        await ctx.db.auditFormLink.update({
          where: { id: link.id },
          data: { status: 'VIEWED', viewedAt: new Date() },
        })
      }
      return link
    }),

  // Submeter resposta do formulário (público)
  submitResponse: publicProcedure
    .input(z.object({
      token: z.string(),
      storeName: z.string().min(1),
      cityUf: z.string().optional(),
      costCenter: z.string().min(1),
      reason: z.string().min(1),
      paymentMethod: z.string().min(1),
      date: z.date(),
      value: z.number().positive(),
      observations: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const { token, ...responseData } = input
      const link = await ctx.db.auditFormLink.findUnique({
        where: { token },
        include: { response: true },
      })
      if (!link || link.deletedAt) throw new Error('Formulário não encontrado.')
      if (link.response) throw new Error('Este formulário já foi respondido.')
      if (link.expiresAt && link.expiresAt < new Date()) throw new Error('Este formulário expirou.')

      const response = await ctx.db.auditFormResponse.create({
        data: {
          formLinkId: link.id,
          collaboratorId: link.collaboratorId,
          tripId: link.tripId,
          ...responseData,
        },
      })

      // Criar despesa automaticamente a partir da resposta
      await ctx.db.auditExpense.create({
        data: {
          collaboratorId: link.collaboratorId,
          tripId: link.tripId ?? undefined,
          auditorId: link.collaboratorId,
          storeName: responseData.storeName,
          cityUf: responseData.cityUf,
          type: responseData.costCenter,
          paymentMethod: responseData.paymentMethod,
          date: responseData.date,
          value: responseData.value,
          description: responseData.reason,
          observations: responseData.observations,
          createdBy: 'FORM',
        },
      })

      await ctx.db.auditFormLink.update({
        where: { id: link.id },
        data: { status: 'ANSWERED', answeredAt: new Date() },
      })

      return response
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      return ctx.db.auditFormLink.update({ where: { id: input.id }, data: { deletedAt: new Date() } })
    }),
})
