'use client'

export const dynamic = 'force-dynamic'

import { useState, useMemo } from 'react'
import { trpc } from '@/lib/trpc'
import { ModulePage } from '@/components/shared/module-page'
import { formatCurrency } from '@/lib/utils'

// ── helpers ─────────────────────────────────────────────────────────────────

function fmt(v: any): string {
  if (v == null) return ''
  return new Date(v).toLocaleDateString('pt-BR')
}

function custoTotal(salario: number, encargos: number): number {
  return salario + encargos
}

// ── Multi-select dropdown ────────────────────────────────────────────────────

function MultiSelectDropdown({ options, selected, onChange, placeholder }: {
  options: { value: string; label: string }[]
  selected: string[]
  onChange: (v: string[]) => void
  placeholder: string
}) {
  const [open, setOpen] = useState(false)

  const toggle = (v: string) =>
    onChange(selected.includes(v) ? selected.filter(x => x !== v) : [...selected, v])

  const label = selected.length === 0
    ? placeholder
    : selected.length === options.length
      ? 'Todos'
      : selected.length === 1
        ? (options.find(o => o.value === selected[0])?.label ?? '1 selecionado')
        : `${selected.length} selecionados`

  return (
    <div style={{ position: 'relative' }}>
      {open && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 199 }} onClick={() => setOpen(false)} />
      )}
      <button
        onClick={() => setOpen(o => !o)}
        style={{ padding: '9px 14px', borderRadius: '8px', border: '1.5px solid #e2e8f0', fontSize: '14px', background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', minWidth: '200px', maxWidth: '240px', justifyContent: 'space-between', position: 'relative', zIndex: 200 }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
        <span style={{ fontSize: '11px', color: '#94a3b8', flexShrink: 0 }}>▾</span>
      </button>
      {open && (
        <div
          style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 300, background: 'white', border: '1.5px solid #e2e8f0', borderRadius: '10px', boxShadow: '0 4px 16px rgba(0,0,0,0.12)', minWidth: '220px', padding: '8px 0 0', maxHeight: '280px', overflowY: 'auto' }}
          onClick={e => e.stopPropagation()}
        >
          <div style={{ display: 'flex', gap: '6px', padding: '4px 10px 8px', borderBottom: '1px solid #f1f5f9' }}>
            <button onClick={() => onChange(options.map(o => o.value))} style={{ fontSize: '12px', padding: '3px 10px', borderRadius: '6px', border: '1px solid #e2e8f0', background: '#f8fafc', cursor: 'pointer' }}>Todos</button>
            <button onClick={() => onChange([])} style={{ fontSize: '12px', padding: '3px 10px', borderRadius: '6px', border: '1px solid #e2e8f0', background: '#f8fafc', cursor: 'pointer' }}>Limpar</button>
          </div>
          {options.map(opt => {
            const checked = selected.includes(opt.value)
            return (
              <div
                key={opt.value}
                onClick={() => toggle(opt.value)}
                style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', cursor: 'pointer', fontSize: '13px', color: '#374151', background: checked ? '#eff6ff' : 'transparent' }}
                onMouseEnter={e => { if (!checked) e.currentTarget.style.background = '#f8fafc' }}
                onMouseLeave={e => { e.currentTarget.style.background = checked ? '#eff6ff' : 'transparent' }}
              >
                <div style={{ width: '16px', height: '16px', borderRadius: '4px', border: `2px solid ${checked ? '#3b82f6' : '#d1d5db'}`, background: checked ? '#3b82f6' : 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.15s' }}>
                  {checked && <span style={{ color: 'white', fontSize: '11px', fontWeight: 'bold', lineHeight: 1 }}>✓</span>}
                </div>
                <span>{opt.label}</span>
              </div>
            )
          })}
          <div style={{ position: 'sticky', bottom: 0, background: 'white', borderTop: '1px solid #f1f5f9', padding: '8px 10px', textAlign: 'right' }}>
            <button onClick={() => setOpen(false)} style={{ fontSize: '12px', fontWeight: '600', color: 'white', background: '#2563eb', border: 'none', borderRadius: '8px', padding: '6px 16px', cursor: 'pointer' }}>Confirmar</button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Modal de cadastro / edição ───────────────────────────────────────────────

function SalarioModal({
  initial,
  collaborators,
  onClose,
  onSaved,
}: {
  initial?: any
  collaborators: any[]
  onClose: () => void
  onSaved: () => void
}) {
  const isEdit = !!initial?.id

  const [collaboratorId, setCollaboratorId] = useState(initial?.collaboratorId ?? '')
  const [cargo, setCargo] = useState(initial?.cargo ?? '')
  const [salarioBase, setSalarioBase] = useState(
    initial?.salarioBase != null ? String(Number(initial.salarioBase)) : ''
  )
  const [encargos, setEncargos] = useState(
    initial?.encargos != null ? String(Number(initial.encargos)) : '0'
  )
  const [vigenciaInicio, setVigenciaInicio] = useState(
    initial?.vigenciaInicio ? new Date(initial.vigenciaInicio).toISOString().slice(0, 10) : ''
  )
  const [vigenciaFim, setVigenciaFim] = useState(
    initial?.vigenciaFim ? new Date(initial.vigenciaFim).toISOString().slice(0, 10) : ''
  )
  const [observacao, setObservacao] = useState(initial?.observacao ?? '')
  const [error, setError] = useState('')

  const createMut = trpc.auditCollaboratorSalaries.create.useMutation()
  const updateMut = trpc.auditCollaboratorSalaries.update.useMutation()

  const salNum = parseFloat(salarioBase) || 0
  const encNum = parseFloat(encargos) || 0
  const total = custoTotal(salNum, encNum)

  async function handleSave() {
    setError('')
    if (!collaboratorId) return setError('Selecione um colaborador.')
    if (!salarioBase || salNum <= 0) return setError('Informe o salário base.')
    if (!vigenciaInicio) return setError('Informe o início da vigência.')

    try {
      if (isEdit) {
        await updateMut.mutateAsync({
          id: initial.id,
          cargo: cargo || undefined,
          salarioBase: salNum,
          encargos: encNum,
          vigenciaInicio: new Date(vigenciaInicio + 'T12:00:00'),
          vigenciaFim: vigenciaFim ? new Date(vigenciaFim + 'T12:00:00') : null,
          observacao: observacao || null,
        })
      } else {
        await createMut.mutateAsync({
          collaboratorId,
          cargo: cargo || undefined,
          salarioBase: salNum,
          encargos: encNum,
          vigenciaInicio: new Date(vigenciaInicio + 'T12:00:00'),
          vigenciaFim: vigenciaFim ? new Date(vigenciaFim + 'T12:00:00') : undefined,
          observacao: observacao || undefined,
        })
      }
      onSaved()
      onClose()
    } catch (e: any) {
      setError(e?.message ?? 'Erro ao salvar.')
    }
  }

  const loading = createMut.isPending || updateMut.isPending

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{ background: 'white', borderRadius: '16px', width: '100%', maxWidth: '540px', padding: '28px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: '700', color: '#0f172a', margin: 0 }}>
            {isEdit ? 'Editar Registro' : 'Novo Salário / Encargo'}
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '22px', cursor: 'pointer', color: '#94a3b8' }}>×</button>
        </div>

        <div style={{ display: 'grid', gap: '14px' }}>
          {/* Colaborador */}
          {!isEdit && (
            <div>
              <label style={labelStyle}>Colaborador *</label>
              <select value={collaboratorId} onChange={e => setCollaboratorId(e.target.value)} style={inputStyle}>
                <option value="">Selecione...</option>
                {collaborators.map((c: any) => (
                  <option key={c.id} value={c.id}>{c.name}{c.role ? ` — ${c.role}` : ''}</option>
                ))}
              </select>
            </div>
          )}

          {/* Cargo */}
          <div>
            <label style={labelStyle}>Cargo / Função</label>
            <input value={cargo} onChange={e => setCargo(e.target.value)} placeholder="Ex: Auditora Sênior" style={inputStyle} />
          </div>

          {/* Salário + Encargos */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={labelStyle}>Salário Base (R$) *</label>
              <input type="number" min="0" step="0.01" value={salarioBase} onChange={e => setSalarioBase(e.target.value)} placeholder="0,00" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Encargos (R$)</label>
              <input type="number" min="0" step="0.01" value={encargos} onChange={e => setEncargos(e.target.value)} placeholder="0,00" style={inputStyle} />
            </div>
          </div>

          {/* Custo total calculado */}
          {(salNum > 0 || encNum > 0) && (
            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '10px', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '13px', color: '#166534', fontWeight: '600' }}>Custo mensal total</span>
              <span style={{ fontSize: '18px', fontWeight: '800', color: '#15803d' }}>{formatCurrency(total)}</span>
            </div>
          )}

          {/* Vigência */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={labelStyle}>Vigência Início *</label>
              <input type="date" value={vigenciaInicio} onChange={e => setVigenciaInicio(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Vigência Fim</label>
              <input type="date" value={vigenciaFim} onChange={e => setVigenciaFim(e.target.value)} style={inputStyle} />
              <p style={{ fontSize: '11px', color: '#94a3b8', marginTop: '3px' }}>Deixe em branco se ainda vigente</p>
            </div>
          </div>

          {/* Observação */}
          <div>
            <label style={labelStyle}>Observação</label>
            <textarea value={observacao} onChange={e => setObservacao(e.target.value)} rows={2} placeholder="Informações adicionais..." style={{ ...inputStyle, resize: 'vertical' }} />
          </div>

          {error && (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', borderRadius: '8px', padding: '10px 14px', fontSize: '13px' }}>{error}</div>
          )}

          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '4px' }}>
            <button onClick={onClose} style={{ padding: '10px 20px', borderRadius: '10px', border: '1.5px solid #e2e8f0', background: 'white', cursor: 'pointer', fontSize: '14px', fontWeight: '500' }}>Cancelar</button>
            <button onClick={handleSave} disabled={loading} style={{ padding: '10px 24px', borderRadius: '10px', border: 'none', background: loading ? '#94a3b8' : '#2563eb', color: 'white', cursor: loading ? 'not-allowed' : 'pointer', fontSize: '14px', fontWeight: '700' }}>
              {loading ? 'Salvando...' : isEdit ? 'Salvar Alterações' : 'Cadastrar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Estilos inline compartilhados ─────────────────────────────────────────────

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '12px', fontWeight: '600', color: '#374151',
  marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.04em',
}
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1.5px solid #e2e8f0',
  fontSize: '14px', boxSizing: 'border-box', background: 'white', outline: 'none',
}

// ── Página principal ──────────────────────────────────────────────────────────

export default function SalariosPage() {
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL')
  const [filterCollabs, setFilterCollabs] = useState<string[]>([])
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [confirmDelete, setConfirmDelete] = useState<any>(null)
  const [confirmInactivate, setConfirmInactivate] = useState<any>(null)

  const utils = trpc.useUtils()

  // Busca todos e filtra client-side para suportar multi-select
  const { data: listData, isLoading } = trpc.auditCollaboratorSalaries.list.useQuery({
    pageSize: 500,
    status: filterStatus === 'ALL' ? undefined : filterStatus,
    search: search || undefined,
  })
  const { data: collabsRaw } = trpc.auditCollaborators.list.useQuery()
  const collaborators: any[] = (collabsRaw as any[]) ?? []

  const deleteMut = trpc.auditCollaboratorSalaries.delete.useMutation()
  const inactivateMut = trpc.auditCollaboratorSalaries.inactivate.useMutation()

  function refresh() { utils.auditCollaboratorSalaries.list.invalidate() }

  const allItems: any[] = listData?.items ?? []

  // Aplica filtro de colaboradores client-side
  const items = useMemo(() =>
    filterCollabs.length === 0
      ? allItems
      : allItems.filter(i => filterCollabs.includes(i.collaboratorId)),
    [allItems, filterCollabs]
  )

  const collabOptions = useMemo(
    () => collaborators.map((c: any) => ({ value: c.id, label: c.name + (c.role ? ` — ${c.role}` : '') })),
    [collaborators]
  )

  // KPIs — sempre sobre todos os ativos (sem filtro de collab, para não distorcer)
  const activeItems = useMemo(() => allItems.filter(i => i.status === 'ACTIVE'), [allItems])
  const totalMensalAtivo = useMemo(
    () => activeItems.reduce((s, i) => s + Number(i.salarioBase) + Number(i.encargos), 0),
    [activeItems]
  )
  const uniqueCollabsWithSalary = useMemo(
    () => new Set(activeItems.map(i => i.collaboratorId)).size,
    [activeItems]
  )

  // Colaboradores sem salário ativo
  const collabsWithActive = useMemo(() => new Set(activeItems.map(i => i.collaboratorId)), [activeItems])
  const collabsWithoutSalary = useMemo(
    () => collaborators.filter((c: any) => c.isActive && !collabsWithActive.has(c.id)),
    [collaborators, collabsWithActive]
  )

  async function handleDelete(item: any) {
    await deleteMut.mutateAsync({ id: item.id })
    setConfirmDelete(null)
    refresh()
  }

  async function handleInactivate(item: any) {
    await inactivateMut.mutateAsync({ id: item.id })
    setConfirmInactivate(null)
    refresh()
  }

  return (
    <ModulePage
      title="Salários e Encargos"
      description="Cadastro de custo mensal de pessoal por colaborador"
    >
      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '12px' }}>
        <KpiCard icon="💰" label="Custo Mensal Ativo" value={formatCurrency(totalMensalAtivo)} sub={`${activeItems.length} registro(s)`} />
        <KpiCard icon="👥" label="Colaboradores c/ Salário" value={String(uniqueCollabsWithSalary)} sub="registros ativos" />
        <KpiCard icon="⚠️" label="Sem Cadastro Ativo" value={String(collabsWithoutSalary.length)} sub="colaboradores ativos" color="#dc2626" />
      </div>

      {/* Alerta de colaboradores sem salário */}
      {collabsWithoutSalary.length > 0 && (
        <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '12px', padding: '14px 18px' }}>
          <p style={{ fontSize: '13px', fontWeight: '600', color: '#92400e', margin: '0 0 6px' }}>
            ⚠️ Colaboradores ativos sem salário cadastrado ({collabsWithoutSalary.length}):
          </p>
          <p style={{ fontSize: '13px', color: '#78350f', margin: 0 }}>
            {collabsWithoutSalary.map((c: any) => c.name).join(', ')}
          </p>
        </div>
      )}

      {/* Filtros + botão */}
      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por nome..."
          style={{ ...inputStyle, maxWidth: '200px' }}
        />
        <MultiSelectDropdown
          options={collabOptions}
          selected={filterCollabs}
          onChange={setFilterCollabs}
          placeholder="Todos os colaboradores"
        />
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as any)} style={{ ...inputStyle, maxWidth: '160px' }}>
          <option value="ALL">Todos os status</option>
          <option value="ACTIVE">Ativos</option>
          <option value="INACTIVE">Inativos</option>
        </select>
        <button
          onClick={() => { setEditing(null); setShowModal(true) }}
          style={{ marginLeft: 'auto', padding: '10px 20px', borderRadius: '10px', border: 'none', background: '#2563eb', color: 'white', cursor: 'pointer', fontSize: '14px', fontWeight: '700', whiteSpace: 'nowrap' }}
        >
          + Novo Registro
        </button>
      </div>

      {/* Tabela */}
      <div style={{ background: 'white', borderRadius: '14px', border: '1px solid #f1f5f9', overflow: 'hidden' }}>
        {isLoading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>Carregando...</div>
        ) : items.length === 0 ? (
          <div style={{ padding: '48px', textAlign: 'center', color: '#94a3b8' }}>
            <div style={{ fontSize: '32px', marginBottom: '12px' }}>💰</div>
            <div style={{ fontWeight: '600', marginBottom: '4px' }}>Nenhum registro encontrado</div>
            <div style={{ fontSize: '13px' }}>Cadastre salários para que apareçam aqui.</div>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #f1f5f9' }}>
                {['Colaborador', 'Cargo', 'Salário Base', 'Encargos', 'Custo Total', 'Vigência', 'Status', 'Ações'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: '11px', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((item: any, idx: number) => {
                const sal = Number(item.salarioBase)
                const enc = Number(item.encargos)
                const tot = custoTotal(sal, enc)
                const isActive = item.status === 'ACTIVE'
                return (
                  <tr key={item.id} style={{ borderBottom: '1px solid #f8fafc', background: idx % 2 === 0 ? 'white' : '#fafafa' }}>
                    <td style={tdStyle}>
                      <div style={{ fontWeight: '600', color: '#0f172a', fontSize: '13px' }}>{item.collaborator?.name ?? '—'}</div>
                    </td>
                    <td style={tdStyle}><span style={{ fontSize: '13px', color: '#374151' }}>{item.cargo || '—'}</span></td>
                    <td style={tdStyle}><span style={{ fontSize: '13px', fontWeight: '600', color: '#0f172a' }}>{formatCurrency(sal)}</span></td>
                    <td style={tdStyle}><span style={{ fontSize: '13px', color: '#374151' }}>{formatCurrency(enc)}</span></td>
                    <td style={tdStyle}><span style={{ fontSize: '14px', fontWeight: '800', color: '#15803d' }}>{formatCurrency(tot)}</span></td>
                    <td style={tdStyle}>
                      <span style={{ fontSize: '12px', color: '#374151' }}>
                        {fmt(item.vigenciaInicio)}{item.vigenciaFim ? ` → ${fmt(item.vigenciaFim)}` : ' → em aberto'}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      <span style={{
                        fontSize: '11px', fontWeight: '700', padding: '3px 10px', borderRadius: '20px',
                        background: isActive ? '#dcfce7' : '#f3f4f6',
                        color: isActive ? '#166534' : '#6b7280',
                      }}>
                        {isActive ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          onClick={() => { setEditing(item); setShowModal(true) }}
                          style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid #e2e8f0', background: 'white', cursor: 'pointer', fontSize: '12px', fontWeight: '600', color: '#374151' }}
                        >
                          Editar
                        </button>
                        {isActive && (
                          <button
                            onClick={() => setConfirmInactivate(item)}
                            style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid #fde68a', background: '#fffbeb', cursor: 'pointer', fontSize: '12px', fontWeight: '600', color: '#92400e' }}
                          >
                            Inativar
                          </button>
                        )}
                        <button
                          onClick={() => setConfirmDelete(item)}
                          style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid #fecaca', background: '#fef2f2', cursor: 'pointer', fontSize: '12px', fontWeight: '600', color: '#dc2626' }}
                        >
                          Excluir
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal de cadastro/edição */}
      {showModal && (
        <SalarioModal
          initial={editing}
          collaborators={collaborators}
          onClose={() => { setShowModal(false); setEditing(null) }}
          onSaved={refresh}
        />
      )}

      {/* Confirm inativar */}
      {confirmInactivate && (
        <ConfirmDialog
          title="Inativar registro"
          message={`Inativar o salário de ${confirmInactivate.collaborator?.name}? Ele não será mais considerado no dashboard.`}
          confirmLabel="Inativar"
          confirmColor="#92400e"
          onConfirm={() => handleInactivate(confirmInactivate)}
          onCancel={() => setConfirmInactivate(null)}
        />
      )}

      {/* Confirm excluir */}
      {confirmDelete && (
        <ConfirmDialog
          title="Excluir registro"
          message={`Excluir permanentemente o registro de ${confirmDelete.collaborator?.name}? Esta ação não pode ser desfeita.`}
          confirmLabel="Excluir"
          confirmColor="#dc2626"
          onConfirm={() => handleDelete(confirmDelete)}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </ModulePage>
  )
}

// ── Sub-componentes ───────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, icon, color }: { label: string; value: string; sub?: string; icon: string; color?: string }) {
  return (
    <div style={{ background: 'white', borderRadius: '14px', padding: '18px 20px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '1px solid #f1f5f9' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>{label}</div>
          <div style={{ fontSize: '22px', fontWeight: '800', color: color ?? '#0f172a' }}>{value}</div>
          {sub && <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>{sub}</div>}
        </div>
        <span style={{ fontSize: '26px', opacity: 0.8 }}>{icon}</span>
      </div>
    </div>
  )
}

function ConfirmDialog({ title, message, confirmLabel, confirmColor, onConfirm, onCancel }: {
  title: string; message: string; confirmLabel: string; confirmColor: string
  onConfirm: () => void; onCancel: () => void
}) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: 'white', borderRadius: '16px', width: '100%', maxWidth: '420px', padding: '28px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
        <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#0f172a', margin: '0 0 12px' }}>{title}</h3>
        <p style={{ fontSize: '14px', color: '#374151', margin: '0 0 24px', lineHeight: 1.6 }}>{message}</p>
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button onClick={onCancel} style={{ padding: '10px 20px', borderRadius: '10px', border: '1.5px solid #e2e8f0', background: 'white', cursor: 'pointer', fontSize: '14px', fontWeight: '500' }}>Cancelar</button>
          <button onClick={onConfirm} style={{ padding: '10px 20px', borderRadius: '10px', border: 'none', background: confirmColor, color: 'white', cursor: 'pointer', fontSize: '14px', fontWeight: '700' }}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  )
}

const tdStyle: React.CSSProperties = {
  padding: '11px 14px', verticalAlign: 'middle',
}
