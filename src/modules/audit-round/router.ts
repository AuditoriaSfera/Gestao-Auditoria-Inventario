import { z } from 'zod'
import { createTRPCRouter, protectedProcedure } from '@/server/trpc/init'
import { paginate, buildPaginationMeta } from '@/lib/utils'
import type { ChecklistItem } from '@prisma/client'


export const auditRoundRouter = createTRPCRouter({
  list: protectedProcedure
    .input(z.object({
      page: z.number().default(1),
      pageSize: z.number().default(20),
      storeId: z.string().optional(),
      status: z.enum(['DRAFT', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']).optional(),
      auditorId: z.string().optional(),
    }))
    .query(async ({ input, ctx }) => {
      const { skip, take } = paginate(input.page, input.pageSize)
      const where: any = {
        deletedAt: null,
        ...(input.storeId && { storeId: input.storeId }),
        ...(input.status && { status: input.status }),
        ...(input.auditorId && { auditorId: input.auditorId }),
      }
      const [rounds, total] = await Promise.all([
        ctx.db.auditRound.findMany({
          where, skip, take, orderBy: { createdAt: 'desc' },
          include: {
            store: { select: { id: true, code: true, name: true } },
            checklistVersion: { include: { template: { select: { name: true } } } },
          },
        }),
        ctx.db.auditRound.count({ where }),
      ])
      return { rounds, meta: buildPaginationMeta(total, input.page, input.pageSize) }
    }),

  create: protectedProcedure
    .input(z.object({
      storeId: z.string(),
      checklistVersionId: z.string(),
      scheduledAt: z.date().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      return ctx.db.auditRound.create({
        data: {
          storeId: input.storeId,
          checklistVersionId: input.checklistVersionId,
          auditorId: ctx.session.user.id,
          scheduledAt: input.scheduledAt,
          status: 'DRAFT',
          createdBy: ctx.session.user.id,
        },
      })
    }),

  submitAnswers: protectedProcedure
    .input(z.object({
      roundId: z.string(),
      answers: z.array(z.object({
        itemId: z.string(),
        value: z.string().optional(),
        score: z.number().optional(),
        observations: z.string().optional(),
        isCompliant: z.boolean().optional(),
      })),
      observations: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const round = await ctx.db.auditRound.findUniqueOrThrow({
        where: { id: input.roundId },
        include: { checklistVersion: { include: { items: true } } },
      })

      let totalScore = 0
      let maxScore = 0

      for (const answer of input.answers) {
        const item = round.checklistVersion.items.find((i: ChecklistItem) => i.id === answer.itemId)
        if (!item) continue

        const score = answer.score ?? 0
        totalScore += score
        maxScore += Number(item.maxScore)

        await ctx.db.auditRoundAnswer.upsert({
          where: { roundId_itemId: { roundId: input.roundId, itemId: answer.itemId } },
          create: {
            roundId: input.roundId,
            itemId: answer.itemId,
            value: answer.value,
            score,
            observations: answer.observations,
            isCompliant: answer.isCompliant,
          },
          update: {
            value: answer.value,
            score,
            observations: answer.observations,
            isCompliant: answer.isCompliant,
          },
        })

        if (item.generatePending && answer.isCompliant === false) {
          await ctx.db.pendingItem.create({
            data: {
              module: 'audit-round',
              recordId: input.roundId,
              type: 'non-compliance',
              title: `Não conformidade: ${item.question.substring(0, 80)}`,
              description: `Pergunta: ${item.question}\nResposta: ${answer.value ?? ''}\nObservação: ${answer.observations ?? ''}`,
              criticality: (item.criticality ?? 'MEDIUM') as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL',
              origin: 'AUTOMATIC',
              storeId: round.storeId,
              openedAt: new Date(),
              createdBy: ctx.session.user.id,
            },
          })
        }
      }

      const scorePercent = maxScore > 0 ? (totalScore / maxScore) * 100 : 0

      return ctx.db.auditRound.update({
        where: { id: input.roundId },
        data: {
          status: 'COMPLETED' as 'COMPLETED',
          completedAt: new Date(),
          totalScore,
          maxScore,
          scorePercent,
          observations: input.observations,
        },
      })
    }),

  listChecklists: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.checklistTemplate.findMany({
      where: { deletedAt: null, isActive: true },
      include: {
        versions: { where: { isActive: true }, orderBy: { version: 'desc' }, take: 1 },
      },
    })
  }),
})
