'use client'

export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { trpc } from '@/lib/trpc'
import { ModulePage, DataCard, StatusBadge, EmptyState, LoadingState, Btn } from '@/components/shared/module-page'
import { formatDate, formatCurrency, formatNumber } from '@/lib/utils'

const STATUS_LABELS: Record<string, string> = {
  AWAITING_IMPORT: 'Aguardando Importação', IMPORTED: 'Importado',
  IN_ANALYSIS: 'Em Análise', IN_CLOSING: 'Em Fechamento',
  FINALIZED: 'Finalizado', REVISED: 'Revisado',
  CANCELLED: 'Cancelado', REOPENED: 'Reaberto',
}

const TYPE_LABELS: Record<string, string> = { FULL: 'Completo', PARTIAL: 'Parcial', CATEGORY: 'Por Categoria' }

const inp = { width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '14px', boxSizing: 'border-box' as const }

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ background: 'white', borderRadius: '16px', width: '100%', maxWidth: '520px', maxHeight: '90vh', overflow: 'auto', boxShadow: '0 25px 50px rgba(0,0,0,0.25)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', borderBottom: '1px solid #f1f5f9' }}>
          <h2 style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: '#0f172a' }}>{title}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '22px', cursor: 'pointer', color: '#94a3b8' }}>×</button>
        </div>
        <div style={{ padding: '24px' }}>{children}</div>
      </div>
    </div>
  )
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '16px' }}>
      <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: '#374151', marginBottom: '5px' }}>{label}</label>
      {children}
    </div>
  )
}

export default function InventoryPage() {
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [storeId, setStoreId] = useState('')
  const [inventoryType, setInventoryType] = useState<'FULL' | 'PARTIAL' | 'CATEGORY'>('FULL')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [period, setPeriod] = useState('')
  const [observations, setObservations] = useState('')
  const [error, setError] = useState('')

  const utils = trpc.useUtils()
  const { data, isLoading } = trpc.inventory.list.useQuery({ page, pageSize: 15, status: (status as any) || undefined })
  const { data: storesData } = trpc.stores.list.useQuery({ page: 1, pageSize: 100 })

  const createMut = trpc.inventory.create.useMutation({
    onSuccess: () => { utils.inventory.list.invalidate(); setShowCreate(false); setError('') },
    onError: e => setError(e.message),
  })

  function handleCreate() {
    if (!storeId || !date) { setError('Selecione a loja e informe a data.'); return }
    createMut.mutate({ storeId, inventoryType, date: new Date(date), period: period || undefined, observations: observations || undefined })
  }

  const stores = storesData?.stores ?? []

  return (
    <ModulePage
      title="Inventário"
      description="Gestão completa do ciclo de inventário: importação, análise, fechamento e histórico"
      actions={<Btn onClick={() => { setShowCreate(true); setError('') }}>+ Novo Inventário</Btn>}
    >
      {showCreate && (
        <Modal title="Novo Ciclo de Inventário" onClose={() => { setShowCreate(false); setError('') }}>
          {error && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '10px 14px', marginBottom: '16px', fontSize: '13px', color: '#dc2626' }}>{error}</div>}
          <Field label="Loja *">
            <select style={inp} value={storeId} onChange={e => setStoreId(e.target.value)}>
              <option value="">Selecione a loja...</option>
              {stores.map((s: any) => <option key={s.id} value={s.id}>{s.code} — {s.name}</option>)}
            </select>
          </Field>
          <Field label="Tipo de Inventário *">
            <select style={inp} value={inventoryType} onChange={e => setInventoryType(e.target.value as any)}>
              <option value="FULL">Completo</option>
              <option value="PARTIAL">Parcial</option>
              <option value="CATEGORY">Por Categoria</option>
            </select>
          </Field>
          <Field label="Data do Inventário *">
            <input style={inp} type="date" value={date} onChange={e => setDate(e.target.value)} />
          </Field>
          <Field label="Período (ex: 2024-01)">
            <input style={inp} value={period} onChange={e => setPeriod(e.target.value)} placeholder="YYYY-MM" />
          </Field>
          <Field label="Observações">
            <textarea style={{ ...inp, minHeight: '80px', resize: 'vertical' }} value={observations} onChange={e => setObservations(e.target.value)} />
          </Field>
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <Btn variant="outline" onClick={() => { setShowCreate(false); setError('') }}>Cancelar</Btn>
            <Btn onClick={handleCreate} disabled={createMut.isPending}>{createMut.isPending ? 'Criando...' : 'Criar Inventário'}</Btn>
          </div>
        </Modal>
      )}
      <DataCard
        title={`Inventários (${data?.meta?.total ?? 0} registros)`}
        action={
          <select value={status} onChange={e => { setStatus(e.target.value); setPage(1) }}
            style={{ padding: '6px 10px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '13px' }}>
            <option value="">Todos os status</option>
            {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        }
      >
        {isLoading ? <LoadingState /> : (
          !data?.cycles.length ? (
            <EmptyState icon="📦" title="Nenhum inventário encontrado" description="Crie ou importe um inventário para começar." />
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #f1f5f9' }}>
                    {['Loja', 'Data', 'Tipo', 'Ciclo', 'Qtd Esperada', 'Qtd Apurada', 'Perda Financeira', '% Perda', 'Status'].map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '10px 12px', fontSize: '12px', fontWeight: '600', color: '#64748b', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.cycles.map((c: any) => (
                    <tr key={c.id} style={{ borderBottom: '1px solid #f8fafc', cursor: 'pointer' }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#f8fafc')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      <td style={{ padding: '12px' }}>
                        <div style={{ fontWeight: '500', color: '#0f172a' }}>{c.store?.name}</div>
                        <div style={{ fontSize: '12px', color: '#94a3b8' }}>{c.store?.code} · {c.store?.region?.name}</div>
                      </td>
                      <td style={{ padding: '12px', color: '#374151' }}>{formatDate(c.date)}</td>
                      <td style={{ padding: '12px', color: '#64748b' }}>{c.inventoryType}</td>
                      <td style={{ padding: '12px', textAlign: 'center', fontWeight: '600', color: '#2563eb' }}>{c.cycleNumber}</td>
                      <td style={{ padding: '12px', color: '#374151' }}>{c.expectedQty ? formatNumber(Number(c.expectedQty), 0) : '—'}</td>
                      <td style={{ padding: '12px', color: '#374151' }}>{c.countedQty ? formatNumber(Number(c.countedQty), 0) : '—'}</td>
                      <td style={{ padding: '12px', fontWeight: '700', color: Number(c.lossValue) > 0 ? '#dc2626' : '#16a34a' }}>
                        {c.lossValue ? formatCurrency(Number(c.lossValue)) : '—'}
                      </td>
                      <td style={{ padding: '12px', fontWeight: '600', color: Number(c.lossPercent) > 2 ? '#dc2626' : Number(c.lossPercent) > 1 ? '#d97706' : '#16a34a' }}>
                        {c.lossPercent ? formatNumber(Number(c.lossPercent), 2) + '%' : '—'}
                      </td>
                      <td style={{ padding: '12px' }}><StatusBadge status={c.status} label={STATUS_LABELS[c.status] || c.status} /></td>
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
