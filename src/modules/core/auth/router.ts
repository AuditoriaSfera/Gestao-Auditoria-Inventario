import { z } from 'zod'
import { createTRPCRouter, publicProcedure, protectedProcedure } from '@/server/trpc/init'
import { TRPCError } from '@trpc/server'
import { signIn, changePassword, hashPassword, signUp } from './service'
import { sendPasswordResetEmail } from '@/lib/email'
import crypto from 'crypto'

export const authRouter = createTRPCRouter({
  signUp: publicProcedure
    .input(
      z.object({
        name: z.string().min(3, 'Nome deve ter ao menos 3 caracteres'),
        email: z.string().email('E-mail inválido'),
        password: z.string().min(8, 'Senha deve ter ao menos 8 caracteres'),
      })
    )
    .mutation(async ({ input, ctx }) => {
      return signUp(input.name, input.email, input.password)
    }),

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
          include: {
            role: {
              select: {
                name: true,
                label: true,
                permissions: {
                  select: { permission: { select: { module: true, action: true } } },
                },
              },
            },
          },
        },
      },
    })

    const permissions = new Set<string>()
    for (const ur of user.roles) {
      for (const rp of (ur.role as any).permissions ?? []) {
        permissions.add(`${rp.permission.module}:${rp.permission.action}`)
      }
    }

    return { ...user, permissions: Array.from(permissions) }
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

  requestPasswordReset: publicProcedure
    .input(z.object({ email: z.string().email() }))
    .mutation(async ({ input, ctx }) => {
      const user = await ctx.db.user.findUnique({
        where: { email: input.email.toLowerCase(), deletedAt: null },
        select: { id: true, name: true, email: true, status: true },
      })
      // Always return success to avoid user enumeration
      if (!user || user.status !== 'ACTIVE') return { success: true }

      // Invalidate any existing tokens
      await ctx.db.passwordResetToken.updateMany({
        where: { userId: user.id, usedAt: null },
        data: { usedAt: new Date() },
      })

      const token = crypto.randomBytes(32).toString('hex')
      await ctx.db.passwordResetToken.create({
        data: {
          token,
          userId: user.id,
          expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
        },
      })

      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL ?? 'http://localhost:3000'
      const resetUrl = `${appUrl}/reset-password?token=${token}`

      try {
        await sendPasswordResetEmail(user.email, user.name, resetUrl)
      } catch {
        // Log but don't expose email errors to caller
      }

      return { success: true }
    }),

  resetPassword: publicProcedure
    .input(z.object({
      token: z.string().min(1),
      newPassword: z.string().min(8, 'Senha deve ter ao menos 8 caracteres'),
    }))
    .mutation(async ({ input, ctx }) => {
      const record = await ctx.db.passwordResetToken.findUnique({
        where: { token: input.token },
        include: { user: { select: { id: true, status: true } } },
      })

      if (!record || record.usedAt || record.expiresAt < new Date()) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Link inválido ou expirado.' })
      }

      if (record.user.status !== 'ACTIVE') {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Conta inativa.' })
      }

      const newHash = await hashPassword(input.newPassword)
      await ctx.db.$transaction([
        ctx.db.user.update({
          where: { id: record.userId },
          data: { passwordHash: newHash, mustChangePassword: false },
        }),
        ctx.db.passwordResetToken.update({
          where: { id: record.id },
          data: { usedAt: new Date() },
        }),
      ])

      return { success: true }
    }),
})
