'use client'

export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { trpc } from '@/lib/trpc'
import { CDE_OFFICIAL_CATEGORIES, CDE_CATEGORY_LABELS, CDE_NATURE_LABELS } from '@/modules/cde/constants'
import { CdeTabs, Card, CategoryBadge, Pill, selectStyle } from '../_components'

const FIELD_LABELS: Record<string, string> = {
  movimentacao: 'Movimentação', movimento: 'Movimento', descricao: 'Descrição', lancamento: 'Lançamento',
}
const MATCH_LABELS: Record<string, string> = {
  CONTAINS: 'Contém', EQUALS: 'Igual a', STARTS_WITH: 'Começa com', REGEX: 'Regex',
}

const EMPTY = { priority: 100, field: 'movimentacao', matchType: 'CONTAINS', pattern: '', natureFilter: '', category: 'OUTRAS_SAIDAS', description: '' }

export default function CdeParametrizacaoPage() {
  const caps = trpc.cde.myCapabilities.useQuery()
  const { data: rules, isLoading, refetch } = trpc.cde.rulesList.useQuery()
  const utils = trpc.useUtils()
  const create = trpc.cde.ruleCreate.useMutation()
  const update = trpc.cde.ruleUpdate.useMutation()
  const del = trpc.cde.ruleDelete.useMutation()

  const [form, setForm] = useState<any>(EMPTY)
  const [editingId, setEditingId] = useState<string | null>(null)

  const isAdmin = caps.data?.canReclassify

  async function save() {
    try {
      const payload = {
        priority: Number(form.priority), field: form.field, matchType: form.matchType,
        pattern: form.pattern, category: form.category,
        natureFilter: form.natureFilter || undefined,
        description: form.description || undefined,
      }
      if (editingId) await update.mutateAsync({ id: editingId, ...payload })
      else await create.mutateAsync(payload as any)
      setForm(EMPTY); setEditingId(null)
      await refetch(); utils.cde.dashboard.invalidate()
    } catch (e: any) { alert(e.message) }
  }

  async function remove(id: string) {
    if (!confirm('Excluir esta regra?')) return
    try { await del.mutateAsync({ id }); await refetch() } catch (e: any) { alert(e.message) }
  }

  function edit(r: any) {
    setEditingId(r.id)
    setForm({ priority: r.priority, field: r.field, matchType: r.matchType, pattern: r.pattern, natureFilter: r.natureFilter ?? '', category: r.category, description: r.description ?? '' })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div>
        <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#0f172a', margin: '0 0 4px' }}>Parametrização — CDE</h1>
        <p style={{ fontSize: '14px', color: '#64748b', margin: 0 }}>
          Regras que mapeiam movimentos brutos para as categorias gerenciais. Avaliadas por prioridade (menor primeiro);
          a primeira correspondência vence. Sem correspondência → Pendente de Parametrização.
        </p>
      </div>
      <CdeTabs />

      {!isAdmin && (
        <Card style={{ padding: '16px', background: '#fff7ed', border: '1px solid #fed7aa', color: '#9a3412' }}>
          Apenas o Administrador pode criar ou alterar regras de classificação. Você pode visualizar as regras vigentes.
        </Card>
      )}

      {isAdmin && (
        <Card style={{ padding: '20px' }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 600 }}>{editingId ? 'Editar regra' : 'Nova regra'}</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
            <Field label="Prioridade">
              <input type="number" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} style={selectStyle()} />
            </Field>
            <Field label="Campo">
              <select value={form.field} onChange={(e) => setForm({ ...form, field: e.target.value })} style={selectStyle()}>
                {Object.entries(FIELD_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </Field>
            <Field label="Comparação">
              <select value={form.matchType} onChange={(e) => setForm({ ...form, matchType: e.target.value })} style={selectStyle()}>
                {Object.entries(MATCH_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </Field>
            <Field label="Padrão (texto)">
              <input value={form.pattern} onChange={(e) => setForm({ ...form, pattern: e.target.value })} style={selectStyle()} placeholder="ex.: transfer" />
            </Field>
            <Field label="Filtro de natureza (opcional)">
              <select value={form.natureFilter} onChange={(e) => setForm({ ...form, natureFilter: e.target.value })} style={selectStyle()}>
                <option value="">Qualquer</option>
                {Object.entries(CDE_NATURE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </Field>
            <Field label="Categoria">
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} style={selectStyle()}>
                {CDE_OFFICIAL_CATEGORIES.map((c) => <option key={c} value={c}>{CDE_CATEGORY_LABELS[c]}</option>)}
              </select>
            </Field>
          </div>
          <div style={{ marginTop: 12 }}>
            <Field label="Descrição (opcional)">
              <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} style={{ ...selectStyle(), width: '100%', boxSizing: 'border-box' }} />
            </Field>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <button onClick={save} disabled={!form.pattern || create.isLoading || update.isLoading} style={{ ...btnPrimary, opacity: !form.pattern ? 0.5 : 1 }}>
              {editingId ? 'Salvar alterações' : 'Adicionar regra'}
            </button>
            {editingId && <button onClick={() => { setEditingId(null); setForm(EMPTY) }} style={btnOutline}>Cancelar</button>}
          </div>
        </Card>
      )}

      <Card style={{ overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid #f1f5f9' }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Regras cadastradas</h3>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: '#94a3b8' }}>
            Além destas, há regras-padrão embutidas (vendas, transferências, NF, trocas, GDV/perdas) aplicadas como fallback.
          </p>
        </div>
        {isLoading ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>Carregando…</div>
        ) : !rules?.length ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>Nenhuma regra personalizada. As regras-padrão estão ativas.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                  {['Prior.', 'Campo', 'Comparação', 'Padrão', 'Natureza', 'Categoria', 'Ativa', isAdmin ? 'Ações' : ''].map((h) => <th key={h} style={thS}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {rules.map((r: any) => (
                  <tr key={r.id} style={{ borderBottom: '1px solid #f8fafc' }}>
                    <td style={tdS}>{r.priority}</td>
                    <td style={tdS}>{FIELD_LABELS[r.field] ?? r.field}</td>
                    <td style={tdS}>{MATCH_LABELS[r.matchType] ?? r.matchType}</td>
                    <td style={{ ...tdS, fontFamily: 'monospace', color: '#0f172a' }}>{r.pattern}</td>
                    <td style={tdS}>{r.natureFilter ? CDE_NATURE_LABELS[r.natureFilter] : '—'}</td>
                    <td style={tdS}><CategoryBadge category={r.category} /></td>
                    <td style={tdS}>{r.isActive ? <Pill bg="#dcfce7" text="#15803d">Sim</Pill> : <Pill bg="#f1f5f9" text="#64748b">Não</Pill>}</td>
                    {isAdmin && (
                      <td style={tdS}>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button onClick={() => edit(r)} style={btnSmall}>Editar</button>
                          <button onClick={() => remove(r.id)} style={{ ...btnSmall, background: '#fee2e2', color: '#dc2626' }}>Excluir</button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontSize: 12, fontWeight: 600, color: '#475569' }}>{label}</span>
      {children}
    </label>
  )
}

const thS: React.CSSProperties = { textAlign: 'left', padding: '9px 12px', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', whiteSpace: 'nowrap' }
const tdS: React.CSSProperties = { padding: '10px 12px', color: '#374151' }
const btnPrimary: React.CSSProperties = { padding: '9px 16px', borderRadius: 8, fontSize: 14, fontWeight: 600, background: '#2563eb', color: 'white', border: 'none', cursor: 'pointer' }
const btnOutline: React.CSSProperties = { padding: '9px 16px', borderRadius: 8, fontSize: 14, fontWeight: 500, background: 'white', color: '#374151', border: '1px solid #d1d5db', cursor: 'pointer' }
const btnSmall: React.CSSProperties = { padding: '5px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600, background: '#eff6ff', color: '#1d4ed8', border: 'none', cursor: 'pointer' }
