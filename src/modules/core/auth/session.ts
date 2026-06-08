import { type NextRequest } from 'next/server'
import { jwtVerify } from 'jose'
import { db } from '@/server/db/client'

const JWT_SECRET = new TextEncoder().encode(process.env.AUTH_SECRET ?? 'fallback-secret')

export type SessionUser = {
  id: string
  name: string
  email: string
  roles: string[]
  permissions: string[]
  storeScopes: {
    storeId: string | null
    groupId: string | null
    regionId: string | null
    scopeAll: boolean
  }[]
}

export type Session = {
  user: SessionUser
  expires: string
}

export async function getSessionUser(req: NextRequest): Promise<Session | null> {
  const token =
    req.cookies.get('session-token')?.value ??
    req.headers.get('authorization')?.replace('Bearer ', '')

  if (!token) return null

  try {
    const { payload } = await jwtVerify(token, JWT_SECRET)
    const userId = payload.sub as string

    const user = await db.user.findUnique({
      where: { id: userId, deletedAt: null },
      include: {
        roles: {
          include: {
            role: {
              include: {
                permissions: {
                  include: { permission: true },
                },
              },
            },
          },
        },
        storeScopes: true,
      },
    })

    if (!user || user.status !== 'ACTIVE') return null

    const roles = user.roles.map((ur) => ur.role.name)
    const rawPermissions = user.roles.flatMap((ur) =>
      ur.role.permissions.map((rp) => `${rp.permission.module}:${rp.permission.action}`)
    )
    const permissions = Array.from(new Set(rawPermissions))

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        roles,
        permissions,
        storeScopes: user.storeScopes.map((s) => ({
          storeId: s.storeId,
          groupId: s.groupId,
          regionId: s.regionId,
          scopeAll: s.scopeAll,
        })),
      },
      expires: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(),
    }
  } catch {
    return null
  }
}

export function hasPermission(session: Session | null, module: string, action: string): boolean {
  if (!session) return false
  const { roles, permissions } = session.user
  if (roles.includes('platform-admin')) return true
  return permissions.includes(`${module}:${action}`)
}

export function hasStoreAccess(session: Session | null, storeId: string): boolean {
  if (!session) return false
  const { roles, storeScopes } = session.user
  if (roles.includes('platform-admin')) return true
  return storeScopes.some((s) => s.scopeAll || s.storeId === storeId)
}
