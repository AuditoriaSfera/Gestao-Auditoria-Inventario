'use client'

export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { trpc } from '@/lib/trpc'
import { ModulePage, EmptyState, LoadingState } from '@/components/shared/module-page'

// ── Mapa completo de módulos e permissões disponíveis ────────────────────────
// Labels alinhados com MODULE_LABELS em src/lib/constants.ts e com o sidebar
const MODULE_DEFS = [
  {
    key: 'audit-cost', label: 'Custo de Auditoria', icon: '✈️',
    actions: [
      { action: 'view',      label: 'Visualizar módulo' },
      { action: 'dashboard', label: 'Dashboard de Custos' },
      { action: 'viagens',   label: 'Gerenciar Viagens' },
      { action: 'salarios',  label: 'Gerenciar Salários e Encargos' },
      { action: 'export',    label: 'Exportar Relatórios' },
    ],
  },
  {
    key: 'audit-round', label: 'Ronda de Auditoria', icon: '🔍',
    actions: [
      { action: 'view', label: 'Visualizar Ronda' },
    ],
  },
  {
    key: 'inventory', label: 'Inventário', icon: '📦',
    actions: [
      { action: 'view',   label: 'Visualizar inventários' },
      { action: 'create', label: 'Criar inventário' },
      { action: 'edit',   label: 'Editar inventário' },
      { action: 'export', label: 'Exportar inventário' },
    ],
  },
  {
    key: 'inventory-kpi', label: 'KPI do Time de Inventário', icon: '📊',
    actions: [
      { action: 'view', label: 'Visualizar KPIs' },
    ],
  },
  {
    key: 'inventory-cost', label: 'Custo de Inventário', icon: '💵',
    actions: [
      { action: 'view', label: 'Visualizar custos' },
    ],
  },
  {
    key: 'note-transit', label: 'Trânsito de Notas', icon: '🧾',
    actions: [
      { action: 'view',   label: 'Visualizar notas' },
      { action: 'import', label: 'Importar notas' },
    ],
  },
  {
    key: 'merchandise', label: 'Conferência de Mercadoria', icon: '🛒',
    actions: [
      { action: 'view', label: 'Visualizar conferência' },
    ],
  },
  {
    key: 'cde', label: 'CDE / Controle de Estoque', icon: '📋',
    actions: [
      { action: 'view', label: 'Visualizar CDE' },
    ],
  },
  {
    key: 'write-offs', label: 'Baixas e Perdas', icon: '📉',
    actions: [
      { action: 'view', label: 'Visualizar baixas' },
    ],
  },
  {
    key: 'strategic', label: 'Indicadores Estratégicos', icon: '🎯',
    actions: [
      { action: 'view', label: 'Visualizar indicadores' },
    ],
  },
  {
    key: 'assets', label: 'Patrimônio', icon: '🏛️',
    actions: [
      { action: 'view', label: 'Visualizar patrimônio' },
    ],
  },
  {
    key: 'platform', label: 'Plataforma Geral', icon: '🖥️',
    actions: [
      { action: 'dashboard', label: 'Dashboard Geral' },
      { action: 'pending',   label: 'Central de Pendências' },
    ],
  },
  {
    key: 'admin.users', label: 'Gestão de Usuários', icon: '👤',
    actions: [
      { action: 'view',   label: 'Visualizar usuários' },
      { action: 'create', label: 'Criar usuários' },
      { action: 'edit',   label: 'Editar usuários' },
      { action: 'delete', label: 'Excluir usuários' },
    ],
  },
  {
    key: 'admin.roles', label: 'Perfis e Permissões', icon: '🔐',
    actions: [
      { action: 'view', label: 'Visualizar perfis' },
      { action: 'edit', label: 'Editar permissões' },
    ],
  },
]

// Defaults sensatos por role
const ROLE_DEFAULTS: Record<string, string[]> = {
  'audit-corporate': [
    'platform:dashboard', 'platform:pending',
    'audit-cost:view', 'audit-cost:dashboard', 'audit-cost:viagens', 'audit-cost:salarios', 'audit-cost:export',
    'audit-round:view',
    'inventory:view', 'inventory:export',
    'inventory-kpi:view',
  ],
  'board': [
    'platform:dashboard', 'platform:pending',
    'audit-cost:view', 'audit-cost:dashboard',
    'inventory:view', 'inventory-kpi:view', 'inventory-cost:view',
    'strategic:view',
  ],
  'financial': [
    'audit-cost:view', 'audit-cost:viagens', 'audit-cost:export',
    'inventory-cost:view',
    'note-transit:view', 'note-transit:import',
  ],
  'store-manager': [
    'inventory:view',
    'note-transit:view',
    'merchandise:view',
  ],
  'inventory': [
    'platform:dashboard', 'platform:pending',
    'audit-cost:view', 'audit-cost:dashboard', 'audit-cost:viagens', 'audit-cost:salarios', 'audit-cost:export',
    'audit-round:view',
    'inventory:view', 'inventory:create', 'inventory:edit', 'inventory:export',
    'inventory-kpi:view',
    'merchandise:view',
    'cde:view',
    'write-offs:view',
  ],
}

