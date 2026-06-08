'use client'

export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { trpc } from '@/lib/trpc'
import { ModulePage, DataCard, StatusBadge, EmptyState, LoadingState, Btn } from '@/components/shared/module-page'
import { formatDate, formatCurrency } from '@/lib/utils'

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Ativo', TRANSFERRED: 'Transferido', MAINTENANCE: 'Manutenção',
  WRITTEN_OFF: 'Baixado', LOST: 'Extraviado', DIVERGENT: 'Divergente', UNDER_REVIEW: 'Em Conferência',
}

const CATEGORIES = ['Equipamento de TI', 'Mobiliário', 'Equipamento de Refrigeração', 'Equipamento de Segurança', 'Veículo', 'Ferramenta', 'Outro']

type AssetForm = {
  assetCode: string; description: string; category: string; subcategory: string
  brand: string; model: string; serialNumber: string; storeId: string
  acquisitionDate: string; acquisitionValue: string; usefulLifeYears: string
  location: string; noteNumber: string
}
const emptyForm = (): AssetForm => ({
  assetCode: '', description: '', category: '', subcategory: '', brand: '', model: '',
  serialNumber: '', storeId: '', acquisitionDate: '', acquisitionValue: '',
  usefulLifeYears: '', location: '', noteNumber: '',
})

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ background: 'white', borderRadius: '16px', width: '100%', maxWidth: '620px', maxHeight: '92vh', overflow: 'auto', boxShadow: '0 25px 50px rgba(0,0,0,0.25)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', borderBottom: '1px solid #f1f5f9', position: 'sticky', top: 0, background: 'white', zIndex: 1 }}>
          <h2 style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: '#0f172a' }}>{title}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '22px', cursor: 'pointer', color: '#94a3b8', lineHeight: 1 }}>×</button>
        </div>
        <div style={{ padding: '24px' }}>{children}</div>
      </div>
    </div>
  )
}

const inp = { width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '14px', boxSizing: 'border-box' as const }
function Row({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>{children}</div>
}
function Field({ label, children, w }: { label: string; children: React.ReactNode; w?: string }) {
  return (
    <div style={{ marginBottom: '14px', flex: w || '1 1 200px', minWidth: '140px' }}>
      <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: '#374151', marginBottom: '5px' }}>{label}</label>
      {children}
    </div>
  )
}

