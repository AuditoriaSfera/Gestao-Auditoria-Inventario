import { z } from 'zod'
import { createTRPCRouter, protectedProcedure } from '@/server/trpc/init'
import { TRPCError } from '@trpc/server'
import { hashPassword } from '../auth/service'
import { paginate, buildPaginationMeta } from '@/lib/utils'
import { db } from '@/server/db/client'

const createUserSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  phone: z.string().optional(),
  document: z.string().optional(),
  roleIds: z.array(z.string()).min(1, 'Selecione ao menos um perfil'),
  storeScopes: z
    .array(
      z.object({
        storeId: z.string().optional(),
        groupId: z.string().optional(),
        regionId: z.string().optional(),
        scopeAll: z.boolean().default(false),
      })
    )
    .default([]),
})

export const usersRouter = createTRPCRouter({
  list: protectedProcedure
    .input(
      z.object({
        page: z.number().default(1),
        pageSize: z.number().default(20),
        search: z.string().optional(),
        status: z.string().optional(),
        roleId: z.string().optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      const { skip, take } = paginate(input.page, input.pageSize)
      const where = {
        deletedAt: null,
        ...(input.search && {
          OR: [
            { name: { contains: input.search } },
            { email: { contains: input.search } },
          ],
        }),
        ...(input.status && { status: input.status as any }),
        ...(input.roleId && {
          roles: { some: { roleId: input.roleId } },
        }),
      }

      const [users, total] = await Promise.all([
        ctx.db.user.findMany({
          where,
          skip,
          take,
          orderBy: { name: 'asc' },
          select: {
            id: true,
            name: true,
            email: true,
            status: true,
            phone: true,
            lastLoginAt: true,
            createdAt: true,
            roles: {
              include: { role: { select: { name: true, label: true } } },
            },
          },
        }),
        ctx.db.user.count({ where }),
      ])

      return { users, meta: buildPaginationMeta(total, input.page, input.pageSize) }
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input, ctx }) => {
      return ctx.db.user.findUniqueOrThrow({
        where: { id: input.id, deletedAt: null },
        include: {
          roles: { include: { role: true } },
          storeScopes: {
            include: {
              store: { select: { id: true, code: true, name: true } },
              group: { select: { id: true, code: true, name: true } },
              region: { select: { id: true, code: true, name: true } },
            },
          },
        },
      })
    }),

  create: protectedProcedure
    .input(createUserSchema)
    .mutation(async ({ input, ctx }) => {
      const emailLower = input.email.toLowerCase()

      const existing = await ctx.db.user.findFirst({
        where: { email: emailLower, deletedAt: null },
      })
      if (existing) {
        throw new TRPCError({ code: 'CONFLICT', message: 'E-mail já cadastrado.' })
      }

      const passwordHash = await hashPassword(input.password)

      // If a soft-deleted user with same email exists, restore it instead of creating a duplicate
      const deleted = await ctx.db.user.findFirst({
        where: { email: emailLower, deletedAt: { not: null } },
      })

      let user: any
      if (deleted) {
        await ctx.db.userRole.deleteMany({ where: { userId: deleted.id } })
        await ctx.db.userStoreScope.deleteMany({ where: { userId: deleted.id } })
        user = await ctx.db.user.update({
          where: { id: deleted.id },
          data: {
            name: input.name,
            passwordHash,
            phone: input.phone ?? null,
            document: input.document ?? null,
            status: 'ACTIVE',
            mustChangePassword: true,
            deletedAt: null,
            createdBy: ctx.session.user.id,
            roles: {
              create: input.roleIds.map((roleId) => ({
                roleId,
                assignedBy: ctx.session.user.id,
              })),
            },
            storeScopes: {
              create: input.storeScopes,
            },
          },
        })
      } else {
        user = await ctx.db.user.create({
          data: {
            name: input.name,
            email: emailLower,
            passwordHash,
            phone: input.phone,
            document: input.document,
            status: 'ACTIVE',
            mustChangePassword: true,
            createdBy: ctx.session.user.id,
            roles: {
              create: input.roleIds.map((roleId) => ({
                roleId,
                assignedBy: ctx.session.user.id,
              })),
            },
            storeScopes: {
              create: input.storeScopes,
            },
          },
        })
      }

      await ctx.db.auditLog.create({
        data: {
          userId: ctx.session.user.id,
          action: 'USER_CREATED',
          module: 'users',
          recordId: user.id,
          description: `Usuário criado: ${user.email}`,
          severity: 'INFO',
        },
      })

      return user
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(2).optional(),
        phone: z.string().optional(),
        status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED']).optional(),
        roleIds: z.array(z.string()).optional(),
        storeScopes: z
          .array(
            z.object({
              storeId: z.string().optional(),
              groupId: z.string().optional(),
              regionId: z.string().optional(),
              scopeAll: z.boolean().default(false),
            })
          )
          .optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { id, roleIds, storeScopes, ...data } = input

      await ctx.db.user.update({
        where: { id },
        data: {
          ...data,
          updatedBy: ctx.session.user.id,
          ...(roleIds && {
            roles: {
              deleteMany: {},
              create: roleIds.map((roleId) => ({
                roleId,
                assignedBy: ctx.session.user.id,
              })),
            },
          }),
          ...(storeScopes && {
            storeScopes: {
              deleteMany: {},
              create: storeScopes,
            },
          }),
        },
      })

      return { success: true }
    }),

  listRoles: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.role.findMany({
      where: { deletedAt: null },
      orderBy: { label: 'asc' },
      select: { id: true, name: true, label: true, description: true, isSystem: true },
    })
  }),

  getRolePermissions: protectedProcedure
    .input(z.object({ roleId: z.string() }))
    .query(async ({ input, ctx }) => {
      const role = await ctx.db.role.findUniqueOrThrow({
        where: { id: input.roleId },
        include: { permissions: { include: { permission: true } } },
      })
      return {
        role: { id: role.id, name: role.name, label: role.label },
        current: role.permissions.map(rp => `${rp.permission.module}:${rp.permission.action}`),
      }
    }),

  setRolePermissions: protectedProcedure
    .input(z.object({
      roleId: z.string(),
      keys: z.array(z.string()), // "module:action"
    }))
    .mutation(async ({ input, ctx }) => {
      const permIds: string[] = []
      for (const key of input.keys) {
        const [module, action] = key.split(':')
        let perm = await ctx.db.permission.findFirst({ where: { module, action, scope: null } })
        if (!perm) {
          perm = await ctx.db.permission.create({ data: { module, action, label: `${module}:${action}` } })
        }
        permIds.push(perm.id)
      }
      await ctx.db.rolePermission.deleteMany({ where: { roleId: input.roleId } })
      if (permIds.length > 0) {
        await ctx.db.rolePermission.createMany({
          data: permIds.map(permissionId => ({ roleId: input.roleId, permissionId })),
          skipDuplicates: true,
        })
      }
      return { success: true }
    }),

  softDelete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      await ctx.db.user.update({
        where: { id: input.id },
        data: { deletedAt: new Date(), updatedBy: ctx.session.user.id },
      })

      await ctx.db.auditLog.create({
        data: {
          userId: ctx.session.user.id,
          action: 'USER_DELETED',
          module: 'users',
          recordId: input.id,
          description: 'Usuário excluído (soft delete)',
          severity: 'WARN',
        },
      })

      return { success: true }
    }),

  resetPassword: protectedProcedure
    .input(z.object({ id: z.string(), newPassword: z.string().min(8) }))
    .mutation(async ({ input, ctx }) => {
      const passwordHash = await hashPassword(input.newPassword)
      await ctx.db.user.update({
        where: { id: input.id },
        data: {
          passwordHash,
          mustChangePassword: true,
          updatedBy: ctx.session.user.id,
        },
      })

      await ctx.db.auditLog.create({
        data: {
          userId: ctx.session.user.id,
          action: 'PASSWORD_RESET',
          module: 'users',
          recordId: input.id,
          description: 'Senha redefinida por administrador',
          severity: 'WARN',
        },
      })

      return { success: true }
    }),

  activatePendingUser: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const user = await ctx.db.user.findUniqueOrThrow({
        where: { id: input.id },
      })

      if (user.status !== 'PENDING_ACTIVATION') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Este usuário não está pendente de ativação.',
        })
      }

      await ctx.db.user.update({
        where: { id: input.id },
        data: {
          status: 'ACTIVE',
          emailVerified: new Date(),
          updatedBy: ctx.session.user.id,
        },
      })

      await ctx.db.auditLog.create({
        data: {
          userId: ctx.session.user.id,
          action: 'USER_ACTIVATED',
          module: 'users',
          recordId: input.id,
          description: `Usuário ativado: ${user.email}`,
          severity: 'INFO',
        },
      })

      return { success: true, message: 'Usuário ativado com sucesso!' }
    }),

  cleanupTestData: protectedProcedure
    .mutation(async ({ ctx }) => {
      if (!ctx.session.user.roles.includes('platform-admin')) throw new TRPCError({ code: 'FORBIDDEN' })
      const now = new Date()
      const [trips, informativos] = await Promise.all([
        ctx.db.auditTrip.updateMany({
          where: { deletedAt: null, status: { not: 'OPEN' } },
          data: { deletedAt: now },
        }),
        ctx.db.auditInformativeCost.updateMany({
          where: { deletedAt: null },
          data: { deletedAt: now },
        }),
      ])
      return { viagens: trips.count, informativos: informativos.count }
    }),
})
