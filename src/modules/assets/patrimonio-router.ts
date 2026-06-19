import { z } from 'zod'
import { createTRPCRouter, protectedProcedure } from '@/server/trpc/init'
import { paginate, buildPaginationMeta } from '@/lib/utils'

const STATUS_LABELS: Record<string, string> = {
  DISPONIVEL: 'Disponível',
  COM_COLABORADOR: 'Com Colaborador',
  NO_ESCRITORIO: 'No Escritório',
  EM_LOJA: 'Em Loja',
  EM_MANUTENCAO: 'Em Manutenção',
  EXTRAVIADO: 'Extraviado',
  INATIVO: 'Inativo',
  EM_VERIFICACAO: 'Em Verificação',
}

export const patrimonioRouter = createTRPCRouter({
  // ── Dashboard ──────────────────────────────────────────────────────────────
  dashboard: protectedProcedure.query(async ({ ctx }) => {
    const all = await ctx.db.equipamentoPatrimonio.findMany({
      where: { deletedAt: null },
      select: { id: true, tipo: true, status: true, colaboradorId: true, colaboradorNome: true, codigo: true, updatedAt: true },
      orderBy: { updatedAt: 'desc' },
    })
    const counts = {
      total: all.length,
      scanner: all.filter(e => e.tipo === 'scanner').length,
      celular: all.filter(e => e.tipo === 'celular').length,
      comColaborador: all.filter(e => e.status === 'COM_COLABORADOR').length,
      noEscritorio: all.filter(e => e.status === 'NO_ESCRITORIO').length,
      emLoja: all.filter(e => e.status === 'EM_LOJA').length,
      emManutencao: all.filter(e => e.status === 'EM_MANUTENCAO').length,
      emVerificacao: all.filter(e => e.status === 'EM_VERIFICACAO').length,
      extraviado: all.filter(e => e.status === 'EXTRAVIADO').length,
      disponivel: all.filter(e => e.status === 'DISPONIVEL').length,
    }
    const semPosse = all.filter(e => e.status === 'DISPONIVEL' || e.status === 'EM_VERIFICACAO').slice(0, 10)
    const emManutencao = all.filter(e => e.status === 'EM_MANUTENCAO').slice(0, 10)
    const recentes = all.slice(0, 10)
    return { counts, semPosse, emManutencao, recentes }
  }),

  // ── Lista ──────────────────────────────────────────────────────────────────
  list: protectedProcedure
    .input(z.object({
      page: z.number().default(1),
      pageSize: z.number().default(50),
      search: z.string().optional(),
      tipo: z.string().optional(),
      status: z.string().optional(),
      colaboradorId: z.string().optional(),
    }))
    .query(async ({ input, ctx }) => {
      const { skip, take } = paginate(input.page, input.pageSize)
      const where: any = {
        deletedAt: null,
        ...(input.tipo && { tipo: input.tipo }),
        ...(input.status && { status: input.status }),
        ...(input.colaboradorId && { colaboradorId: input.colaboradorId }),
        ...(input.search && {
          OR: [
            { codigo: { contains: input.search, mode: 'insensitive' } },
            { descricao: { contains: input.search, mode: 'insensitive' } },
            { colaboradorNome: { contains: input.search, mode: 'insensitive' } },
            { lojaNome: { contains: input.search, mode: 'insensitive' } },
            { serialNumber: { contains: input.search, mode: 'insensitive' } },
          ],
        }),
      }
      const [items, total] = await Promise.all([
        ctx.db.equipamentoPatrimonio.findMany({
          where, skip, take,
          orderBy: [{ tipo: 'asc' }, { codigo: 'asc' }],
        }),
        ctx.db.equipamentoPatrimonio.count({ where }),
      ])
      return { items, meta: buildPaginationMeta(total, input.page, input.pageSize) }
    }),

  // ── Detalhe ────────────────────────────────────────────────────────────────
  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input, ctx }) => {
      const eq = await ctx.db.equipamentoPatrimonio.findUniqueOrThrow({
        where: { id: input.id },
        include: {
          movimentacoes: { orderBy: { createdAt: 'desc' } },
          entregas: { where: { deletedAt: null }, orderBy: { createdAt: 'desc' } },
          anexos: { where: { deletedAt: null }, orderBy: { createdAt: 'desc' } },
        },
      })
      return eq
    }),

  // ── Criar ──────────────────────────────────────────────────────────────────
  create: protectedProcedure
    .input(z.object({
      codigo: z.string().min(1),
      tipo: z.string().min(1),
      serialNumber: z.string().optional(),
      descricao: z.string().optional(),
      observacoes: z.string().optional(),
      condicao: z.string().optional(),
      status: z.string().default('DISPONIVEL'),
      colaboradorId: z.string().optional(),
      colaboradorNome: z.string().optional(),
      lojaId: z.string().optional(),
      lojaNome: z.string().optional(),
      localNota: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const userName = ctx.session.user.name ?? ctx.session.user.email ?? 'Usuário'
      const eq = await ctx.db.equipamentoPatrimonio.create({
        data: { ...input, createdBy: ctx.session.user.id },
      })
      await ctx.db.movimentacaoEquipamento.create({
        data: {
          equipamentoId: eq.id,
          tipo: 'CADASTRO',
          statusAnterior: null,
          statusNovo: input.status,
          destinoDesc: input.colaboradorNome ?? input.lojaNome ?? STATUS_LABELS[input.status] ?? input.status,
          colaboradorNovoId: input.colaboradorId,
          colaboradorNovoNome: input.colaboradorNome,
          lojaNovoNome: input.lojaNome,
          observacoes: 'Cadastro inicial',
          userId: ctx.session.user.id,
          userName,
        },
      })
      return eq
    }),

  // ── Atualizar dados ────────────────────────────────────────────────────────
  update: protectedProcedure
    .input(z.object({
      id: z.string(),
      serialNumber: z.string().optional(),
      descricao: z.string().optional(),
      observacoes: z.string().optional(),
      condicao: z.string().optional(),
      localNota: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const { id, ...data } = input
      const userName = ctx.session.user.name ?? ctx.session.user.email ?? 'Usuário'
      const eq = await ctx.db.equipamentoPatrimonio.update({
        where: { id },
        data: { ...data, updatedBy: ctx.session.user.id },
      })
      await ctx.db.movimentacaoEquipamento.create({
        data: {
          equipamentoId: id,
          tipo: 'ATUALIZACAO',
          statusAnterior: eq.status,
          statusNovo: eq.status,
          observacoes: 'Dados atualizados',
          userId: ctx.session.user.id,
          userName,
        },
      })
      return eq
    }),

  // ── Transferir (mudar posse/status) ───────────────────────────────────────
  transferir: protectedProcedure
    .input(z.object({
      id: z.string(),
      novoStatus: z.string(),
      colaboradorId: z.string().optional(),
      colaboradorNome: z.string().optional(),
      lojaId: z.string().optional(),
      lojaNome: z.string().optional(),
      localNota: z.string().optional(),
      observacoes: z.string().optional(),
      tipoMovimentacao: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const userName = ctx.session.user.name ?? ctx.session.user.email ?? 'Usuário'
      const atual = await ctx.db.equipamentoPatrimonio.findUniqueOrThrow({ where: { id: input.id } })

      const origemDesc = atual.colaboradorNome ?? atual.lojaNome ?? STATUS_LABELS[atual.status] ?? atual.status
      const destinoDesc = input.colaboradorNome ?? input.lojaNome ?? STATUS_LABELS[input.novoStatus] ?? input.novoStatus

      const tipoMov = input.tipoMovimentacao ?? (() => {
        if (input.novoStatus === 'EM_MANUTENCAO') return 'ENVIO_MANUTENCAO'
        if (atual.status === 'EM_MANUTENCAO') return 'RETORNO_MANUTENCAO'
        if (input.novoStatus === 'EM_LOJA') return 'ENTREGA_LOJA'
        if (atual.status === 'EM_LOJA') return 'RETIRADA_LOJA'
        if (input.novoStatus === 'DISPONIVEL') return 'DISPONIBILIZACAO'
        if (input.novoStatus === 'EXTRAVIADO') return 'EXTRAVIO'
        if (input.novoStatus === 'INATIVO') return 'INATIVACAO'
        return 'TRANSFERENCIA'
      })()

      const [eq] = await Promise.all([
        ctx.db.equipamentoPatrimonio.update({
          where: { id: input.id },
          data: {
            status: input.novoStatus,
            colaboradorId: input.colaboradorId ?? null,
            colaboradorNome: input.colaboradorNome ?? null,
            lojaId: input.lojaId ?? null,
            lojaNome: input.lojaNome ?? null,
            localNota: input.localNota ?? null,
            updatedBy: ctx.session.user.id,
          },
        }),
        ctx.db.movimentacaoEquipamento.create({
          data: {
            equipamentoId: input.id,
            tipo: tipoMov,
            statusAnterior: atual.status,
            statusNovo: input.novoStatus,
            origemDesc,
            destinoDesc,
            colaboradorAnteriorId: atual.colaboradorId ?? undefined,
            colaboradorAnteriorNome: atual.colaboradorNome ?? undefined,
            colaboradorNovoId: input.colaboradorId,
            colaboradorNovoNome: input.colaboradorNome,
            lojaAnteriorNome: atual.lojaNome ?? undefined,
            lojaNovoNome: input.lojaNome,
            observacoes: input.observacoes,
            userId: ctx.session.user.id,
            userName,
          },
        }),
      ])
      return eq
    }),

  // ── Registrar entrega em loja ──────────────────────────────────────────────
  registrarEntregaLoja: protectedProcedure
    .input(z.object({
      equipamentoId: z.string(),
      lojaId: z.string().optional(),
      lojaNome: z.string().optional(),
      dataEntrega: z.string(), // ISO date string
      nomeRecebedor: z.string().min(1),
      cargoRecebedor: z.string().optional(),
      observacoes: z.string().optional(),
      anexoUrl: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const userName = ctx.session.user.name ?? ctx.session.user.email ?? 'Usuário'
      const atual = await ctx.db.equipamentoPatrimonio.findUniqueOrThrow({ where: { id: input.equipamentoId } })
      const [entrega] = await Promise.all([
        ctx.db.entregaEquipamentoLoja.create({
          data: {
            equipamentoId: input.equipamentoId,
            lojaId: input.lojaId,
            lojaNome: input.lojaNome,
            dataEntrega: new Date(input.dataEntrega),
            nomeRecebedor: input.nomeRecebedor,
            cargoRecebedor: input.cargoRecebedor,
            observacoes: input.observacoes,
            anexoUrl: input.anexoUrl,
            userId: ctx.session.user.id,
            userName,
          },
        }),
        ctx.db.equipamentoPatrimonio.update({
          where: { id: input.equipamentoId },
          data: {
            status: 'EM_LOJA',
            lojaId: input.lojaId ?? null,
            lojaNome: input.lojaNome ?? null,
            colaboradorId: null,
            colaboradorNome: null,
            updatedBy: ctx.session.user.id,
          },
        }),
        ctx.db.movimentacaoEquipamento.create({
          data: {
            equipamentoId: input.equipamentoId,
            tipo: 'ENTREGA_LOJA',
            statusAnterior: atual.status,
            statusNovo: 'EM_LOJA',
            origemDesc: atual.colaboradorNome ?? STATUS_LABELS[atual.status] ?? atual.status,
            destinoDesc: input.lojaNome ?? 'Loja',
            lojaAnteriorNome: atual.lojaNome ?? undefined,
            lojaNovoNome: input.lojaNome,
            observacoes: input.observacoes,
            anexoUrl: input.anexoUrl,
            userId: ctx.session.user.id,
            userName,
          },
        }),
      ])
      return entrega
    }),

  // ── Adicionar anexo ────────────────────────────────────────────────────────
  addAnexo: protectedProcedure
    .input(z.object({
      equipamentoId: z.string(),
      tipo: z.string(),
      url: z.string().min(1),
      nomeArquivo: z.string().optional(),
      descricao: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const userName = ctx.session.user.name ?? ctx.session.user.email ?? 'Usuário'
      return ctx.db.anexoEquipamento.create({
        data: { ...input, userId: ctx.session.user.id, userName },
      })
    }),

  // ── Soft delete ────────────────────────────────────────────────────────────
  softDelete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      return ctx.db.equipamentoPatrimonio.update({
        where: { id: input.id },
        data: { deletedAt: new Date(), updatedBy: ctx.session.user.id },
      })
    }),

  // ── Listar colaboradores (para o seletor) ─────────────────────────────────
  listColaboradores: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.auditCollaborator.findMany({
      where: { isActive: true },
      select: { id: true, name: true, role: true },
      orderBy: { name: 'asc' },
    })
  }),

  // ── Listar lojas (para o seletor) ─────────────────────────────────────────
  listLojas: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.store.findMany({
      where: { deletedAt: null },
      select: { id: true, code: true, name: true, tradeName: true },
      orderBy: { tradeName: 'asc' },
      take: 500,
    })
  }),
})
