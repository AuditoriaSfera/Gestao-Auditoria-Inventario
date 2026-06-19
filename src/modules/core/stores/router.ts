import { z } from 'zod'
import { createTRPCRouter, protectedProcedure } from '@/server/trpc/init'
import { paginate, buildPaginationMeta } from '@/lib/utils'

export const storesRouter = createTRPCRouter({
  list: protectedProcedure
    .input(
      z.object({
        page: z.number().default(1),
        pageSize: z.number().default(20),
        search: z.string().optional(),
        gestao: z.string().optional(),
        status: z.string().optional(),
        regionId: z.string().optional(),
        groupId: z.string().optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      const { skip, take } = paginate(input.page, input.pageSize)
      const user = ctx.session.user
      const isAdmin = user.roles.includes('platform-admin')
      const hasAllStores = user.permissions.includes('*:view-all-stores') || isAdmin
      const scopedStoreIds = user.storeScopes
        .filter((s) => !s.scopeAll && s.storeId)
        .map((s) => s.storeId as string)

      const where: any = {
        deletedAt: null,
        ...(input.search && {
          OR: [
            { name: { contains: input.search, mode: 'insensitive' } },
            { code: { contains: input.search, mode: 'insensitive' } },
            { tradeName: { contains: input.search, mode: 'insensitive' } },
            { city: { contains: input.search, mode: 'insensitive' } },
            { state: { contains: input.search, mode: 'insensitive' } },
            { gestao: { contains: input.search, mode: 'insensitive' } },
            { managerName: { contains: input.search, mode: 'insensitive' } },
          ],
        }),
        ...(input.gestao && { gestao: { contains: input.gestao, mode: 'insensitive' } }),
        ...(input.status && { status: input.status }),
        ...(input.regionId && { regionId: input.regionId }),
        ...(!hasAllStores && { id: { in: scopedStoreIds } }),
      }

      const [stores, total] = await Promise.all([
        ctx.db.store.findMany({
          where,
          skip,
          take,
          orderBy: [{ region: { name: 'asc' } }, { name: 'asc' }],
          include: {
            region: { select: { id: true, code: true, name: true } },
          },
        }),
        ctx.db.store.count({ where }),
      ])

      return { stores, meta: buildPaginationMeta(total, input.page, input.pageSize) }
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input, ctx }) => {
      return ctx.db.store.findUniqueOrThrow({
        where: { id: input.id, deletedAt: null },
        include: {
          region: true,
          groups: { include: { group: true } },
        },
      })
    }),

  listRegions: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.region.findMany({
      where: { deletedAt: null, isActive: true },
      orderBy: { name: 'asc' },
    })
  }),

  listGroups: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.storeGroup.findMany({
      where: { deletedAt: null, isActive: true },
      orderBy: { name: 'asc' },
      include: { region: { select: { id: true, name: true } } },
    })
  }),

  create: protectedProcedure
    .input(
      z.object({
        code: z.string().min(1),
        name: z.string().min(2),
        tradeName: z.string().optional(),
        cnpj: z.string().optional(),
        regionId: z.string().optional(),
        address: z.string().optional(),
        city: z.string().optional(),
        state: z.string().optional(),
        zipCode: z.string().optional(),
        phone: z.string().optional(),
        email: z.string().email().optional(),
        managerName: z.string().optional(),
        gestao: z.string().min(1, 'Gestão é obrigatória'),
        openedAt: z.date().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      return ctx.db.store.create({
        data: { ...input, createdBy: ctx.session.user.id },
      })
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(2).optional(),
        tradeName: z.string().optional(),
        regionId: z.string().optional(),
        status: z.enum(['ACTIVE', 'INACTIVE', 'CLOSED']).optional(),
        address: z.string().optional(),
        city: z.string().optional(),
        state: z.string().optional(),
        phone: z.string().optional(),
        email: z.string().email().optional(),
        managerName: z.string().optional(),
        gestao: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { id, ...data } = input
      return ctx.db.store.update({
        where: { id },
        data,
      })
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      return ctx.db.store.update({
        where: { id: input.id },
        data: { deletedAt: new Date() },
      })
    }),

  bulkCreate: protectedProcedure
    .input(
      z.object({
        stores: z.array(
          z.object({
            code: z.string().min(1),
            name: z.string().min(2),
            tradeName: z.string().optional(),
            cnpj: z.string().optional(),
            address: z.string().optional(),
            city: z.string().optional(),
            state: z.string().optional(),
            managerName: z.string().optional(),
            gestao: z.string().min(1, 'Gestão é obrigatória'),
          })
        ),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const existing = await ctx.db.store.findMany({
        where: { code: { in: input.stores.map(s => s.code) }, deletedAt: null },
        select: { code: true },
      })
      const existingCodes = new Set(existing.map(s => s.code))
      const toCreate = input.stores.filter(s => !existingCodes.has(s.code))
      const skipped = input.stores.filter(s => existingCodes.has(s.code)).map(s => s.code)

      if (toCreate.length > 0) {
        await ctx.db.store.createMany({
          data: toCreate.map(s => ({ ...s, createdBy: ctx.session.user.id })),
          skipDuplicates: true,
        })
      }

      return { created: toCreate.length, skipped }
    }),
})
