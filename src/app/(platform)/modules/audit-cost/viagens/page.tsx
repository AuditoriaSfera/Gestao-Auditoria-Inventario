'use client'

export const dynamic = 'force-dynamic'

import { useState, useCallback } from 'react'
import { trpc } from '@/lib/trpc'
import { ModulePage, DataCard, EmptyState, LoadingState, Btn } from '@/components/shared/module-page'
import { formatDate, formatCurrency } from '@/lib/utils'

const STATUS_LABELS: Record<string, string> = { OPEN: 'Aberta', CLOSED: 'Fechada', CANCELLED: 'Cancelada' }
const PAYMENT_METHODS = ['Adiantamento','Cartão Corporativo','Cartão Combustível','Pix','Dinheiro','Reembolso']
const DIAS_SEMANA = ['domingo','segunda-feira','terça-feira','quarta-feira','quinta-feira','sexta-feira','sábado']
const DEFAULT_COST_TYPES = ['Alimentação','Hospedagem','Combustível','Pedágio','Estacionamento','Passagem','Aluguel de carro','Carro de aplicativo','Outros']

const inp = { width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1.5px solid #e2e8f0', fontSize: '15px', boxSizing: 'border-box' as const }
const inpSm = { padding: '6px 10px', borderRadius: '8px', border: '1.5px solid #e2e8f0', fontSize: '13px', boxSizing: 'border-box' as const, width: '100%' }

// ─── Helpers ──────────────────────────────────────────────────────────────────
function generateDates(start: string, end: string): string[] {
  if (!start || !end || end < start) return []
  const dates: string[] = []
  const cur = new Date(start + 'T12:00:00')
  const last = new Date(end + 'T12:00:00')
  while (cur <= last) {
    dates.push(cur.toISOString().slice(0, 10))
    cur.setDate(cur.getDate() + 1)
  }
  return dates
}
function fmtDate(d: string) { return new Date(d + 'T12:00:00').toLocaleDateString('pt-BR') }
function diaSemana(d: string) { return DIAS_SEMANA[new Date(d + 'T12:00:00').getDay()] }
function parseMoney(v: string) { return v ? Number(v.replace(',', '.')) : 0 }

// ─── Componentes base ────────────────────────────────────────────────────────
function Modal({ title, onClose, children, wide, maxW }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean; maxW?: string }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 1000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '16px', overflowY: 'auto' }}>
      <div style={{ background: 'white', borderRadius: '16px', width: '100%', maxWidth: maxW ?? (wide ? '960px' : '560px'), maxHeight: '95vh', overflow: 'auto', boxShadow: '0 25px 50px rgba(0,0,0,0.25)', marginTop: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 24px', borderBottom: '1px solid #f1f5f9', position: 'sticky', top: 0, background: 'white', zIndex: 10 }}>
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
function SectionTitle({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: '13px', fontWeight: '700', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px', marginTop: '4px', borderBottom: '1px solid #f1f5f9', paddingBottom: '6px' }}>{children}</div>
}

// ─── Multi-select de Lojas ────────────────────────────────────────────────────
function StoreMultiSelect({ stores, selectedIds, onChange }: { stores: any[]; selectedIds: string[]; onChange: (ids: string[]) => void }) {
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const filtered = stores.filter((s: any) => !search || s.name.toLowerCase().includes(search.toLowerCase()) || (s.code && s.code.toLowerCase().includes(search.toLowerCase())))
  const selectedStores = stores.filter(s => selectedIds.includes(s.id))
  function toggle(id: string) { onChange(selectedIds.includes(id) ? selectedIds.filter(x => x !== id) : [...selectedIds, id]) }
  return (
    <div style={{ position: 'relative' }}>
      <div onClick={() => setOpen(o => !o)} style={{ ...inp, cursor: 'pointer', minHeight: '44px', display: 'flex', flexWrap: 'wrap', gap: '4px', alignItems: 'center', padding: '6px 10px' }}>
        {!selectedIds.length && <span style={{ color: '#94a3b8', fontSize: '14px' }}>Selecione as lojas da viagem...</span>}
        {selectedStores.map((s: any) => (
          <span key={s.id} style={{ background: '#dbeafe', color: '#1e40af', fontSize: '12px', fontWeight: '600', padding: '3px 10px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
            {s.code ? `[${s.code}] ` : ''}{s.name}
            <button onClick={e => { e.stopPropagation(); toggle(s.id) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#1e40af', lineHeight: 1, padding: 0, fontSize: '14px' }}>×</button>
          </span>
        ))}
        <span style={{ marginLeft: 'auto', color: '#94a3b8', fontSize: '12px', flexShrink: 0 }}>{open ? '▲' : '▼'}</span>
      </div>
      {open && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, background: 'white', border: '1.5px solid #e2e8f0', borderRadius: '10px', boxShadow: '0 8px 24px rgba(0,0,0,0.12)', marginTop: '4px', maxHeight: '220px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '8px' }}>
            <input autoFocus placeholder="Buscar loja..." value={search} onChange={e => setSearch(e.target.value)} style={{ ...inp, fontSize: '13px', padding: '7px 10px' }} />
          </div>
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {filtered.length === 0 && <div style={{ padding: '12px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>Nenhuma loja encontrada</div>}
            {filtered.map((s: any) => {
              const isSel = selectedIds.includes(s.id)
              return (
                <div key={s.id} onClick={() => toggle(s.id)} style={{ padding: '9px 14px', cursor: 'pointer', background: isSel ? '#eff6ff' : 'transparent', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px' }}
                  onMouseEnter={e => { if (!isSel) (e.currentTarget as HTMLElement).style.background = '#f8fafc' }}
                  onMouseLeave={e => { if (!isSel) (e.currentTarget as HTMLElement).style.background = 'transparent' }}>
                  <div style={{ width: '16px', height: '16px', borderRadius: '4px', border: `2px solid ${isSel ? '#2563eb' : '#d1d5db'}`, background: isSel ? '#2563eb' : 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {isSel && <span style={{ color: 'white', fontSize: '10px', lineHeight: 1 }}>✓</span>}
                  </div>
                  <div>
                    <span style={{ fontWeight: '500', color: '#0f172a' }}>{s.name}</span>
                    {s.code && <span style={{ color: '#64748b', marginLeft: '6px', fontSize: '12px' }}>[{s.code}]</span>}
                    {s.city && <span style={{ color: '#94a3b8', marginLeft: '6px', fontSize: '12px' }}>{s.city}/{s.state}</span>}
                  </div>
                </div>
              )
            })}
          </div>
          {selectedIds.length > 0 && (
            <div style={{ padding: '8px 12px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', color: '#64748b' }}>{selectedIds.length} loja(s)</span>
              <button onClick={() => { onChange([]); setOpen(false) }} style={{ fontSize: '12px', color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer' }}>Limpar</button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Tabela Diária de Colaborador ─────────────────────────────────────────────
type DayRow = { storeName: string; values: Record<string, string> }

function TabelaDiaria({
  dates, storeOptions, tipos, rows, onChange
}: {
  dates: string[]
  storeOptions: string[]
  tipos: string[]
  rows: Record<string, DayRow>
  onChange: (rows: Record<string, DayRow>) => void
}) {
  function setStore(d: string, v: string) {
    onChange({ ...rows, [d]: { ...rows[d], storeName: v } })
  }
  function setValue(d: string, tipo: string, v: string) {
    onChange({ ...rows, [d]: { ...rows[d], values: { ...rows[d]?.values, [tipo]: v } } })
  }
  if (!dates.length) return <div style={{ padding: '12px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>Defina as datas da viagem para preencher a tabela.</div>

  const thSt: React.CSSProperties = { padding: '8px 10px', textAlign: 'left', fontSize: '11px', fontWeight: '700', color: '#64748b', background: '#f8fafc', borderBottom: '2px solid #e2e8f0', whiteSpace: 'nowrap' }
  const tdSt: React.CSSProperties = { padding: '6px 8px', borderBottom: '1px solid #f1f5f9', verticalAlign: 'middle' }

  const totaisPorTipo: Record<string, number> = {}
  for (const tipo of tipos) totaisPorTipo[tipo] = 0
  for (const d of dates) for (const tipo of tipos) totaisPorTipo[tipo] += parseMoney(rows[d]?.values?.[tipo] ?? '')

  return (
    <div style={{ overflowX: 'auto', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
        <thead>
          <tr>
            <th style={thSt}>Data</th>
            <th style={thSt}>Dia</th>
            <th style={{ ...thSt, minWidth: '160px' }}>Loja do dia</th>
            {tipos.map(t => <th key={t} style={{ ...thSt, textAlign: 'right', minWidth: '90px' }}>{t}</th>)}
            <th style={{ ...thSt, textAlign: 'right' }}>Total</th>
          </tr>
        </thead>
        <tbody>
          {dates.map(d => {
            const row = rows[d] ?? { storeName: '', values: {} }
            const total = tipos.reduce((s, t) => s + parseMoney(row.values?.[t] ?? ''), 0)
            return (
              <tr key={d}>
                <td style={{ ...tdSt, fontWeight: '600', color: '#0f172a', whiteSpace: 'nowrap' }}>{fmtDate(d)}</td>
                <td style={{ ...tdSt, color: '#64748b', whiteSpace: 'nowrap', fontSize: '12px' }}>{diaSemana(d)}</td>
                <td style={tdSt}>
                  <select value={row.storeName} onChange={e => setStore(d, e.target.value)} style={{ ...inpSm, fontSize: '12px' }}>
                    <option value="">—</option>
                    {storeOptions.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </td>
                {tipos.map(t => (
                  <td key={t} style={{ ...tdSt, textAlign: 'right' }}>
                    <input
                      value={row.values?.[t] ?? ''}
                      onChange={e => setValue(d, t, e.target.value)}
                      placeholder="—"
                      inputMode="decimal"
                      style={{ ...inpSm, textAlign: 'right', width: '80px' }}
                    />
                  </td>
                ))}
                <td style={{ ...tdSt, textAlign: 'right', fontWeight: '700', color: total > 0 ? '#1e40af' : '#cbd5e1', whiteSpace: 'nowrap' }}>
                  {total > 0 ? formatCurrency(total) : '—'}
                </td>
              </tr>
            )
          })}
        </tbody>
        <tfoot>
          <tr style={{ background: '#f8fafc' }}>
            <td colSpan={3} style={{ ...tdSt, fontWeight: '700', borderTop: '2px solid #e2e8f0' }}>Total</td>
            {tipos.map(t => (
              <td key={t} style={{ ...tdSt, textAlign: 'right', fontWeight: '700', color: '#1e40af', borderTop: '2px solid #e2e8f0' }}>
                {totaisPorTipo[t] > 0 ? formatCurrency(totaisPorTipo[t]) : '—'}
              </td>
            ))}
            <td style={{ ...tdSt, textAlign: 'right', fontWeight: '900', color: '#0f172a', borderTop: '2px solid #e2e8f0' }}>
              {formatCurrency(Object.values(totaisPorTipo).reduce((a, b) => a + b, 0))}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

// ─── Modal Nova Viagem (fluxo novo) ───────────────────────────────────────────
type CollabEntry = { id: string; collaboratorId: string; advancedAmount: string; rows: Record<string, DayRow> }

function buildEmptyRows(dates: string[]): Record<string, DayRow> {
  const rows: Record<string, DayRow> = {}
  for (const d of dates) rows[d] = { storeName: '', values: {} }
  return rows
}
function syncRows(prev: Record<string, DayRow>, newDates: string[]): Record<string, DayRow> {
  const result: Record<string, DayRow> = {}
  for (const d of newDates) result[d] = prev[d] ?? { storeName: '', values: {} }
  return result
}

function NovaTripModal({ onClose, collabsList, storesList, costTypes }: {
  onClose: () => void
  collabsList: any[]
  storesList: any[]
  costTypes: any[]
}) {
  const utils = trpc.useUtils()
  const today = new Date().toISOString().slice(0, 10)

  const [selectedStoreIds, setSelectedStoreIds] = useState<string[]>([])
  const [startDate, setStartDate] = useState(today)
  const [endDate, setEndDate] = useState(today)
  const [reason, setReason] = useState('')
  const [observations, setObservations] = useState('')
  const [collabEntries, setCollabEntries] = useState<CollabEntry[]>([])
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const tipos = costTypes.length > 0 ? costTypes.map((t: any) => t.name) : DEFAULT_COST_TYPES
  const dates = generateDates(startDate, endDate)
  const selectedStores = storesList.filter(s => selectedStoreIds.includes(s.id))
  const storeOptions = selectedStores.map((s: any) => s.name)

  // Auto-fill cidade/estado da primeira loja selecionada
  const firstStore = selectedStores[0]
  const cidadesInfo = [...new Set(selectedStores.filter(s => s.city).map((s: any) => `${s.city}/${s.state}`))].join(', ')

  function updateDates(start: string, end: string) {
    const newDates = generateDates(start, end)
    setCollabEntries(prev => prev.map(e => ({ ...e, rows: syncRows(e.rows, newDates) })))
  }

  function addCollab() {
    const id = Math.random().toString(36).slice(2)
    const newEntry: CollabEntry = { id, collaboratorId: '', advancedAmount: '', rows: buildEmptyRows(dates) }
    setCollabEntries(p => [...p, newEntry])
    setExpanded(p => ({ ...p, [id]: true }))
  }
  function removeCollab(id: string) { setCollabEntries(p => p.filter(e => e.id !== id)) }
  function updateCollab(id: string, field: 'collaboratorId' | 'advancedAmount', val: string) {
    setCollabEntries(p => p.map(e => e.id === id ? { ...e, [field]: val } : e))
  }
  function updateRows(id: string, rows: Record<string, DayRow>) {
    setCollabEntries(p => p.map(e => e.id === id ? { ...e, rows } : e))
  }

  const createTripMut = trpc.auditTrips.create.useMutation()
  const createExpMut = trpc.auditCost.createExpense.useMutation()

  async function handleSave() {
    if (!selectedStoreIds.length) { setError('Selecione ao menos uma loja.'); return }
    if (!startDate || !endDate) { setError('Informe as datas da viagem.'); return }
    if (!collabEntries.length) { setError('Adicione ao menos um colaborador.'); return }
    const invalid = collabEntries.find(e => !e.collaboratorId)
    if (invalid) { setError('Selecione o colaborador em todas as entradas.'); return }
    setError('')
    setSaving(true)
    try {
      const storeNames = selectedStores.map(s => s.name).join(', ')
      const city = firstStore?.city ?? ''
      const state = firstStore?.state ?? ''
      for (const entry of collabEntries) {
        const totalAllowance = dates.reduce((sum, d) => sum + tipos.reduce((s, t) => s + parseMoney(entry.rows[d]?.values?.[t] ?? ''), 0), 0)
        const trip = await createTripMut.mutateAsync({
          collaboratorId: entry.collaboratorId,
          stores: storeNames,
          city: city || undefined,
          state: state || undefined,
          reason: reason || undefined,
          startDate: new Date(startDate + 'T12:00:00'),
          endDate: new Date(endDate + 'T12:00:00'),
          releasedAmount: totalAllowance,
          advancedAmount: entry.advancedAmount ? parseMoney(entry.advancedAmount) : 0,
          observations: observations || undefined,
        })
        for (const d of dates) {
          const row = entry.rows[d]
          if (!row) continue
          for (const tipo of tipos) {
            const val = parseMoney(row.values?.[tipo] ?? '')
            if (val > 0) {
              await createExpMut.mutateAsync({
                tripId: trip.id,
                auditorId: entry.collaboratorId,
                collaboratorId: entry.collaboratorId,
                type: tipo,
                date: new Date(d + 'T12:00:00'),
                value: val,
                storeName: row.storeName || undefined,
                cityUf: row.storeName ? cidadesInfo || undefined : undefined,
                paymentMethod: 'Adiantamento',
              })
            }
          }
        }
      }
      utils.auditTrips.list.invalidate()
      onClose()
    } catch (e: any) {
      setError(e?.message ?? 'Erro ao salvar.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title="Nova Viagem" onClose={onClose} wide>
      {error && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '10px 14px', marginBottom: '16px', fontSize: '13px', color: '#dc2626' }}>{error}</div>}

      {/* ── Lojas ── */}
      <SectionTitle>1. Lojas da Viagem</SectionTitle>
      <Field label="Lojas *" hint="As cidades e estados serão preenchidos automaticamente">
        <StoreMultiSelect stores={storesList} selectedIds={selectedStoreIds} onChange={ids => { setSelectedStoreIds(ids) }} />
      </Field>
      {cidadesInfo && (
        <div style={{ display: 'flex', gap: '8px', marginBottom: '14px', flexWrap: 'wrap' }}>
          {[...new Set(selectedStores.filter(s => s.city).map((s: any) => `${s.city}/${s.state}`))].map(loc => (
            <span key={loc} style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: '20px', padding: '3px 12px', fontSize: '12px', fontWeight: '600', color: '#166534' }}>📍 {loc}</span>
          ))}
        </div>
      )}

      {/* ── Datas e Motivo ── */}
      <SectionTitle>2. Período e Motivo</SectionTitle>
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        <Field label="Data de Início *" row>
          <input style={inp} type="date" value={startDate} onChange={e => { setStartDate(e.target.value); updateDates(e.target.value, endDate) }} />
        </Field>
        <Field label="Data de Fim *" row>
          <input style={inp} type="date" value={endDate} onChange={e => { setEndDate(e.target.value); updateDates(startDate, e.target.value) }} />
        </Field>
      </div>
      <Field label="Motivo da Viagem">
        <input style={inp} value={reason} onChange={e => setReason(e.target.value)} placeholder="Ex: Inventário mensal, Auditoria regional..." />
      </Field>
      <Field label="Observações">
        <textarea style={{ ...inp, minHeight: '56px', resize: 'vertical' }} value={observations} onChange={e => setObservations(e.target.value)} />
      </Field>

      {/* ── Colaboradores ── */}
      <SectionTitle>3. Colaboradores e Diárias</SectionTitle>
      {!collabEntries.length && (
        <div style={{ textAlign: 'center', padding: '20px', background: '#f8fafc', borderRadius: '12px', marginBottom: '12px', color: '#64748b', fontSize: '13px' }}>
          Nenhum colaborador adicionado. Clique em "+ Adicionar Colaborador" abaixo.
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '12px' }}>
        {collabEntries.map(entry => {
          const isExpanded = expanded[entry.id] !== false
          const collab = collabsList.find(c => c.id === entry.collaboratorId)
          const totalDiarias = dates.reduce((sum, d) => sum + tipos.reduce((s, t) => s + parseMoney(entry.rows[d]?.values?.[t] ?? ''), 0), 0)
          return (
            <div key={entry.id} style={{ border: '1.5px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden' }}>
              {/* Cabeçalho do colaborador */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 16px', background: '#f8fafc', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: '160px' }}>
                  <select
                    value={entry.collaboratorId}
                    onChange={e => updateCollab(entry.id, 'collaboratorId', e.target.value)}
                    style={{ ...inp, fontSize: '14px', padding: '8px 12px' }}
                  >
                    <option value="">Selecione o colaborador...</option>
                    {collabsList.map((c: any) => <option key={c.id} value={c.id}>{c.name}{c.role ? ` — ${c.role}` : ''}</option>)}
                  </select>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <label style={{ fontSize: '12px', fontWeight: '600', color: '#374151', whiteSpace: 'nowrap' }}>Adiantamento R$</label>
                  <input
                    value={entry.advancedAmount}
                    onChange={e => updateCollab(entry.id, 'advancedAmount', e.target.value)}
                    placeholder="0,00"
                    inputMode="decimal"
                    style={{ ...inpSm, width: '90px', textAlign: 'right' }}
                  />
                </div>
                {totalDiarias > 0 && (
                  <span style={{ fontSize: '12px', fontWeight: '700', color: '#1e40af', background: '#eff6ff', padding: '3px 10px', borderRadius: '20px', whiteSpace: 'nowrap' }}>
                    Total: {formatCurrency(totalDiarias)}
                  </span>
                )}
                <button onClick={() => setExpanded(p => ({ ...p, [entry.id]: !isExpanded }))}
                  style={{ padding: '5px 10px', borderRadius: '7px', border: '1px solid #d1d5db', background: 'white', fontSize: '12px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  {isExpanded ? '▲ Ocultar' : '▼ Tabela'}
                </button>
                <button onClick={() => removeCollab(entry.id)}
                  style={{ padding: '5px 8px', borderRadius: '7px', border: '1px solid #fecaca', background: '#fef2f2', fontSize: '12px', cursor: 'pointer', color: '#dc2626' }}>✕</button>
              </div>
              {/* Tabela de diárias */}
              {isExpanded && (
                <div style={{ padding: '12px 16px' }}>
                  <TabelaDiaria
                    dates={dates}
                    storeOptions={storeOptions}
                    tipos={tipos}
                    rows={entry.rows}
                    onChange={rows => updateRows(entry.id, rows)}
                  />
                </div>
              )}
            </div>
          )
        })}
      </div>
      <button onClick={addCollab} style={{ width: '100%', padding: '10px', borderRadius: '10px', border: '1.5px dashed #cbd5e1', background: '#f8fafc', fontSize: '13px', fontWeight: '600', color: '#475569', cursor: 'pointer', marginBottom: '20px' }}>
        + Adicionar Colaborador
      </button>

      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', borderTop: '1px solid #f1f5f9', paddingTop: '16px' }}>
        <Btn variant="outline" onClick={onClose}>Cancelar</Btn>
        <Btn onClick={handleSave} disabled={saving}>{saving ? 'Salvando...' : 'Cadastrar Viagem'}</Btn>
      </div>
    </Modal>
  )
}

// ─── Aba: Colaboradores ───────────────────────────────────────────────────────
function AbaColaboradores() {
  const utils = trpc.useUtils()
  const { data: collabs, isLoading } = trpc.auditCollaborators.list.useQuery({ includeInactive: true })
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState({ name: '', role: '', phone: '', email: '' })
  const [error, setError] = useState('')
  const createMut = trpc.auditCollaborators.create.useMutation({ onSuccess: () => { utils.auditCollaborators.list.invalidate(); setShowForm(false); setForm({ name: '', role: '', phone: '', email: '' }); setError('') }, onError: e => setError(e.message) })
  const updateMut = trpc.auditCollaborators.update.useMutation({ onSuccess: () => { utils.auditCollaborators.list.invalidate(); setEditId(null); setForm({ name: '', role: '', phone: '', email: '' }); setError('') }, onError: e => setError(e.message) })
  const toggleMut = trpc.auditCollaborators.update.useMutation({ onSuccess: () => utils.auditCollaborators.list.invalidate() })
  const deleteMut = trpc.auditCollaborators.delete.useMutation({ onSuccess: () => utils.auditCollaborators.list.invalidate() })
  function openEdit(c: any) { setForm({ name: c.name, role: c.role ?? '', phone: c.phone ?? '', email: c.email ?? '' }); setEditId(c.id); setError('') }
  function handleSave() {
    if (!form.name.trim()) { setError('Nome é obrigatório.'); return }
    const d = { name: form.name, role: form.role || undefined, phone: form.phone || undefined, email: form.email || undefined }
    if (editId) updateMut.mutate({ id: editId, ...d })
    else createMut.mutate(d)
  }
  return (
    <DataCard title={`Colaboradores (${(collabs ?? []).length})`} action={<Btn onClick={() => { setShowForm(true); setEditId(null); setForm({ name: '', role: '', phone: '', email: '' }); setError('') }}>+ Novo Colaborador</Btn>}>
      {(showForm || editId) && (
        <Modal title={editId ? 'Editar Colaborador' : 'Novo Colaborador'} onClose={() => { setShowForm(false); setEditId(null); setError('') }}>
          {error && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '10px 14px', marginBottom: '16px', fontSize: '13px', color: '#dc2626' }}>{error}</div>}
          <Field label="Nome *"><input style={inp} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ex: Lucas Acilio" /></Field>
          <Field label="Cargo / Função"><input style={inp} value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} placeholder="Ex: Auditor de Campo" /></Field>
          <div style={{ display: 'flex', gap: '12px' }}>
            <Field label="Telefone / WhatsApp" row><input style={inp} value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} /></Field>
            <Field label="E-mail" row><input style={inp} type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></Field>
          </div>
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <Btn variant="outline" onClick={() => { setShowForm(false); setEditId(null) }}>Cancelar</Btn>
            <Btn onClick={handleSave} disabled={createMut.isPending || updateMut.isPending}>{createMut.isPending || updateMut.isPending ? 'Salvando...' : editId ? 'Salvar' : 'Cadastrar'}</Btn>
          </div>
        </Modal>
      )}
      {isLoading ? <LoadingState /> : !(collabs ?? []).length ? <EmptyState icon="👤" title="Nenhum colaborador" description='Clique em "+ Novo Colaborador" para cadastrar.' /> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {(collabs ?? []).map((c: any) => (
            <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', border: '1.5px solid #e2e8f0', borderRadius: '12px', background: c.isActive ? 'white' : '#f8fafc', flexWrap: 'wrap', gap: '8px' }}>
              <div style={{ flex: 1, minWidth: '140px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontWeight: '700', fontSize: '15px', color: c.isActive ? '#0f172a' : '#94a3b8' }}>{c.name}</span>
                  {!c.isActive && <span style={{ fontSize: '11px', padding: '1px 7px', borderRadius: '10px', background: '#f1f5f9', color: '#94a3b8' }}>Inativo</span>}
                </div>
                {c.role && <div style={{ fontSize: '13px', color: '#64748b', marginTop: '2px' }}>{c.role}</div>}
                <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '1px' }}>{c.phone && <span>{c.phone}</span>}{c.phone && c.email && <span> · </span>}{c.email && <span>{c.email}</span>}</div>
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button onClick={() => openEdit(c)} style={{ padding: '5px 10px', borderRadius: '7px', border: '1px solid #d1d5db', background: 'white', fontSize: '12px', cursor: 'pointer' }}>Editar</button>
                <button onClick={() => toggleMut.mutate({ id: c.id, name: c.name, isActive: !c.isActive })} style={{ padding: '5px 10px', borderRadius: '7px', border: '1px solid #d1d5db', background: 'white', fontSize: '12px', cursor: 'pointer', color: c.isActive ? '#d97706' : '#16a34a' }}>{c.isActive ? 'Desativar' : 'Ativar'}</button>
                <button onClick={() => deleteMut.mutate({ id: c.id })} style={{ padding: '5px 10px', borderRadius: '7px', border: '1px solid #fecaca', background: '#fef2f2', fontSize: '12px', cursor: 'pointer', color: '#dc2626' }}>Excluir</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </DataCard>
  )
}

// ─── Aba: Tipos de Custo ──────────────────────────────────────────────────────
function AbaTiposCusto() {
  const utils = trpc.useUtils()
  const { data: tipos, isLoading } = trpc.auditCostTypes.list.useQuery({ includeInactive: true })
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const createMut = trpc.auditCostTypes.create.useMutation({ onSuccess: () => { utils.auditCostTypes.list.invalidate(); setShowForm(false); setName(''); setError('') }, onError: e => setError(e.message) })
  const updateMut = trpc.auditCostTypes.update.useMutation({ onSuccess: () => { utils.auditCostTypes.list.invalidate(); setEditId(null); setName(''); setError('') }, onError: e => setError(e.message) })
  const toggleMut = trpc.auditCostTypes.update.useMutation({ onSuccess: () => utils.auditCostTypes.list.invalidate() })
  const deleteMut = trpc.auditCostTypes.delete.useMutation({ onSuccess: () => utils.auditCostTypes.list.invalidate() })
  function handleSave() {
    if (!name.trim()) { setError('Nome é obrigatório.'); return }
    if (editId) updateMut.mutate({ id: editId, name })
    else createMut.mutate({ name })
  }
  return (
    <DataCard title={`Tipos de Custo (${(tipos ?? []).length})`} action={<Btn onClick={() => { setShowForm(true); setEditId(null); setName(''); setError('') }}>+ Novo Tipo</Btn>}>
      {(showForm || editId) && (
        <Modal title={editId ? 'Editar Tipo de Custo' : 'Novo Tipo de Custo'} onClose={() => { setShowForm(false); setEditId(null); setError('') }}>
          {error && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '10px 14px', marginBottom: '16px', fontSize: '13px', color: '#dc2626' }}>{error}</div>}
          <Field label="Nome do tipo de custo *" hint="Ex: Janta, Almoço, Hospedagem, Combustível...">
            <input style={inp} value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Janta" autoFocus onKeyDown={e => e.key === 'Enter' && handleSave()} />
          </Field>
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <Btn variant="outline" onClick={() => { setShowForm(false); setEditId(null) }}>Cancelar</Btn>
            <Btn onClick={handleSave} disabled={createMut.isPending || updateMut.isPending}>{createMut.isPending || updateMut.isPending ? 'Salvando...' : editId ? 'Salvar' : 'Cadastrar'}</Btn>
          </div>
        </Modal>
      )}
      <div style={{ background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: '10px', padding: '12px 16px', marginBottom: '16px', fontSize: '13px', color: '#64748b' }}>
        <span style={{ fontWeight: '600', color: '#475569' }}>Tipos padrão:</span>{' '}{DEFAULT_COST_TYPES.join(', ')}
        <div style={{ fontSize: '12px', marginTop: '4px', color: '#94a3b8' }}>Cadastre tipos personalizados acima para substituir estes.</div>
      </div>
      {isLoading ? <LoadingState /> : !(tipos ?? []).length ? <EmptyState icon="🏷️" title="Nenhum tipo cadastrado" description='Usando os tipos padrão.' /> : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {(tipos ?? []).map((t: any) => (
            <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 12px', border: `1.5px solid ${t.isActive ? '#bfdbfe' : '#e2e8f0'}`, borderRadius: '20px', background: t.isActive ? '#eff6ff' : '#f8fafc' }}>
              <span style={{ fontSize: '14px', fontWeight: '600', color: t.isActive ? '#1e40af' : '#94a3b8' }}>{t.name}</span>
              <div style={{ display: 'flex', gap: '4px', marginLeft: '4px' }}>
                <button onClick={() => { setEditId(t.id); setName(t.name); setError('') }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', color: '#64748b', padding: '0 2px' }}>✏️</button>
                <button onClick={() => toggleMut.mutate({ id: t.id, isActive: !t.isActive })} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', padding: '0 2px' }} title={t.isActive ? 'Desativar' : 'Ativar'}>{t.isActive ? '⏸' : '▶️'}</button>
                <button onClick={() => deleteMut.mutate({ id: t.id })} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', color: '#dc2626', padding: '0 2px' }}>✕</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </DataCard>
  )
}

// ─── Tabela de Verificação (Prestação) ───────────────────────────────────────
function TabelaVerificacao({ trip }: { trip: any }) {
  const expenses: any[] = trip.expenses ?? []
  if (!expenses.length) return <div style={{ textAlign: 'center', color: '#94a3b8', fontSize: '13px', padding: '24px' }}>Nenhuma despesa lançada.</div>
  const byDate: Record<string, any[]> = {}
  for (const e of expenses) { const d = new Date(e.date).toISOString().slice(0, 10); if (!byDate[d]) byDate[d] = []; byDate[d].push(e) }
  const tiposSet = new Set<string>()
  for (const e of expenses) tiposSet.add(e.type)
  const tipos = Array.from(tiposSet).sort()
  const datas = Object.keys(byDate).sort()
  const totaisPorTipo: Record<string, number> = {}
  for (const tipo of tipos) totaisPorTipo[tipo] = 0
  const rows = datas.map(d => {
    const row: Record<string, number> = {}
    for (const tipo of tipos) row[tipo] = 0
    for (const e of byDate[d]) row[e.type] = (row[e.type] ?? 0) + Number(e.value)
    for (const tipo of tipos) totaisPorTipo[tipo] += row[tipo]
    const total = Object.values(row).reduce((a, b) => a + b, 0)
    const data = new Date(d + 'T12:00:00')
    const lojas = [...new Set(byDate[d].map((e: any) => e.storeName).filter(Boolean))].join(', ')
    return { data, d, row, total, lojas }
  })
  const totalGeral = rows.reduce((s, r) => s + r.total, 0)
  const thSt: React.CSSProperties = { padding: '10px 12px', textAlign: 'left', fontSize: '12px', fontWeight: '700', color: '#64748b', background: '#f8fafc', borderBottom: '2px solid #e2e8f0', whiteSpace: 'nowrap' }
  const tdSt: React.CSSProperties = { padding: '9px 12px', fontSize: '13px', color: '#0f172a', borderBottom: '1px solid #f1f5f9' }
  const tdNum: React.CSSProperties = { ...tdSt, textAlign: 'right', fontWeight: '600', color: '#1e40af' }
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
        <thead><tr>
          <th style={thSt}>Data</th><th style={thSt}>Dia de semana</th>
          <th style={{ ...thSt, minWidth: '120px' }}>Lojas</th>
          {tipos.map(t => <th key={t} style={{ ...thSt, textAlign: 'right' }}>{t}</th>)}
          <th style={{ ...thSt, textAlign: 'right', color: '#0f172a' }}>Total</th>
        </tr></thead>
        <tbody>{rows.map(r => (
          <tr key={r.d}>
            <td style={tdSt}>{r.data.toLocaleDateString('pt-BR')}</td>
            <td style={{ ...tdSt, color: '#64748b' }}>{DIAS_SEMANA[r.data.getDay()]}</td>
            <td style={{ ...tdSt, color: '#64748b', fontSize: '12px' }}>{r.lojas || '—'}</td>
            {tipos.map(t => <td key={t} style={r.row[t] > 0 ? tdNum : { ...tdSt, textAlign: 'right', color: '#cbd5e1' }}>{r.row[t] > 0 ? formatCurrency(r.row[t]) : '—'}</td>)}
            <td style={{ ...tdNum, fontWeight: '800', color: '#0f172a' }}>{formatCurrency(r.total)}</td>
          </tr>
        ))}</tbody>
        <tfoot><tr style={{ background: '#f8fafc' }}>
          <td colSpan={3} style={{ ...tdSt, fontWeight: '700', borderTop: '2px solid #e2e8f0' }}>Total</td>
          {tipos.map(t => <td key={t} style={{ ...tdNum, borderTop: '2px solid #e2e8f0' }}>{formatCurrency(totaisPorTipo[t])}</td>)}
          <td style={{ ...tdNum, borderTop: '2px solid #e2e8f0', fontWeight: '900', color: '#0f172a', fontSize: '15px' }}>{formatCurrency(totalGeral)}</td>
        </tr></tfoot>
      </table>
    </div>
  )
}

// ─── Modal Prestação de Contas ────────────────────────────────────────────────
function PrestacaoModal({ trip, onClose }: { trip: any; onClose: () => void }) {
  const utils = trpc.useUtils()
  const spentAmount = (trip.expenses ?? []).reduce((s: number, e: any) => s + Number(e.value), 0)
  const advancedAmount = Number(trip.advancedAmount ?? 0)
  const returnedAmount = Number(trip.returnedAmount ?? 0)
  const expectedReturn = Math.max(0, advancedAmount - spentAmount)
  const settled = returnedAmount > 0 && Math.abs(returnedAmount - expectedReturn) < 0.01
  const [devolvido, setDevolvido] = useState(returnedAmount > 0 ? returnedAmount.toFixed(2).replace('.', ',') : '')
  const [comprovante, setComprovante] = useState(trip.returnProofUrl ?? '')
  const [nota, setNota] = useState(trip.returnProofNote ?? '')
  const [saving, setSaving] = useState(false)
  const settleMut = trpc.auditTrips.updateSettlement.useMutation({ onSuccess: () => { utils.auditTrips.list.invalidate(); utils.auditTrips.getById.invalidate({ id: trip.id }); setSaving(false) }, onError: () => setSaving(false) })
  function handleSave() { setSaving(true); settleMut.mutate({ id: trip.id, returnedAmount: devolvido ? parseMoney(devolvido) : 0, returnProofUrl: comprovante || undefined, returnProofNote: nota || undefined, returnedAt: devolvido ? new Date() : undefined }) }
  const cardSt = (color: string, bg: string): React.CSSProperties => ({ background: bg, border: `1.5px solid ${color}`, borderRadius: '12px', padding: '14px 18px', textAlign: 'center', flex: 1, minWidth: '100px' })
  return (
    <Modal title={`Prestação de Contas — ${trip.collaborator?.name ?? ''}`} onClose={onClose} wide>
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '24px' }}>
        <div style={cardSt('#bfdbfe','#eff6ff')}><div style={{ fontSize: '11px', fontWeight: '600', color: '#1e40af', marginBottom: '4px' }}>LIBERADO</div><div style={{ fontSize: '20px', fontWeight: '800', color: '#1e3a8a' }}>{formatCurrency(Number(trip.releasedAmount??0))}</div></div>
        <div style={cardSt('#bbf7d0','#f0fdf4')}><div style={{ fontSize: '11px', fontWeight: '600', color: '#166534', marginBottom: '4px' }}>ADIANTADO</div><div style={{ fontSize: '20px', fontWeight: '800', color: '#14532d' }}>{formatCurrency(advancedAmount)}</div></div>
        <div style={cardSt('#fde68a','#fffbeb')}><div style={{ fontSize: '11px', fontWeight: '600', color: '#92400e', marginBottom: '4px' }}>GASTO</div><div style={{ fontSize: '20px', fontWeight: '800', color: '#78350f' }}>{formatCurrency(spentAmount)}</div></div>
        <div style={cardSt(expectedReturn>0?'#fca5a5':'#bbf7d0',expectedReturn>0?'#fef2f2':'#f0fdf4')}><div style={{ fontSize: '11px', fontWeight: '600', color: expectedReturn>0?'#991b1b':'#166534', marginBottom: '4px' }}>A DEVOLVER</div><div style={{ fontSize: '20px', fontWeight: '800', color: expectedReturn>0?'#7f1d1d':'#14532d' }}>{formatCurrency(expectedReturn)}</div></div>
      </div>
      <div style={{ marginBottom: '24px' }}>
        <div style={{ fontSize: '13px', fontWeight: '700', color: '#0f172a', marginBottom: '10px' }}>Verificação por Dia</div>
        <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden' }}><TabelaVerificacao trip={trip} /></div>
      </div>
      <div style={{ background: settled?'#f0fdf4':'#f8fafc', border: `2px solid ${settled?'#86efac':'#e2e8f0'}`, borderRadius: '14px', padding: '20px', transition: 'all 0.3s' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: settled?'#22c55e':'#f59e0b' }} />
          <span style={{ fontSize: '14px', fontWeight: '700', color: settled?'#166534':'#92400e' }}>{settled?'✓ Prestação liquidada — valores conferem!':expectedReturn>0?'Aguardando devolução':'Sem saldo a devolver'}</span>
        </div>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <Field label="Valor devolvido (R$)" row><input style={inp} value={devolvido} onChange={e => setDevolvido(e.target.value)} placeholder="0,00" inputMode="decimal" /></Field>
          <Field label="Data da devolução" row><input style={inp} type="date" defaultValue={trip.returnedAt?new Date(trip.returnedAt).toISOString().slice(0,10):''} readOnly /></Field>
        </div>
        <Field label="Link / nº do comprovante" hint="PIX, transferência ou recibo"><input style={inp} value={comprovante} onChange={e => setComprovante(e.target.value)} placeholder="Ex: txid_abc123" /></Field>
        <Field label="Observações da devolução"><textarea style={{ ...inp, minHeight: '60px', resize: 'vertical' }} value={nota} onChange={e => setNota(e.target.value)} /></Field>
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <Btn variant="outline" onClick={onClose}>Fechar</Btn>
          <Btn onClick={handleSave} disabled={saving}>{saving?'Salvando...':'Salvar Liquidação'}</Btn>
        </div>
      </div>
    </Modal>
  )
}

// ─── Aba: Viagens ─────────────────────────────────────────────────────────────
function AbaViagens() {
  const [page, setPage] = useState(1)
  const [filterCollab, setFilterCollab] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [editTripId, setEditTripId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({ reason: '', observations: '', status: 'OPEN' })
  const [showExpense, setShowExpense] = useState(false)
  const [expenseTripId, setExpenseTripId] = useState<string | null>(null)
  const [expForm, setExpForm] = useState({ collaboratorId: '', type: '', paymentMethod: 'Adiantamento', date: new Date().toISOString().slice(0,10), value: '', storeName: '', cityUf: '', description: '', observations: '' })
  const [expandedTrip, setExpandedTrip] = useState<string | null>(null)
  const [prestacaoTripId, setPrestacaoTripId] = useState<string | null>(null)
  const [deleteTripId, setDeleteTripId] = useState<string | null>(null)
  const [error, setError] = useState('')

  const utils = trpc.useUtils()
  const { data, isLoading } = trpc.auditTrips.list.useQuery({ page, pageSize: 15, collaboratorId: filterCollab || undefined })
  const { data: collabs } = trpc.auditCollaborators.list.useQuery()
  const { data: costTypes } = trpc.auditCostTypes.list.useQuery()
  const { data: storesData } = trpc.stores.list.useQuery({ pageSize: 200 })
  const { data: tripDetail } = trpc.auditTrips.getById.useQuery({ id: expandedTrip! }, { enabled: !!expandedTrip })
  const { data: prestacaoDetail } = trpc.auditTrips.getById.useQuery({ id: prestacaoTripId! }, { enabled: !!prestacaoTripId })
  const storesList = storesData?.stores ?? []
  const tiposDisponiveis = costTypes && costTypes.length > 0 ? costTypes.map((t: any) => t.name) : DEFAULT_COST_TYPES

  const updateTripMut = trpc.auditTrips.update.useMutation({ onSuccess: () => { utils.auditTrips.list.invalidate(); setEditTripId(null); setError('') }, onError: e => setError(e.message) })
  const deleteTripMut = trpc.auditTrips.delete.useMutation({ onSuccess: () => { utils.auditTrips.list.invalidate(); setDeleteTripId(null) } })
  const createExpMut = trpc.auditCost.createExpense.useMutation({
    onSuccess: () => { utils.auditTrips.list.invalidate(); if (expandedTrip) utils.auditTrips.getById.invalidate({ id: expandedTrip }); if (prestacaoTripId) utils.auditTrips.getById.invalidate({ id: prestacaoTripId }); setShowExpense(false); setError('') },
    onError: e => setError(e.message),
  })
  const deleteExpMut = trpc.auditCost.deleteExpense.useMutation({ onSuccess: () => { if (expandedTrip) utils.auditTrips.getById.invalidate({ id: expandedTrip }); utils.auditTrips.list.invalidate() } })

  function setE(k: string, v: string) { setExpForm(f => ({ ...f, [k]: v })) }

  const trips = data?.trips ?? []

  return (
    <>
      {/* Modal Nova Viagem (novo fluxo) */}
      {showNew && (
        <NovaTripModal
          onClose={() => setShowNew(false)}
          collabsList={collabs ?? []}
          storesList={storesList}
          costTypes={costTypes ?? []}
        />
      )}

      {/* Modal Editar Viagem (simplificado) */}
      {editTripId && (
        <Modal title="Editar Viagem" onClose={() => { setEditTripId(null); setError('') }}>
          {error && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '10px 14px', marginBottom: '16px', fontSize: '13px', color: '#dc2626' }}>{error}</div>}
          <Field label="Motivo da Viagem"><input style={inp} value={editForm.reason} onChange={e => setEditForm(f => ({ ...f, reason: e.target.value }))} /></Field>
          <Field label="Status">
            <select style={inp} value={editForm.status} onChange={e => setEditForm(f => ({ ...f, status: e.target.value }))}>
              <option value="OPEN">Aberta</option>
              <option value="CLOSED">Fechada</option>
              <option value="CANCELLED">Cancelada</option>
            </select>
          </Field>
          <Field label="Observações"><textarea style={{ ...inp, minHeight: '60px', resize: 'vertical' }} value={editForm.observations} onChange={e => setEditForm(f => ({ ...f, observations: e.target.value }))} /></Field>
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <Btn variant="outline" onClick={() => { setEditTripId(null); setError('') }}>Cancelar</Btn>
            <Btn onClick={() => updateTripMut.mutate({ id: editTripId, reason: editForm.reason || undefined, status: editForm.status, observations: editForm.observations || undefined })} disabled={updateTripMut.isPending}>{updateTripMut.isPending ? 'Salvando...' : 'Salvar'}</Btn>
          </div>
        </Modal>
      )}

      {/* Modal Despesa Avulsa */}
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
          <Field label="Tipo de Custo *">
            <select style={inp} value={expForm.type} onChange={e => setE('type', e.target.value)}>
              <option value="">Selecione o tipo...</option>
              {tiposDisponiveis.map((c: string) => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Forma de Pagamento">
            <select style={inp} value={expForm.paymentMethod} onChange={e => setE('paymentMethod', e.target.value)}>
              {PAYMENT_METHODS.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </Field>
          <Field label="Loja">
            <select style={inp} value={expForm.storeName} onChange={e => { const s = storesList.find((x: any) => x.name === e.target.value); setE('storeName', e.target.value); if (s?.city) setE('cityUf', `${s.city}/${s.state}`) }}>
              <option value="">—</option>
              {storesList.map((s: any) => <option key={s.id} value={s.name}>{s.code ? `[${s.code}] ` : ''}{s.name}{s.city ? ` — ${s.city}` : ''}</option>)}
            </select>
          </Field>
          <Field label="Cidade / UF"><input style={inp} value={expForm.cityUf} onChange={e => setE('cityUf', e.target.value)} placeholder="Ex: São Paulo/SP" /></Field>
          <Field label="Descrição"><input style={inp} value={expForm.description} onChange={e => setE('description', e.target.value)} /></Field>
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <Btn variant="outline" onClick={() => { setShowExpense(false); setError('') }}>Cancelar</Btn>
            <Btn onClick={() => {
              if (!expenseTripId || !expForm.collaboratorId || !expForm.value || !expForm.type) { setError('Preencha colaborador, tipo e valor.'); return }
              createExpMut.mutate({ tripId: expenseTripId, auditorId: expForm.collaboratorId, collaboratorId: expForm.collaboratorId, type: expForm.type, paymentMethod: expForm.paymentMethod, date: new Date(expForm.date), value: Number(expForm.value.replace(',', '.')), storeName: expForm.storeName || undefined, cityUf: expForm.cityUf || undefined, description: expForm.description || undefined })
            }} disabled={createExpMut.isPending}>{createExpMut.isPending ? 'Salvando...' : 'Lançar'}</Btn>
          </div>
        </Modal>
      )}

      {/* Modal Prestação */}
      {prestacaoTripId && prestacaoDetail && <PrestacaoModal trip={prestacaoDetail} onClose={() => setPrestacaoTripId(null)} />}

      {/* Modal Exclusão */}
      {deleteTripId && (
        <Modal title="Confirmar Exclusão" onClose={() => setDeleteTripId(null)}>
          <div style={{ padding: '8px 0 24px', fontSize: '15px', color: '#374151' }}>Excluir esta viagem e todas as despesas?</div>
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <Btn variant="outline" onClick={() => setDeleteTripId(null)}>Cancelar</Btn>
            <Btn variant="danger" onClick={() => deleteTripMut.mutate({ id: deleteTripId })} disabled={deleteTripMut.isPending}>Excluir</Btn>
          </div>
        </Modal>
      )}

      {/* Filtros + ação */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center' }}>
        <select value={filterCollab} onChange={e => { setFilterCollab(e.target.value); setPage(1) }} style={{ padding: '8px 14px', borderRadius: '10px', border: '1.5px solid #e2e8f0', fontSize: '14px', minWidth: '200px' }}>
          <option value="">Todos os colaboradores</option>
          {(collabs ?? []).map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <Btn onClick={() => setShowNew(true)}>+ Nova Viagem</Btn>
      </div>

      <DataCard title={`Viagens (${data?.meta?.total ?? 0})`}>
        {isLoading ? <LoadingState /> : !trips.length ? (
          <EmptyState icon="✈️" title="Nenhuma viagem" description='Clique em "+ Nova Viagem" para cadastrar.' />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {trips.map((t: any) => {
              const spentAmount = Number(t.spentAmount ?? 0)
              const advancedAmount = Number(t.advancedAmount ?? 0)
              const returnedAmount = Number(t.returnedAmount ?? 0)
              const expectedReturn = Math.max(0, advancedAmount - spentAmount)
              const settled = returnedAmount > 0 && Math.abs(returnedAmount - expectedReturn) < 0.01
              const isOver = spentAmount > Number(t.releasedAmount ?? 0)
              const isExpanded = expandedTrip === t.id
              const pct = Number(t.releasedAmount) > 0 ? Math.min(100, (spentAmount / Number(t.releasedAmount)) * 100) : 0
              let borderColor = '#e2e8f0'
              if (settled) borderColor = '#86efac'
              else if (isOver) borderColor = '#fecaca'
              else if (expectedReturn > 0 && advancedAmount > 0) borderColor = '#fde68a'
              return (
                <div key={t.id} style={{ border: `2px solid ${borderColor}`, borderRadius: '14px', overflow: 'hidden', background: settled ? '#f0fdf4' : isOver ? '#fff5f5' : 'white', transition: 'border-color 0.3s' }}>
                  <div style={{ padding: '16px', cursor: 'pointer' }} onClick={() => setExpandedTrip(isExpanded ? null : t.id)}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap' }}>
                      <div style={{ flex: 1, minWidth: '160px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: '700', fontSize: '15px', color: '#0f172a' }}>{t.collaborator?.name ?? '—'}</span>
                          {t.collaborator?.role && <span style={{ fontSize: '12px', color: '#64748b' }}>{t.collaborator.role}</span>}
                          <span style={{ padding: '2px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: '600', background: t.status === 'OPEN' ? '#dbeafe' : '#f1f5f9', color: t.status === 'OPEN' ? '#1d4ed8' : '#64748b' }}>{STATUS_LABELS[t.status] ?? t.status}</span>
                          {settled && <span style={{ padding: '2px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: '700', background: '#dcfce7', color: '#166534' }}>✓ Liquidada</span>}
                        </div>
                        <div style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>{t.reason && <span>{t.reason}</span>}{t.city && <span> · {t.city}{t.state ? `/${t.state}` : ''}</span>}{t.stores && <span> · {t.stores}</span>}</div>
                        <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>{formatDate(t.startDate)} → {formatDate(t.endDate)}</div>
                      </div>
                      <div style={{ textAlign: 'right', minWidth: '130px' }}>
                        <div style={{ fontSize: '18px', fontWeight: '800', color: isOver ? '#dc2626' : '#0f172a' }}>{formatCurrency(spentAmount)}</div>
                        <div style={{ fontSize: '12px', color: '#64748b' }}>de {formatCurrency(Number(t.releasedAmount ?? 0))} liberado</div>
                        {advancedAmount > 0 && <div style={{ fontSize: '12px', color: '#64748b' }}>adiantado: {formatCurrency(advancedAmount)}</div>}
                        {expectedReturn > 0 && !settled && <div style={{ fontSize: '12px', fontWeight: '700', color: '#d97706', marginTop: '2px' }}>↩ devolver: {formatCurrency(expectedReturn)}</div>}
                        {settled && <div style={{ fontSize: '12px', fontWeight: '700', color: '#16a34a', marginTop: '2px' }}>✓ {formatCurrency(returnedAmount)} devolvido</div>}
                      </div>
                    </div>
                    {Number(t.releasedAmount) > 0 && <div style={{ marginTop: '10px', background: '#f1f5f9', borderRadius: '4px', height: '6px' }}><div style={{ background: isOver ? '#dc2626' : pct > 80 ? '#f59e0b' : '#22c55e', borderRadius: '4px', height: '6px', width: `${Math.min(100, pct)}%`, transition: 'width 0.5s' }} /></div>}
                  </div>
                  <div style={{ padding: '0 16px 14px', display: 'flex', gap: '6px', borderTop: '1px solid #f1f5f9', paddingTop: '10px', flexWrap: 'wrap' }}>
                    <button onClick={() => { setExpenseTripId(t.id); setExpForm(f => ({ ...f, collaboratorId: t.collaboratorId ?? '' })); setShowExpense(true) }} style={{ padding: '6px 12px', borderRadius: '8px', border: '1px solid #d1d5db', background: 'white', fontSize: '12px', cursor: 'pointer', fontWeight: '600' }}>+ Despesa</button>
                    <button onClick={() => setPrestacaoTripId(t.id)} style={{ padding: '6px 12px', borderRadius: '8px', border: `1px solid ${settled ? '#86efac' : '#fde68a'}`, background: settled ? '#f0fdf4' : '#fffbeb', fontSize: '12px', cursor: 'pointer', fontWeight: '600', color: settled ? '#166534' : '#92400e' }}>📊 Prestação</button>
                    <button onClick={() => { setEditForm({ reason: t.reason ?? '', observations: t.observations ?? '', status: t.status ?? 'OPEN' }); setEditTripId(t.id); setError('') }} style={{ padding: '6px 12px', borderRadius: '8px', border: '1px solid #d1d5db', background: 'white', fontSize: '12px', cursor: 'pointer' }}>Editar</button>
                    <button onClick={() => setExpandedTrip(isExpanded ? null : t.id)} style={{ padding: '6px 12px', borderRadius: '8px', border: '1px solid #d1d5db', background: 'white', fontSize: '12px', cursor: 'pointer' }}>{isExpanded ? 'Ocultar' : 'Ver Despesas'}</button>
                    <button onClick={() => setDeleteTripId(t.id)} style={{ padding: '6px 12px', borderRadius: '8px', border: '1px solid #fecaca', background: '#fef2f2', fontSize: '12px', cursor: 'pointer', color: '#dc2626' }}>Excluir</button>
                  </div>
                  {isExpanded && (
                    <div style={{ borderTop: '1px solid #f1f5f9', padding: '16px', background: '#f8fafc' }}>
                      {!tripDetail?.expenses?.length ? <div style={{ textAlign: 'center', color: '#94a3b8', fontSize: '13px', padding: '12px' }}>Nenhuma despesa lançada</div> : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {tripDetail.expenses.map((e: any) => (
                            <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'white', borderRadius: '10px', padding: '10px 14px', border: '1px solid #e2e8f0', flexWrap: 'wrap', gap: '8px' }}>
                              <div style={{ flex: 1, minWidth: '140px' }}>
                                <div style={{ fontWeight: '600', fontSize: '14px', color: '#0f172a' }}>{e.type}</div>
                                <div style={{ fontSize: '12px', color: '#64748b' }}>{e.description || '—'}{e.storeName ? ` · ${e.storeName}` : ''}</div>
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
    </>
  )
}

// ─── Página raiz com abas ─────────────────────────────────────────────────────
type Tab = 'viagens' | 'colaboradores' | 'tipos'

export default function ViagensPage() {
  const [tab, setTab] = useState<Tab>('viagens')
  const tabStyle = (active: boolean): React.CSSProperties => ({ padding: '9px 20px', borderRadius: '10px', border: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: active ? '700' : '500', background: active ? '#0f172a' : 'transparent', color: active ? 'white' : '#64748b', transition: 'all 0.15s' })
  return (
    <ModulePage title="Custo de Auditoria — Viagens" description="Gerencie colaboradores, tipos de custo e cadastre viagens com prestação de contas">
      <div style={{ display: 'flex', gap: '4px', background: '#f1f5f9', padding: '4px', borderRadius: '14px', width: 'fit-content' }}>
        <button style={tabStyle(tab === 'viagens')} onClick={() => setTab('viagens')}>✈️ Viagens</button>
        <button style={tabStyle(tab === 'colaboradores')} onClick={() => setTab('colaboradores')}>👥 Colaboradores</button>
        <button style={tabStyle(tab === 'tipos')} onClick={() => setTab('tipos')}>🏷️ Tipos de Custo</button>
      </div>
      {tab === 'viagens' && <AbaViagens />}
      {tab === 'colaboradores' && <AbaColaboradores />}
      {tab === 'tipos' && <AbaTiposCusto />}
    </ModulePage>
  )
}