export default function AssetsPage() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState<AssetForm>(emptyForm())
  const [error, setError] = useState('')

  const utils = trpc.useUtils()
  const { data, isLoading } = trpc.assets.list.useQuery({ page, pageSize: 15, search: search || undefined, status: (status as any) || undefined })
  const { data: storesData } = trpc.stores.list.useQuery({ page: 1, pageSize: 100 })

  const createMut = trpc.assets.create.useMutation({
    onSuccess: () => { utils.assets.list.invalidate(); setShowCreate(false); setForm(emptyForm()); setError('') },
    onError: e => setError(e.message),
  })

  function set(k: keyof AssetForm, v: string) { setForm(f => ({ ...f, [k]: v })) }

  function handleCreate() {
    if (!form.assetCode || !form.description || !form.category || !form.storeId) {
      setError('Preencha: Código, Descrição, Categoria e Loja.')
      return
    }
    createMut.mutate({
      assetCode: form.assetCode,
      description: form.description,
      category: form.category,
      subcategory: form.subcategory || undefined,
      brand: form.brand || undefined,
      model: form.model || undefined,
      serialNumber: form.serialNumber || undefined,
      storeId: form.storeId,
      acquisitionDate: form.acquisitionDate ? new Date(form.acquisitionDate) : undefined,
      acquisitionValue: form.acquisitionValue ? Number(form.acquisitionValue) : undefined,
      usefulLifeYears: form.usefulLifeYears ? Number(form.usefulLifeYears) : undefined,
      location: form.location || undefined,
      noteNumber: form.noteNumber || undefined,
    })
  }

  const stores = storesData?.stores ?? []

  return (
    <ModulePage
      title="Controle de Patrimônio"
      description="Gerenciamento de ativos patrimoniais com rastreabilidade completa de movimentações"
      actions={<Btn onClick={() => { setShowCreate(true); setForm(emptyForm()); setError('') }}>+ Novo Ativo</Btn>}
    >
      {showCreate && (
        <Modal title="Cadastrar Novo Ativo" onClose={() => { setShowCreate(false); setError('') }}>
          {error && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '10px 14px', marginBottom: '16px', fontSize: '13px', color: '#dc2626' }}>{error}</div>}

          <div style={{ background: '#f8fafc', borderRadius: '10px', padding: '12px 16px', marginBottom: '16px', fontSize: '13px', color: '#374151', fontWeight: '500' }}>Identificação</div>
          <Row>
            <Field label="Código do Ativo *"><input style={inp} value={form.assetCode} onChange={e => set('assetCode', e.target.value)} placeholder="PAT-001" /></Field>
            <Field label="Nº da Nota Fiscal"><input style={inp} value={form.noteNumber} onChange={e => set('noteNumber', e.target.value)} /></Field>
          </Row>
          <Field label="Descrição *" w="100%"><input style={inp} value={form.description} onChange={e => set('description', e.target.value)} placeholder="Ex: Notebook Dell Latitude 5540" /></Field>
          <Row>
            <Field label="Categoria *">
              <select style={inp} value={form.category} onChange={e => set('category', e.target.value)}>
                <option value="">Selecione...</option>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Subcategoria"><input style={inp} value={form.subcategory} onChange={e => set('subcategory', e.target.value)} /></Field>
          </Row>

          <div style={{ background: '#f8fafc', borderRadius: '10px', padding: '12px 16px', margin: '8px 0 16px', fontSize: '13px', color: '#374151', fontWeight: '500' }}>Localização</div>
          <Field label="Loja *" w="100%">
            <select style={inp} value={form.storeId} onChange={e => set('storeId', e.target.value)}>
              <option value="">Selecione a loja...</option>
              {stores.map((s: any) => <option key={s.id} value={s.id}>{s.code} — {s.name}</option>)}
            </select>
          </Field>
          <Field label="Local/Setor" w="100%"><input style={inp} value={form.location} onChange={e => set('location', e.target.value)} placeholder="Ex: Sala de TI, Caixa 1" /></Field>

          <div style={{ background: '#f8fafc', borderRadius: '10px', padding: '12px 16px', margin: '8px 0 16px', fontSize: '13px', color: '#374151', fontWeight: '500' }}>Especificações</div>
          <Row>
            <Field label="Marca"><input style={inp} value={form.brand} onChange={e => set('brand', e.target.value)} /></Field>
            <Field label="Modelo"><input style={inp} value={form.model} onChange={e => set('model', e.target.value)} /></Field>
            <Field label="Nº de Série"><input style={inp} value={form.serialNumber} onChange={e => set('serialNumber', e.target.value)} /></Field>
          </Row>

          <div style={{ background: '#f8fafc', borderRadius: '10px', padding: '12px 16px', margin: '8px 0 16px', fontSize: '13px', color: '#374151', fontWeight: '500' }}>Dados Financeiros</div>
          <Row>
            <Field label="Data de Aquisição"><input style={inp} type="date" value={form.acquisitionDate} onChange={e => set('acquisitionDate', e.target.value)} /></Field>
            <Field label="Valor de Aquisição (R$)"><input style={inp} type="number" step="0.01" min="0" value={form.acquisitionValue} onChange={e => set('acquisitionValue', e.target.value)} placeholder="0,00" /></Field>
            <Field label="Vida Útil (anos)"><input style={inp} type="number" min="1" max="50" value={form.usefulLifeYears} onChange={e => set('usefulLifeYears', e.target.value)} /></Field>
          </Row>

          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '8px' }}>
            <Btn variant="outline" onClick={() => { setShowCreate(false); setError('') }}>Cancelar</Btn>
            <Btn onClick={handleCreate} disabled={createMut.isPending}>
              {createMut.isPending ? 'Cadastrando...' : 'Cadastrar Ativo'}
            </Btn>
          </div>
        </Modal>
      )}

      <DataCard
        title={`Ativos Patrimoniais (${data?.meta?.total ?? 0} registros)`}
        action={
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              placeholder="Buscar código, descrição..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1) }}
              style={{ padding: '6px 12px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '13px', width: '200px' }}
            />
            <select value={status} onChange={e => { setStatus(e.target.value); setPage(1) }}
              style={{ padding: '6px 10px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '13px' }}>
              <option value="">Todos os status</option>
              {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
        }
      >
        {isLoading ? <LoadingState /> : (
          !data?.assets.length ? (
            <EmptyState icon="🏷️" title="Nenhum ativo encontrado" description="Cadastre ou importe ativos para visualizá-los aqui." />
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #f1f5f9' }}>
                    {['Código', 'Descrição', 'Categoria', 'Loja', 'Valor Aquis.', 'Status'].map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '10px 12px', fontSize: '12px', fontWeight: '600', color: '#64748b', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.assets.map((a: any) => (
                    <tr key={a.id} style={{ borderBottom: '1px solid #f8fafc', cursor: 'pointer' }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#f8fafc')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      <td style={{ padding: '12px', fontFamily: 'monospace', fontSize: '13px', fontWeight: '600', color: '#2563eb' }}>{a.assetCode}</td>
                      <td style={{ padding: '12px' }}>
                        <div style={{ fontWeight: '500', color: '#0f172a' }}>{a.description}</div>
                        {(a.brand || a.model) && <div style={{ fontSize: '12px', color: '#94a3b8' }}>{[a.brand, a.model].filter(Boolean).join(' ')}</div>}
                      </td>
                      <td style={{ padding: '12px', color: '#64748b' }}>{a.category}</td>
                      <td style={{ padding: '12px' }}><div style={{ fontWeight: '500' }}>{a.store?.name}</div><div style={{ fontSize: '12px', color: '#94a3b8' }}>{a.store?.code}</div></td>
                      <td style={{ padding: '12px', color: '#374151' }}>{a.acquisitionValue ? formatCurrency(Number(a.acquisitionValue)) : '—'}</td>
                      <td style={{ padding: '12px' }}><StatusBadge status={a.status} label={STATUS_LABELS[a.status] || a.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {(data.meta?.totalPages ?? 0) > 1 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #f1f5f9' }}>
                  <span style={{ fontSize: '13px', color: '#64748b' }}>Página {data.meta.page} de {data.meta.totalPages}</span>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <Btn variant="outline" small disabled={!data.meta.hasPrev} onClick={() => setPage(p => p - 1)}>← Anterior</Btn>
                    <Btn variant="outline" small disabled={!data.meta.hasNext} onClick={() => setPage(p => p + 1)}>Próxima →</Btn>
                  </div>
                </div>
              )}
            </div>
          )
        )}
      </DataCard>
    </ModulePage>
  )
}
