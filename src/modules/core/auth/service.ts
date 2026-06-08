import bcrypt from 'bcryptjs'
import { SignJWT } from 'jose'
import { TRPCError } from '@trpc/server'
import { db } from '@/server/db/client'
import { logger } from '@/lib/logger'

const JWT_SECRET = new TextEncoder().encode(process.env.AUTH_SECRET ?? 'fallback-secret')
const TOKEN_EXPIRY = '8h'

export async function signIn(email: string, password: string, ipAddress?: string) {
  const user = await db.user.findUnique({
    where: { email: email.toLowerCase(), deletedAt: null },
  })

  if (!user || !user.passwordHash) {
    await db.auditLog.create({
      data: {
        action: 'AUTH_FAIL',
        module: 'auth',
        description: `Tentativa de login falhou para: ${email}`,
        ipAddress,
        severity: 'WARN',
      },
    })
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'E-mail ou senha inválidos.',
    })
  }

  if (user.status !== 'ACTIVE') {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Conta inativa ou suspensa. Entre em contato com o administrador.',
    })
  }

  const passwordMatch = await bcrypt.compare(password, user.passwordHash)
  if (!passwordMatch) {
    await db.auditLog.create({
      data: {
        userId: user.id,
        action: 'AUTH_FAIL',
        module: 'auth',
        description: 'Senha incorreta',
        ipAddress,
        severity: 'WARN',
      },
    })
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'E-mail ou senha inválidos.',
    })
  }

  const token = await new SignJWT({ sub: user.id, email: user.email })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(TOKEN_EXPIRY)
    .sign(JWT_SECRET)

  await db.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date(), lastLoginIp: ipAddress },
  })

  await db.auditLog.create({
    data: {
      userId: user.id,
      action: 'LOGIN',
      module: 'auth',
      description: 'Login realizado com sucesso',
      ipAddress,
      severity: 'INFO',
    },
  })

  logger.info({ userId: user.id, email: user.email }, 'User logged in')

  return { token, user: { id: user.id, name: user.name, email: user.email } }
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 12)
}

export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string
) {
  const user = await db.user.findUniqueOrThrow({ where: { id: userId } })
  if (!user.passwordHash) throw new TRPCError({ code: 'BAD_REQUEST' })

  const match = await bcrypt.compare(currentPassword, user.passwordHash)
  if (!match) throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Senha atual incorreta.' })

  const newHash = await hashPassword(newPassword)
  await db.user.update({
    where: { id: userId },
    data: { passwordHash: newHash, mustChangePassword: false },
  })

  await db.auditLog.create({
    data: {
      userId,
      action: 'PASSWORD_CHANGE',
      module: 'auth',
      description: 'Senha alterada pelo usuário',
      severity: 'INFO',
    },
  })
}
