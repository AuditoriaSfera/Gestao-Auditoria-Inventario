import { z } from 'zod'
import { createTRPCRouter, publicProcedure, protectedProcedure } from '@/server/trpc/init'
import { signIn, changePassword } from './service'

export const authRouter = createTRPCRouter({
  signIn: publicProcedure
    .input(
      z.object({
        email: z.string().email('E-mail inválido'),
        password: z.string().min(1, 'Senha obrigatória'),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const req = ctx.req
      const ip = req?.headers.get('x-forwarded-for') ?? undefined
      return signIn(input.email, input.password, ip)
    }),

  me: protectedProcedure.query(async ({ ctx }) => {
    const user = await ctx.db.user.findUniqueOrThrow({
      where: { id: ctx.session.user.id },
      select: {
        id: true,
        name: true,
        email: true,
        avatarUrl: true,
        status: true,
        mustChangePassword: true,
        lastLoginAt: true,
        roles: {
          include: { role: { select: { name: true, label: true } } },
        },
      },
    })
    return user
  }),

  changePassword: protectedProcedure
    .input(
      z.object({
        currentPassword: z.string().min(1),
        newPassword: z.string().min(8, 'Senha deve ter ao menos 8 caracteres'),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await changePassword(ctx.session.user.id, input.currentPassword, input.newPassword)
      return { success: true }
    }),
})
