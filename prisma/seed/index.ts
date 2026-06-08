import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const db = new PrismaClient()

async function main() {
  console.log('🌱 Iniciando seed da plataforma Sfera...')

  // ============================================================
  // PERFIS DO SISTEMA
  // ============================================================
  const roles = [
    { name: 'platform-admin', label: 'Administrador da Plataforma' },
    { name: 'audit-corporate', label: 'Auditoria Corporativa' },
    { name: 'supervisor', label: 'Supervisor / Regional' },
    { name: 'store-manager', label: 'Gerente de Loja' },
    { name: 'store-operator', label: 'Usuário Operacional de Loja' },
    { name: 'financial', label: 'Financeiro / Custos' },
    { name: 'assets', label: 'Patrimônio' },
    { name: 'inventory', label: 'Inventário' },
    { name: 'board', label: 'Diretoria' },
  ]

  const createdRoles: Record<string, string> = {}
  for (const role of roles) {
    const r = await db.role.upsert({
      where: { name: role.name },
      update: { label: role.label, isSystem: true },
      create: { name: role.name, label: role.label, isSystem: true },
    })
    createdRoles[role.name] = r.id
    console.log(`  ✓ Perfil: ${role.label}`)
  }

  // ============================================================
  // PERMISSÕES
  // ============================================================
  const modules = [
    'cde', 'note-transit', 'write-offs', 'merchandise',
    'audit-round', 'audit-cost', 'assets', 'inventory',
    'inventory-kpi', 'inventory-cost', 'strategic',
    'users', 'stores', 'imports', 'pending', 'system',
  ]

  const actions = [
    { action: 'view', scope: 'own-store', label: 'Visualizar (loja própria)' },
    { action: 'view', scope: 'all-stores', label: 'Visualizar (todas as lojas)' },
    { action: 'create', scope: null, label: 'Criar' },
    { action: 'edit', scope: null, label: 'Editar' },
    { action: 'delete', scope: null, label: 'Excluir' },
    { action: 'import', scope: null, label: 'Importar' },
    { action: 'export', scope: null, label: 'Exportar' },
    { action: 'approve', scope: null, label: 'Aprovar' },
    { action: 'comment', scope: null, label: 'Comentar' },
    { action: 'attach', scope: null, label: 'Anexar' },
    { action: 'contest', scope: null, label: 'Contestar' },
    { action: 'close-pending', scope: null, label: 'Encerrar Pendência' },
    { action: 'reopen-pending', scope: null, label: 'Reabrir Pendência' },
    { action: 'manage-users', scope: null, label: 'Gerenciar Usuários' },
    { action: 'manage-roles', scope: null, label: 'Gerenciar Perfis' },
    { action: 'edit-params', scope: null, label: 'Editar Parâmetros' },
  ]

  console.log('  Criando permissões...')
  const permissionIds: string[] = []
  for (const mod of modules) {
    for (const act of actions) {
      const p = await db.permission.upsert({
        where: { module_action_scope: { module: mod, action: act.action, scope: act.scope ?? '' } },
        update: {},
        create: {
          module: mod,
          action: act.action,
          scope: act.scope ?? undefined,
          label: `${mod}: ${act.label}`,
        },
      })
      permissionIds.push(p.id)
    }
  }
  console.log(`  ✓ ${permissionIds.length} permissões criadas`)

  // Dar todas as permissões ao admin
  const allPermissions = await db.permission.findMany()
  for (const perm of allPermissions) {
    await db.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: createdRoles['platform-admin']!, permissionId: perm.id } },
      update: {},
      create: { roleId: createdRoles['platform-admin']!, permissionId: perm.id },
    })
  }

  // ============================================================
  // REGIONAIS E LOJAS (dados demo)
  // ============================================================
  const regions = [
    { code: 'SP', name: 'São Paulo' },
    { code: 'RJ', name: 'Rio de Janeiro' },
    { code: 'MG', name: 'Minas Gerais' },
    { code: 'PR', name: 'Paraná' },
    { code: 'RS', name: 'Rio Grande do Sul' },
  ]

  const regionIds: Record<string, string> = {}
  for (const region of regions) {
    const r = await db.region.upsert({
      where: { code: region.code },
      update: {},
      create: { code: region.code, name: region.name, isActive: true },
    })
    regionIds[region.code] = r.id
    console.log(`  ✓ Regional: ${region.name}`)
  }

  const stores = [
    { code: '001', name: 'Loja Shopping Ibirapuera', city: 'São Paulo', state: 'SP', regionCode: 'SP' },
    { code: '002', name: 'Loja Paulista', city: 'São Paulo', state: 'SP', regionCode: 'SP' },
    { code: '003', name: 'Loja Jardins', city: 'São Paulo', state: 'SP', regionCode: 'SP' },
    { code: '004', name: 'Loja Barra da Tijuca', city: 'Rio de Janeiro', state: 'RJ', regionCode: 'RJ' },
    { code: '005', name: 'Loja Ipanema', city: 'Rio de Janeiro', state: 'RJ', regionCode: 'RJ' },
    { code: '006', name: 'Loja BH Shopping', city: 'Belo Horizonte', state: 'MG', regionCode: 'MG' },
    { code: '007', name: 'Loja Curitiba Norte', city: 'Curitiba', state: 'PR', regionCode: 'PR' },
    { code: '008', name: 'Loja Porto Alegre Centro', city: 'Porto Alegre', state: 'RS', regionCode: 'RS' },
  ]

  const storeIds: Record<string, string> = {}
  for (const store of stores) {
    const s = await db.store.upsert({
      where: { code: store.code },
      update: {},
      create: {
        code: store.code,
        name: store.name,
        city: store.city,
        state: store.state,
        regionId: regionIds[store.regionCode]!,
        status: 'ACTIVE',
      },
    })
    storeIds[store.code] = s.id
    console.log(`  ✓ Loja: ${store.name}`)
  }

  // ============================================================
  // USUÁRIOS DEMO
  // ============================================================
  const passwordHash = await bcrypt.hash('Sfera@2024', 12)

  const users = [
    {
      name: 'Administrador',
      email: 'admin@sfera.com.br',
      role: 'platform-admin',
      scopeAll: true,
    },
    {
      name: 'Auditor Corporativo',
      email: 'auditoria@sfera.com.br',
      role: 'audit-corporate',
      scopeAll: true,
    },
    {
      name: 'Supervisor SP',
      email: 'supervisor.sp@sfera.com.br',
      role: 'supervisor',
      scopeAll: false,
      regionCode: 'SP',
    },
    {
      name: 'Gerente Loja 001',
      email: 'gerente.001@sfera.com.br',
      role: 'store-manager',
      scopeAll: false,
      storeCode: '001',
    },
    {
      name: 'Usuário Inventário',
      email: 'inventario@sfera.com.br',
      role: 'inventory',
      scopeAll: true,
    },
    {
      name: 'Diretor',
      email: 'diretoria@sfera.com.br',
      role: 'board',
      scopeAll: true,
    },
  ]

  for (const u of users) {
    const user = await db.user.upsert({
      where: { email: u.email },
      update: {},
      create: {
        name: u.name,
        email: u.email,
        passwordHash,
        status: 'ACTIVE',
        mustChangePassword: false,
      },
    })

    await db.userRole.upsert({
      where: { userId_roleId: { userId: user.id, roleId: createdRoles[u.role]! } },
      update: {},
      create: { userId: user.id, roleId: createdRoles[u.role]! },
    })

    // Remover escopos anteriores e recriar (evita conflito de unique com nulls no SQLite)
    await db.userStoreScope.deleteMany({ where: { userId: user.id } })
    await db.userStoreScope.create({
      data: {
        userId: user.id,
        storeId: u.storeCode ? (storeIds[u.storeCode] ?? undefined) : undefined,
        regionId: u.regionCode ? (regionIds[u.regionCode] ?? undefined) : undefined,
        scopeAll: u.scopeAll,
      },
    })

    console.log(`  ✓ Usuário: ${u.email}`)
  }

  // ============================================================
  // PARÂMETROS DO SISTEMA
  // ============================================================
  const params = [
    { key: 'app.name', value: 'Sfera Multifranquias', type: 'string', label: 'Nome da Plataforma' },
    { key: 'app.logo', value: '/icons/logo.svg', type: 'string', label: 'Logo da Plataforma', isPublic: true },
    { key: 'import.maxFileSizeMB', value: '50', type: 'number', label: 'Tamanho máximo de importação (MB)' },
    { key: 'pending.defaultSlaHours', value: '72', type: 'number', label: 'SLA padrão de pendências (horas)' },
    { key: 'inventory.costDateRule', value: 'inventory_date', type: 'string', label: 'Regra de custo do inventário' },
    { key: 'cde.noResponseSlaHours', value: '48', type: 'number', label: 'SLA de resposta CDE (horas)' },
    { key: 'noteTransit.defaultLeadTimeDays', value: '3', type: 'number', label: 'Lead time padrão de notas (dias)' },
  ]

  for (const p of params) {
    await db.systemParameter.upsert({
      where: { key: p.key },
      update: {},
      create: { ...p, module: p.key.split('.')[0]!, isPublic: p.isPublic ?? false },
    })
  }
  console.log(`  ✓ ${params.length} parâmetros de sistema criados`)

  // ============================================================
  // CONFIGURAÇÕES DE SLA
  // ============================================================
  const slaConfigs = [
    { name: 'Pendência Crítica', module: 'pending', criticality: 'CRITICAL', deadlineHours: 24, warningHours: 4 },
    { name: 'Pendência Alta', module: 'pending', criticality: 'HIGH', deadlineHours: 48, warningHours: 8 },
    { name: 'Pendência Média', module: 'pending', criticality: 'MEDIUM', deadlineHours: 72, warningHours: 12 },
    { name: 'Pendência Baixa', module: 'pending', criticality: 'LOW', deadlineHours: 168, warningHours: 24 },
    { name: 'Nota em Trânsito', module: 'note-transit', deadlineHours: 72, warningHours: 12 },
    { name: 'CDE sem Retorno', module: 'cde', deadlineHours: 48, warningHours: 8 },
  ]

  await db.slaConfig.deleteMany({})
  for (const sla of slaConfigs) {
    await db.slaConfig.create({
      data: {
        name: sla.name,
        module: sla.module,
        criticality: (sla as any).criticality ?? 'MEDIUM',
        deadlineHours: sla.deadlineHours,
        warningHours: sla.warningHours,
        isActive: true,
      },
    })
  }
  console.log(`  ✓ ${slaConfigs.length} configurações de SLA criadas`)

  // ============================================================
  // LAYOUTS DE IMPORTAÇÃO
  // ============================================================
  const importLayouts = [
    {
      name: 'CDE Diário',
      module: 'cde',
      description: 'Layout padrão para importação diária do CDE',
      config: {
        columns: [
          { name: 'LOJA', field: 'storeCode', required: true, type: 'string' },
          { name: 'DATA', field: 'date', required: true, type: 'date' },
          { name: 'ESTOQUE_INICIAL', field: 'initialStock', required: true, type: 'number' },
          { name: 'ENTRADAS', field: 'entries', required: false, type: 'number', default: 0 },
          { name: 'SAIDAS', field: 'exits', required: false, type: 'number', default: 0 },
          { name: 'VENDAS', field: 'sales', required: false, type: 'number', default: 0 },
          { name: 'ESTOQUE_FINAL', field: 'finalStock', required: true, type: 'number' },
        ],
      },
    },
    {
      name: 'Trânsito de Notas',
      module: 'note-transit',
      description: 'Layout padrão para notas em trânsito',
      config: {
        columns: [
          { name: 'NOTA', field: 'noteNumber', required: true, type: 'string' },
          { name: 'TIPO', field: 'noteType', required: true, type: 'string' },
          { name: 'ORIGEM', field: 'originCode', required: false, type: 'string' },
          { name: 'DESTINO', field: 'destinationCode', required: true, type: 'string' },
          { name: 'DATA_EMISSAO', field: 'issuedAt', required: true, type: 'date' },
          { name: 'DATA_PREVISTA', field: 'expectedAt', required: false, type: 'date' },
          { name: 'VALOR', field: 'totalValue', required: false, type: 'number' },
        ],
      },
    },
    {
      name: 'Baixas e Perdas',
      module: 'write-offs',
      description: 'Layout padrão para controle de baixas',
      config: {
        columns: [
          { name: 'LOJA', field: 'storeCode', required: true, type: 'string' },
          { name: 'DATA', field: 'date', required: true, type: 'date' },
          { name: 'SKU', field: 'sku', required: true, type: 'string' },
          { name: 'DESCRICAO', field: 'description', required: true, type: 'string' },
          { name: 'TIPO', field: 'type', required: true, type: 'string' },
          { name: 'QUANTIDADE', field: 'quantity', required: true, type: 'number' },
          { name: 'VALOR_UNITARIO', field: 'unitValue', required: false, type: 'number' },
          { name: 'CUSTO_UNITARIO', field: 'unitCost', required: false, type: 'number' },
          { name: 'MOTIVO', field: 'reason', required: false, type: 'string' },
        ],
      },
    },
    {
      name: 'Inventário — Contagem',
      module: 'inventory',
      description: 'Layout padrão para arquivo de contagem de inventário',
      config: {
        columns: [
          { name: 'SKU', field: 'sku', required: true, type: 'string' },
          { name: 'DESCRICAO', field: 'description', required: true, type: 'string' },
          { name: 'CATEGORIA', field: 'category', required: false, type: 'string' },
          { name: 'ESTOQUE_SISTEMA', field: 'expectedQty', required: true, type: 'number' },
          { name: 'CONTAGEM', field: 'countedQty', required: true, type: 'number' },
          { name: 'STATUS', field: 'status', required: false, type: 'string' },
          { name: 'CUSTO_UNITARIO', field: 'unitCost', required: false, type: 'number' },
        ],
      },
    },
  ]

  for (const layout of importLayouts) {
    const l = await db.importLayout.upsert({
      where: { module_name: { module: layout.module, name: layout.name } },
      update: {},
      create: {
        name: layout.name,
        module: layout.module,
        description: layout.description,
        isActive: true,
      },
    })

    await db.importLayoutVersion.upsert({
      where: { layoutId_version: { layoutId: l.id, version: 1 } },
      update: {},
      create: {
        layoutId: l.id,
        version: 1,
        config: JSON.stringify(layout.config),
        isActive: true,
        publishedAt: new Date(),
      },
    })
    console.log(`  ✓ Layout de importação: ${layout.name}`)
  }

  console.log('\n✅ Seed concluído com sucesso!')
  console.log('\nCredenciais de acesso:')
  console.log('  Admin:      admin@sfera.com.br / Sfera@2024')
  console.log('  Auditoria:  auditoria@sfera.com.br / Sfera@2024')
  console.log('  Gerente:    gerente.001@sfera.com.br / Sfera@2024')
  console.log('  Inventário: inventario@sfera.com.br / Sfera@2024')
}

main()
  .catch((e) => {
    console.error('❌ Erro no seed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
