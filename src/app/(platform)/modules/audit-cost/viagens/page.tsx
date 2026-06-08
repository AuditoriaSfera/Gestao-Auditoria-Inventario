'use client'

export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { trpc } from '@/lib/trpc'
import { ModulePage, DataCard, EmptyState, LoadingState, Btn } from '@/components/shared/module-page'
import { formatDate, formatCurrency } from '@/lib/utils'

const STATUS_LABELS: Record<string, string> = { OPEN: 'Aberta', CLOSED: 'Fechada', CANCELLED: 'Cancelada' }
const COST_CENTERS = ['Alimentação','Hospedagem','Combustível','Pedágio','Estacionamento','Passagem','Aluguel de carro','Carro de aplicativo','Outros']
const PAYMENT_METHODS = ['Adiantamento','Cartão Bruno','Cartão Combustível','Pix','Dinheiro','Reembolso']

const inp = { width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1.5px solid #e2e8f0', fontSize: '15px', boxSizing: 'border-box' as const }

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{ background: 'white', borderRadius: '16px', width: '100%', maxWidth: '560px', maxHeight: '92vh', overflow: 'auto', boxShadow: '0 25px 50px rgba(0,0,0,0.25)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', borderBottom: '1px solid #f1f5f9', position: 'sticky', top: 0, background: 'white' }}>
          <h2 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: '#0f172a' }}>{title}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#94a3b8', lineHeight: 1 }}>×</button>
        </div>
        <div style={{ padding: '24px' }}>{children}</div>
      </div>
    </div>
  )
}
function Field({ label, children, hint, row }: { label: string; children: React.ReactNode; hint?: string; row?: boolean }) {
  return (
    <div style={{ marginBottom: '14px', flex: row ? '1 1 45%' : undefined }}>
      <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '5px' }}>{label}</label>
      {children}
      {hint && <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '3px' }}>{hint}</div>}
    </div>
  )
}

type TripForm = { collaboratorId: string; stores: string; city: string; state: string; reason: string; startDate: string; endDate: string; releasedAmount: string; observations: string }
const emptyTrip = (): TripForm => ({ collaboratorId: '', stores: '', city: '', state: '', reason: '', startDate: new Date().toISOString().slice(0, 10), endDate: new Date().toISOString().slice(0, 10), releasedAmount: '', observations: '' })

type ExpenseForm = { collaboratorId: string; type: string; paymentMethod: string; date: string; value: string; storeName: string; cityUf: string; description: string; observations: string }
const emptyExpense = (): ExpenseForm => ({ collaboratorId: '', type: 'Alimentação', paymentMethod: 'Adiantamento', date: new Date().toISOString().slice(0, 10), value: '', storeName: '', cityUf: '', description: '', observations: '' })

