'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { trpc } from '@/lib/trpc'
import { ModulePage, DataCard, StatusBadge, EmptyState, LoadingState, Btn } from '@/components/shared/module-page'
import { formatDate, formatNumber } from '@/lib/utils'

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Rascunho', IN_PROGRESS: 'Em Andamento', COMPLETED: 'Concluída', CANCELLED: 'Cancelada',
}

const inp = { width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '14px', boxSizing: 'border-box' as const }

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ background: 'white', borderRadius: '16px', width: '100%', maxWidth: '480px', boxShadow: '0 25px 50px rgba(0,0,0,0.25)' }}>
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

export default function AuditRoundPage() {
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState('')
  const searchParams = useSearchParams()
  const [showCreate, setShowCreate] = useState(searchParams.get('new') === '1')
  const [storeId, setStoreId] = useState('')
  const [checklistVersionId, setChecklistVersionId] = useState('')
  const [scheduledAt, setScheduledAt] = useState('')
  const [error, setError] = useState('')

  const utils = trpc.useUtils()
  const { data, isLoading } = trpc.auditRound.list.useQuery({ page, pageSize: 15, status: (status as any) || undefined })
  const { data: checklists } = trpc.auditRound.listChecklists.useQuery()
  const { data: storesData } = trpc.stores.list.useQuery({ page: 1, pageSize: 100 })

  const createMut = trpc.auditRound.create.useMutation({
    onSuccess: () => { utils.auditRound.list.invalidate(); setShowCreate(false); setStoreId(''); setChecklistVersionId(''); setScheduledAt(''); setError('') },
    onError: e => setError(e.message),
  })

  function handleCreate() {
    if (!storeId || !checklistVersionId) { setError('Selecione a loja e o checklist.'); return }
    createMut.mutate({ storeId, checklistVersionId, scheduledAt: scheduledAt ? new Date(scheduledAt) : undefined })
  }

  const stores = storesData?.stores ?? []

  const versionOptions: { id: string; label: string }[] = []
  for (const c of (checklists ?? []) as any[]) {
    for (const v of (c.versions ?? [])) {
      versionOptions.push({ id: v.id, label: `${c.name} — v${v.version}` })
    }
  }

  return (
    <ModulePage
      title="Ronda de Auditoria"
      description="Auditorias presenciais em loja com checklist digital, pontuação e pendências automáticas"
      actions={<Btn onClick={() => { setShowCreate(true); setError('') }}>+ Nova Ronda</Btn>}
    >
      {showCreate && (
        <Modal title="Nova Ronda de Auditoria" onClose={() => { setShowCreate(false); setError('') }}>
          {error && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '10px 14px', marginBottom: '16px', fontSize: '13px', color: '#dc2626' }}>{error}</div>}
          <Field label="Loja *">
            <select style={inp} value={storeId} onChange={e => setStoreId(e.target.value)}>
              <option value="">Selecione a loja...</option>
              {stores.map((s: any) => <option key={s.id} value={s.id}>{s.code} — {s.name}</option>)}
            </select>
          </Field>
          <Field label="Checklist *">
            <select style={inp} value={checklistVersionId} onChange={e => setChecklistVersionId(e.target.value)}>
              <option value="">Selecione o checklist...</option>
              {versionOptions.map(v => <option key={v.id} value={v.id}>{v.label}</option>)}
            </select>
          </Field>
          <Field label="Data Agendada (opcional)">
            <input style={inp} type="datetime-local" value={scheduledAt} onChange={e => setScheduledAt(e.target.value)} />
          </Field>
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <Btn variant="outline" onClick={() => { setShowCreate(false); setError('') }}>Cancelar</Btn>
            <Btn onClick={handleCreate} disabled={createMut.isPending}>{createMut.isPending ? 'Criando...' : 'Criar Ronda'}</Btn>
          </div>
        </Modal>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: '16px' }}>
        <DataCard
          title="Rondas de Auditoria"
          action={
            <select value={status} onChange={e => { setStatus(e.target.value); setPage(1) }}
              style={{ padding: '6px 10px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '13px' }}>
              <option value="">Todos os status</option>
              {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          }
        >
          {isLoading ? <LoadingState /> : (
            !data?.rounds.length ? (
              <EmptyState icon="🔍" title="Nenhuma ronda registrada" description="Crie uma nova ronda de auditoria para começar." />
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #f1f5f9' }}>
                      {['Loja', 'Checklist', 'Data', 'Nota', 'Status'].map(h => (
                        <th key={h} style={{ textAlign: 'left', padding: '10px 12px', fontSize: '12px', fontWeight: '600', color: '#64748b' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.rounds.map((r: any) => (
                      <tr key={r.id} style={{ borderBottom: '1px solid #f8fafc', cursor: 'pointer' }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#f8fafc')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                        <td style={{ padding: '12px' }}><div style={{ fontWeight: '500' }}>{r.store?.name}</div><div style={{ fontSize: '12px', color: '#94a3b8' }}>{r.store?.code}</div></td>
                        <td style={{ padding: '12px', color: '#374151' }}>{r.checklistVersion?.template?.name || '—'}</td>
                        <td style={{ padding: '12px', color: '#374151' }}>{r.completedAt ? formatDate(r.completedAt) : r.scheduledAt ? formatDate(r.scheduledAt) : '—'}</td>
                        <td style={{ padding: '12px' }}>
                          {r.scorePercent != null ? (
                            <span style={{ fontWeight: '700', color: Number(r.scorePercent) >= 80 ? '#16a34a' : Number(r.scorePercent) >= 60 ? '#d97706' : '#dc2626' }}>
                              {formatNumber(Number(r.scorePercent), 1)}%
                            </span>
                          ) : '—'}
                        </td>
                        <td style={{ padding: '12px' }}><StatusBadge status={r.status} label={STATUS_LABELS[r.status] || r.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}
        </DataCard>

        <DataCard title="Checklists Disponíveis">
          {!checklists?.length ? (
            <EmptyState icon="📝" title="Sem checklists" description="Nenhum checklist cadastrado." />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {(checklists as any[]).map((c: any) => (
                <div key={c.id} style={{ padding: '12px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontWeight: '600', fontSize: '14px', color: '#0f172a' }}>{c.name}</div>
                  {c.description && <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>{c.description}</div>}
                  <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                    {c.versions?.[0] ? `v${c.versions[0].version}` : 'Sem versão ativa'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </DataCard>
      </div>
    </ModulePage>
  )
}
