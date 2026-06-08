import { initTRPC, TRPCError } from '@trpc/server'
import { type CreateNextContextOptions } from '@trpc/server/adapters/next'
import superjson from 'superjson'
import { ZodError } from 'zod'
import { db } from '@/server/db/client'
import { getSessionUser } from '@/modules/core/auth/session'
import { logger } from '@/lib/logger'
import type { NextRequest } from 'next/server'

export type TRPCContext = {
  db: typeof db
  session: Awaited<ReturnType<typeof getSessionUser>>
  req?: NextRequest
}

export async function createTRPCContext(opts: { req: NextRequest }): Promise<TRPCContext> {
  const session = await getSessionUser(opts.req)
  return { db, session, req: opts.req }
}

const t = initTRPC.context<TRPCContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    }
  },
})

export const createCallerFactory = t.createCallerFactory
export const createTRPCRouter = t.router
export const publicProcedure = t.procedure

const enforceUserIsAuthed = t.middleware(({ ctx, next }) => {
  if (!ctx.session?.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED' })
  }
  return next({
    ctx: { ...ctx, session: { ...ctx.session, user: ctx.session.user } },
  })
})

export const protectedProcedure = t.procedure.use(enforceUserIsAuthed)

const withLogging = t.middleware(async ({ path, type, next }) => {
  const start = Date.now()
  const result = await next()
  const durationMs = Date.now() - start
  if (result.ok) {
    logger.debug({ path, type, durationMs }, 'tRPC OK')
  } else {
    logger.warn({ path, type, durationMs }, 'tRPC Error')
  }
  return result
})

export const loggedProtectedProcedure = protectedProcedure.use(withLogging)