export default function ViagensPage() {
  const [page, setPage] = useState(1)
  const [filterCollab, setFilterCollab] = useState('')
  const [showTrip, setShowTrip] = useState(false)
  const [editTripId, setEditTripId] = useState<string | null>(null)
  const [tripForm, setTripForm] = useState<TripForm>(emptyTrip())
  const [showExpense, setShowExpense] = useState(false)
  const [expenseTripId, setExpenseTripId] = useState<string | null>(null)
  const [expForm, setExpForm] = useState<ExpenseForm>(emptyExpense())
  const [expandedTrip, setExpandedTrip] = useState<string | null>(null)
  const [deleteTripId, setDeleteTripId] = useState<string | null>(null)
  const [error, setError] = useState('')

  const utils = trpc.useUtils()
  const { data, isLoading } = trpc.auditTrips.list.useQuery({ page, pageSize: 15, collaboratorId: filterCollab || undefined })
  const { data: collabs } = trpc.auditCollaborators.list.useQuery()
  const { data: tripDetail } = trpc.auditTrips.getById.useQuery({ id: expandedTrip! }, { enabled: !!expandedTrip })

  const createTripMut = trpc.auditTrips.create.useMutation({
    onSuccess: () => { utils.auditTrips.list.invalidate(); setShowTrip(false); setTripForm(emptyTrip()); setError('') },
    onError: e => setError(e.message),
  })
  const updateTripMut = trpc.auditTrips.update.useMutation({
    onSuccess: () => { utils.auditTrips.list.invalidate(); if (expandedTrip) utils.auditTrips.getById.invalidate({ id: expandedTrip }); setEditTripId(null); setTripForm(emptyTrip()); setError('') },
    onError: e => setError(e.message),
  })
  const deleteTripMut = trpc.auditTrips.delete.useMutation({
    onSuccess: () => { utils.auditTrips.list.invalidate(); setDeleteTripId(null) },
  })
  const createExpMut = trpc.auditCost.createExpense.useMutation({
    onSuccess: () => {
      utils.auditTrips.list.invalidate()
      if (expandedTrip) utils.auditTrips.getById.invalidate({ id: expandedTrip })
      setShowExpense(false); setExpForm(emptyExpense()); setError('')
    },
    onError: e => setError(e.message),
  })
  const deleteExpMut = trpc.auditCost.deleteExpense.useMutation({
    onSuccess: () => { if (expandedTrip) utils.auditTrips.getById.invalidate({ id: expandedTrip }); utils.auditTrips.list.invalidate() },
  })

  const { data: exportData } = trpc.auditTrips.exportCsv.useQuery({ collaboratorId: filterCollab || undefined }, { enabled: false })

  function setT(k: keyof TripForm, v: string) { setTripForm(f => ({ ...f, [k]: v })) }
  function setE(k: keyof ExpenseForm, v: string) { setExpForm(f => ({ ...f, [k]: v })) }

  function handleSaveTrip() {
    if (!tripForm.collaboratorId || !tripForm.startDate || !tripForm.endDate) { setError('Preencha colaborador, data de início e fim.'); return }
    setError('')
    const data = {
      collaboratorId: tripForm.collaboratorId,
      stores: tripForm.stores || undefined,
      city: tripForm.city || undefined,
      state: tripForm.state || undefined,
      reason: tripForm.reason || undefined,
      startDate: new Date(tripForm.startDate),
      endDate: new Date(tripForm.endDate),
      releasedAmount: tripForm.releasedAmount ? Number(tripForm.releasedAmount.replace(',', '.')) : 0,
      observations: tripForm.observations || undefined,
    }
    if (editTripId) updateTripMut.mutate({ id: editTripId, ...data })
    else createTripMut.mutate(data)
  }

  function handleSaveExpense() {
    if (!expenseTripId || !expForm.collaboratorId || !expForm.value) { setError('Preencha colaborador e valor.'); return }
    setError('')
    createExpMut.mutate({
      tripId: expenseTripId,
      auditorId: expForm.collaboratorId,
      collaboratorId: expForm.collaboratorId,
      type: expForm.type,
      paymentMethod: expForm.paymentMethod,
      date: new Date(expForm.date),
      value: Number(expForm.value.replace(',', '.')),
      storeName: expForm.storeName || undefined,
      cityUf: expForm.cityUf || undefined,
      description: expForm.description || undefined,
      observations: expForm.observations || undefined,
    })
  }

  function openEdit(t: any) {
    setTripForm({
      collaboratorId: t.collaboratorId ?? '',
      stores: t.stores ?? '',
      city: t.city ?? '',
      state: t.state ?? '',
      reason: t.reason ?? '',
      startDate: t.startDate ? new Date(t.startDate).toISOString().slice(0, 10) : '',
      endDate: t.endDate ? new Date(t.endDate).toISOString().slice(0, 10) : '',
      releasedAmount: t.releasedAmount ? String(Number(t.releasedAmount).toFixed(2)).replace('.', ',') : '',
      observations: t.observations ?? '',
    })
    setEditTripId(t.id)
    setError('')
  }

  function downloadCsv(trips: any[]) {
    const header = ['Colaborador','Cargo','Data','Loja','Cidade/UF','Centro de Custo','Motivo','Forma Pagamento','Valor','Viagem ID','Valor Liberado','Total Gasto','Saldo','Observações']
    const rows: string[][] = []
    for (const t of trips) {
      const expenses = t.expenses ?? []
      if (expenses.length === 0) {
        rows.push([t.collaborator?.name ?? '', t.collaborator?.role ?? '', '', t.stores ?? '', t.city ?? '', '', t.reason ?? '', '', '', t.id.slice(0,8), String(Number(t.releasedAmount).toFixed(2)), '0,00', String(Number(t.releasedAmount).toFixed(2)), t.observations ?? ''])
      } else {
        for (const e of expenses) {
          rows.push([t.collaborator?.name ?? '', t.collaborator?.role ?? '', new Date(e.date).toLocaleDateString('pt-BR'), e.storeName ?? '', e.cityUf ?? '', e.type ?? '', e.description ?? '', e.paymentMethod ?? '', String(Number(e.value).toFixed(2).replace('.',',')), t.id.slice(0,8), String(Number(t.releasedAmount).toFixed(2).replace('.',',')), String(Number(t.spentAmount ?? 0).toFixed(2).replace('.',',')), String(Number(t.balance ?? 0).toFixed(2).replace('.',',')), e.observations ?? ''])
        }
      }
    }
    const csv = [header, ...rows].map(r => r.map(c => `"${c}"`).join(';')).join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'viagens_auditoria.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  const trips = data?.trips ?? []

  function TripModalFields() {
    return (
      <>
        {error && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '10px 14px', marginBottom: '16px', fontSize: '13px', color: '#dc2626' }}>{error}</div>}
        <Field label="Colaborador *">
          <select style={inp} value={tripForm.collaboratorId} onChange={e => setT('collaboratorId', e.target.value)}>
            <option value="">Selecione...</option>
            {(collabs ?? []).map((c: any) => <option key={c.id} value={c.id}>{c.name}{c.role ? ` — ${c.role}` : ''}</option>)}
          </select>
        </Field>
        <Field label="Loja(s) / Conjunto de Lojas" hint="Ex: ER Caratinga, ER Ipatinga"><input style={inp} value={tripForm.stores} onChange={e => setT('stores', e.target.value)} /></Field>
        <div style={{ display: 'flex', gap: '12px' }}>
          <Field label="Cidade" row><input style={inp} value={tripForm.city} onChange={e => setT('city', e.target.value)} /></Field>
          <Field label="Estado" row><input style={{ ...inp, width: '80px' }} value={tripForm.state} onChange={e => setT('state', e.target.value)} placeholder="MG" maxLength={2} /></Field>
        </div>
        <Field label="Motivo da Viagem"><input style={inp} value={tripForm.reason} onChange={e => setT('reason', e.target.value)} placeholder="Ex: Inventário mensal" /></Field>
        <div style={{ display: 'flex', gap: '12px' }}>
          <Field label="Data de Início *" row><input style={inp} type="date" value={tripForm.startDate} onChange={e => setT('startDate', e.target.value)} /></Field>
          <Field label="Data de Fim *" row><input style={inp} type="date" value={tripForm.endDate} onChange={e => setT('endDate', e.target.value)} /></Field>
        </div>
        <Field label="Valor Liberado (R$)" hint="Total disponível para esta viagem">
          <input style={inp} value={tripForm.releasedAmount} onChange={e => setT('releasedAmount', e.target.value)} placeholder="0,00" inputMode="decimal" />
        </Field>
        <Field label="Observações"><textarea style={{ ...inp, minHeight: '72px', resize: 'vertical' }} value={tripForm.observations} onChange={e => setT('observations', e.target.value)} /></Field>
      </>
    )
  }

  return (
    <ModulePage
      title="Cadastro de Viagens"
      description="Cadastre viagens, colaboradores e controle o gasto liberado versus realizado"
      actions={
        <div style={{ display: 'flex', gap: '8px' }}>
          <Btn variant="outline" onClick={() => downloadCsv(trips)}>↓ Exportar CSV</Btn>
          <Btn onClick={() => { setShowTrip(true); setEditTripId(null); setTripForm(emptyTrip()); setError('') }}>+ Nova Viagem</Btn>
        </div>
      }
    >
      {/* Modal Viagem */}
      {(showTrip || editTripId) && (
        <Modal title={editTripId ? 'Editar Viagem' : 'Nova Viagem'} onClose={() => { setShowTrip(false); setEditTripId(null); setError('') }}>
          <TripModalFields />
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <Btn variant="outline" onClick={() => { setShowTrip(false); setEditTripId(null); setError('') }}>Cancelar</Btn>
            <Btn onClick={handleSaveTrip} disabled={createTripMut.isPending || updateTripMut.isPending}>
              {createTripMut.isPending || updateTripMut.isPending ? 'Salvando...' : editTripId ? 'Salvar Alterações' : 'Cadastrar Viagem'}
            </Btn>
          </div>
        </Modal>
      )}

      {/* Modal Despesa */}
      {showExpense && (
        <Modal title="Lançar Despesa" onClose={() => { setShowExpense(false); setError('') }}>
          {error && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '10px 14px', marginBottom: '16px', fontSize: '13px', color: '#dc2626' }}>{error}</div>}
          <Field label="Colaborador *">
            <select style={inp} value={expForm.collaboratorId} onChange={e => setE('collaboratorId', e.target.value)}>
              <option value="">Selecione...</option>
              {(collabs ?? []).map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
          <div style={{ display: 'flex', gap: '12px' }}>
            <Field label="Data *" row><input style={inp} type="date" value={expForm.date} onChange={e => setE('date', e.target.value)} /></Field>
            <Field label="Valor (R$) *" row><input style={inp} value={expForm.value} onChange={e => setE('value', e.target.value)} inputMode="decimal" placeholder="0,00" /></Field>
          </div>
          <Field label="Centro de Custo *">
            <select style={inp} value={expForm.type} onChange={e => setE('type', e.target.value)}>
              {COST_CENTERS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Forma de Pagamento *">
            <select style={inp} value={expForm.paymentMethod} onChange={e => setE('paymentMethod', e.target.value)}>
              {PAYMENT_METHODS.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </Field>
          <Field label="Loja"><input style={inp} value={expForm.storeName} onChange={e => setE('storeName', e.target.value)} placeholder="Ex: ER Caratinga" /></Field>
          <Field label="Cidade / UF"><input style={inp} value={expForm.cityUf} onChange={e => setE('cityUf', e.target.value)} placeholder="Ex: Caratinga / MG" /></Field>
          <Field label="Motivo / Descrição"><input style={inp} value={expForm.description} onChange={e => setE('description', e.target.value)} /></Field>
          <Field label="Observações"><textarea style={{ ...inp, minHeight: '60px', resize: 'vertical' }} value={expForm.observations} onChange={e => setE('observations', e.target.value)} /></Field>
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <Btn variant="outline" onClick={() => { setShowExpense(false); setError('') }}>Cancelar</Btn>
            <Btn onClick={handleSaveExpense} disabled={createExpMut.isPending}>{createExpMut.isPending ? 'Salvando...' : 'Lançar Despesa'}</Btn>
          </div>
        </Modal>
      )}

      {/* Modal Confirmar exclusão */}
      {deleteTripId && (
        <Modal title="Confirmar Exclusão" onClose={() => setDeleteTripId(null)}>
          <div style={{ padding: '8px 0 24px', fontSize: '15px', color: '#374151' }}>Excluir esta viagem e todas as despesas vinculadas?</div>
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <Btn variant="outline" onClick={() => setDeleteTripId(null)}>Cancelar</Btn>
            <Btn variant="danger" onClick={() => deleteTripMut.mutate({ id: deleteTripId })} disabled={deleteTripMut.isPending}>Excluir</Btn>
          </div>
        </Modal>
      )}

      {/* Filtros */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <select value={filterCollab} onChange={e => { setFilterCollab(e.target.value); setPage(1) }}
          style={{ padding: '8px 14px', borderRadius: '10px', border: '1.5px solid #e2e8f0', fontSize: '14px', minWidth: '200px' }}>
          <option value="">Todos os colaboradores</option>
          {(collabs ?? []).map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      <DataCard title={`Viagens (${data?.meta?.total ?? 0})`}>
        {isLoading ? <LoadingState /> : !trips.length ? (
          <EmptyState icon="✈️" title="Nenhuma viagem" description='Clique em "+ Nova Viagem" para cadastrar.' />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {trips.map((t: any) => {
              const pct = t.releasedAmount > 0 ? Math.min(100, (t.spentAmount / t.releasedAmount) * 100) : 0
              const isOver = t.spentAmount > t.releasedAmount
              const isExpanded = expandedTrip === t.id
              return (
                <div key={t.id} style={{ border: `1.5px solid ${isOver ? '#fecaca' : '#e2e8f0'}`, borderRadius: '14px', overflow: 'hidden', background: isOver ? '#fff5f5' : 'white' }}>
                  {/* Header da viagem */}
                  <div style={{ padding: '16px', cursor: 'pointer' }} onClick={() => setExpandedTrip(isExpanded ? null : t.id)}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap' }}>
                      <div style={{ flex: 1, minWidth: '160px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: '700', fontSize: '15px', color: '#0f172a' }}>{t.collaborator?.name ?? '—'}</span>
                          {t.collaborator?.role && <span style={{ fontSize: '12px', color: '#64748b' }}>{t.collaborator.role}</span>}
                          <span style={{ padding: '2px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: '600', background: t.status === 'OPEN' ? '#dbeafe' : '#f1f5f9', color: t.status === 'OPEN' ? '#1d4ed8' : '#64748b' }}>{STATUS_LABELS[t.status] ?? t.status}</span>
                        </div>
                        <div style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>
                          {t.reason && <span>{t.reason}</span>}
                          {t.city && <span> · {t.city}{t.state ? `/${t.state}` : ''}</span>}
                          {t.stores && <span> · {t.stores}</span>}
                        </div>
                        <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>{formatDate(t.startDate)} → {formatDate(t.endDate)}</div>
                      </div>
                      <div style={{ textAlign: 'right', minWidth: '120px' }}>
                        <div style={{ fontSize: '18px', fontWeight: '800', color: isOver ? '#dc2626' : '#0f172a' }}>{formatCurrency(t.spentAmount)}</div>
                        <div style={{ fontSize: '12px', color: '#64748b' }}>de {formatCurrency(t.releasedAmount)} liberado</div>
                        <div style={{ fontSize: '12px', fontWeight: '600', color: isOver ? '#dc2626' : '#16a34a', marginTop: '2px' }}>
                          {isOver ? `⚠️ Excedeu ${formatCurrency(Math.abs(t.balance))}` : `Saldo: ${formatCurrency(t.balance)}`}
                        </div>
                      </div>
                    </div>
                    {/* Barra de progresso */}
                    {t.releasedAmount > 0 && (
                      <div style={{ marginTop: '10px', background: '#f1f5f9', borderRadius: '4px', height: '6px' }}>
                        <div style={{ background: isOver ? '#dc2626' : pct > 80 ? '#f59e0b' : '#22c55e', borderRadius: '4px', height: '6px', width: `${Math.min(100, pct)}%`, transition: 'width 0.5s' }} />
                      </div>
                    )}
                  </div>

                  {/* Ações */}
                  <div style={{ padding: '0 16px 14px', display: 'flex', gap: '6px', borderTop: '1px solid #f1f5f9', paddingTop: '10px' }}>
                    <button onClick={() => { setExpenseTripId(t.id); setExpForm({ ...emptyExpense(), collaboratorId: t.collaboratorId ?? '' }); setShowExpense(true) }}
                      style={{ padding: '6px 12px', borderRadius: '8px', border: '1px solid #d1d5db', background: 'white', fontSize: '12px', cursor: 'pointer', fontWeight: '600' }}>+ Despesa</button>
                    <button onClick={() => openEdit(t)}
                      style={{ padding: '6px 12px', borderRadius: '8px', border: '1px solid #d1d5db', background: 'white', fontSize: '12px', cursor: 'pointer' }}>Editar</button>
                    <button onClick={() => setExpandedTrip(isExpanded ? null : t.id)}
                      style={{ padding: '6px 12px', borderRadius: '8px', border: '1px solid #d1d5db', background: 'white', fontSize: '12px', cursor: 'pointer' }}>
                      {isExpanded ? 'Ocultar' : 'Ver Despesas'}
                    </button>
                    <button onClick={() => setDeleteTripId(t.id)}
                      style={{ padding: '6px 12px', borderRadius: '8px', border: '1px solid #fecaca', background: '#fef2f2', fontSize: '12px', cursor: 'pointer', color: '#dc2626' }}>Excluir</button>
                  </div>

                  {/* Despesas expandidas */}
                  {isExpanded && (
                    <div style={{ borderTop: '1px solid #f1f5f9', padding: '16px', background: '#f8fafc' }}>
                      {!tripDetail?.expenses?.length ? (
                        <div style={{ textAlign: 'center', color: '#94a3b8', fontSize: '13px', padding: '12px' }}>Nenhuma despesa lançada</div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {tripDetail.expenses.map((e: any) => (
                            <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'white', borderRadius: '10px', padding: '10px 14px', border: '1px solid #e2e8f0', flexWrap: 'wrap', gap: '8px' }}>
                              <div style={{ flex: 1, minWidth: '140px' }}>
                                <div style={{ fontWeight: '600', fontSize: '14px', color: '#0f172a' }}>{e.type}</div>
                                <div style={{ fontSize: '12px', color: '#64748b' }}>{e.description || '—'} {e.storeName ? `· ${e.storeName}` : ''}</div>
                                <div style={{ fontSize: '11px', color: '#94a3b8' }}>{formatDate(e.date)} · {e.paymentMethod || '—'}</div>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <span style={{ fontWeight: '700', fontSize: '15px', color: '#0f172a' }}>{formatCurrency(Number(e.value))}</span>
                                <button onClick={() => deleteExpMut.mutate({ id: e.id })} style={{ padding: '4px 8px', borderRadius: '6px', border: '1px solid #fecaca', background: '#fef2f2', fontSize: '11px', cursor: 'pointer', color: '#dc2626' }}>✕</button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
        {(data?.meta?.totalPages ?? 0) > 1 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #f1f5f9' }}>
            <span style={{ fontSize: '13px', color: '#64748b' }}>Página {data!.meta.page} de {data!.meta.totalPages}</span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <Btn variant="outline" small disabled={!data!.meta.hasPrev} onClick={() => setPage(p => p - 1)}>← Anterior</Btn>
              <Btn variant="outline" small disabled={!data!.meta.hasNext} onClick={() => setPage(p => p + 1)}>Próxima →</Btn>
            </div>
          </div>
        )}
      </DataCard>
    </ModulePage>
  )
}