// ── Componente de edição de um perfil ─────────────────────────────────────────
function RoleEditor({ roleId, roleName, onClose }: { roleId: string; roleName: string; onClose: () => void }) {
  const { data, isLoading } = trpc.users.getRolePermissions.useQuery({ roleId })
  const utils = trpc.useUtils()
  const save = trpc.users.setRolePermissions.useMutation({
    onSuccess: () => { utils.users.listRoles.invalidate(); onClose() },
  })

  const [selected, setSelected] = useState<Set<string> | null>(null)

  // Inicializa com os dados do servidor ou defaults
  const effective = selected ?? (data ? new Set(
    data.current.length > 0 ? data.current : (ROLE_DEFAULTS[roleName] ?? [])
  ) : null)

  if (isLoading || !effective) return (
    <div style={{ padding: '32px', textAlign: 'center', color: '#94a3b8' }}>Carregando permissões...</div>
  )

  const toggle = (key: string) => {
    const next = new Set(effective)
    next.has(key) ? next.delete(key) : next.add(key)
    setSelected(next)
  }

  const toggleModule = (mod: typeof MODULE_DEFS[0]) => {
    const keys = mod.actions.map(a => `${mod.key}:${a.action}`)
    const allOn = keys.every(k => effective.has(k))
    const next = new Set(effective)
    keys.forEach(k => allOn ? next.delete(k) : next.add(k))
    setSelected(next)
  }

  const selectAll = () => setSelected(new Set(MODULE_DEFS.flatMap(m => m.actions.map(a => `${m.key}:${a.action}`))))
  const clearAll  = () => setSelected(new Set())

  return (
    <div style={{ borderTop: '2px solid #3b82f6', background: '#f8fafc' }}>
      {/* Barra de ações */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', background: '#eff6ff', borderBottom: '1px solid #dbeafe' }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={selectAll} style={{ padding: '5px 12px', borderRadius: '6px', border: '1px solid #bfdbfe', background: 'white', cursor: 'pointer', fontSize: '12px', color: '#2563eb', fontWeight: '600' }}>Marcar tudo</button>
          <button onClick={clearAll}  style={{ padding: '5px 12px', borderRadius: '6px', border: '1px solid #e2e8f0', background: 'white', cursor: 'pointer', fontSize: '12px', color: '#64748b', fontWeight: '600' }}>Limpar tudo</button>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={onClose} style={{ padding: '7px 16px', borderRadius: '8px', border: '1px solid #e2e8f0', background: 'white', cursor: 'pointer', fontSize: '13px', color: '#475569' }}>Cancelar</button>
          <button
            onClick={() => save.mutate({ roleId, keys: Array.from(effective) })}
            disabled={save.isPending}
            style={{ padding: '7px 20px', borderRadius: '8px', border: 'none', background: '#2563eb', cursor: 'pointer', fontSize: '13px', fontWeight: '700', color: 'white', opacity: save.isPending ? 0.7 : 1 }}
          >
            {save.isPending ? 'Salvando...' : '💾 Salvar Permissões'}
          </button>
        </div>
      </div>

      {/* Grid de módulos */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px', padding: '16px 20px' }}>
        {MODULE_DEFS.map(mod => {
          const modKeys = mod.actions.map(a => `${mod.key}:${a.action}`)
          const checkedCount = modKeys.filter(k => effective.has(k)).length
          const allChecked = checkedCount === modKeys.length
          const someChecked = checkedCount > 0 && !allChecked

          return (
            <div key={mod.key} style={{ background: 'white', border: `1.5px solid ${checkedCount > 0 ? '#bfdbfe' : '#e2e8f0'}`, borderRadius: '10px', overflow: 'hidden' }}>
              {/* Cabeçalho do módulo */}
              <div
                onClick={() => toggleModule(mod)}
                style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', background: checkedCount > 0 ? '#eff6ff' : '#f8fafc', cursor: 'pointer', borderBottom: '1px solid #f1f5f9' }}
              >
                <div style={{
                  width: '18px', height: '18px', borderRadius: '5px', flexShrink: 0,
                  border: `2px solid ${allChecked ? '#2563eb' : someChecked ? '#93c5fd' : '#d1d5db'}`,
                  background: allChecked ? '#2563eb' : someChecked ? '#dbeafe' : 'white',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {allChecked && <span style={{ color: 'white', fontSize: '11px', fontWeight: 'bold' }}>✓</span>}
                  {someChecked && <span style={{ color: '#2563eb', fontSize: '11px', fontWeight: 'bold' }}>—</span>}
                </div>
                <span style={{ fontSize: '14px' }}>{mod.icon}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '13px', fontWeight: '700', color: '#0f172a' }}>{mod.label}</div>
                  <div style={{ fontSize: '11px', color: '#94a3b8' }}>{checkedCount}/{modKeys.length} permissões</div>
                </div>
              </div>
              {/* Permissões do módulo */}
              <div style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {mod.actions.map(a => {
                  const key = `${mod.key}:${a.action}`
                  const checked = effective.has(key)
                  return (
                    <label key={key} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 2px', cursor: 'pointer' }}>
                      <div
                        onClick={() => toggle(key)}
                        style={{
                          width: '16px', height: '16px', borderRadius: '4px', flexShrink: 0,
                          border: `2px solid ${checked ? '#2563eb' : '#d1d5db'}`,
                          background: checked ? '#2563eb' : 'white',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                        }}
                      >
                        {checked && <span style={{ color: 'white', fontSize: '10px', fontWeight: 'bold' }}>✓</span>}
                      </div>
                      <span onClick={() => toggle(key)} style={{ fontSize: '12px', color: checked ? '#1e40af' : '#475569', fontWeight: checked ? '600' : '400' }}>{a.label}</span>
                    </label>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function RolesPage() {
  const { data: roles, isLoading } = trpc.users.listRoles.useQuery()
  const [editingId, setEditingId] = useState<string | null>(null)

  return (
    <ModulePage
      title="Perfis e Permissões"
      description="Configure quais módulos e ações cada perfil pode acessar na plataforma"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0', border: '1px solid #e2e8f0', borderRadius: '14px', overflow: 'hidden', background: 'white' }}>
        {/* Cabeçalho */}
        <div style={{ padding: '16px 20px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontWeight: '700', fontSize: '15px', color: '#0f172a' }}>Perfis ({roles?.length ?? 0})</div>
          <div style={{ fontSize: '12px', color: '#94a3b8' }}>Clique em "Configurar" para editar as permissões de cada perfil</div>
        </div>

        {isLoading ? <div style={{ padding: '32px' }}><LoadingState /></div>
          : !roles?.length ? <div style={{ padding: '32px' }}><EmptyState icon="🔐" title="Nenhum perfil" description="Nenhum perfil cadastrado." /></div>
          : roles.map((r: any, idx: number) => (
            <div key={r.id}>
              {/* Linha do perfil */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: editingId === r.id ? 'none' : idx < roles.length - 1 ? '1px solid #f1f5f9' : 'none', background: editingId === r.id ? '#eff6ff' : 'white' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px' }}>🔐</div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                      <span style={{ fontWeight: '700', color: '#0f172a', fontSize: '14px' }}>{r.label}</span>
                      {r.isSystem && <span style={{ padding: '1px 7px', borderRadius: '6px', fontSize: '10px', background: '#fef3c7', color: '#92400e', fontWeight: '600' }}>Sistema</span>}
                    </div>
                    <div style={{ fontSize: '12px', color: '#94a3b8', fontFamily: 'monospace' }}>{r.name}</div>
                  </div>
                </div>
                <button
                  onClick={() => setEditingId(editingId === r.id ? null : r.id)}
                  style={{
                    padding: '7px 16px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '600',
                    border: editingId === r.id ? '1.5px solid #2563eb' : '1.5px solid #e2e8f0',
                    background: editingId === r.id ? '#2563eb' : 'white',
                    color: editingId === r.id ? 'white' : '#475569',
                  }}
                >
                  {editingId === r.id ? '✕ Fechar' : '⚙️ Configurar'}
                </button>
              </div>

              {/* Editor inline */}
              {editingId === r.id && (
                <RoleEditor roleId={r.id} roleName={r.name} onClose={() => setEditingId(null)} />
              )}
            </div>
          ))
        }
      </div>
    </ModulePage>
  )
}
