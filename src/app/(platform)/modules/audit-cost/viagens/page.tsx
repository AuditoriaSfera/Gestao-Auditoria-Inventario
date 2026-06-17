'use client'

export const dynamic = 'force-dynamic'

import React, { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { trpc } from '@/lib/trpc'
import { ModulePage, DataCard, EmptyState, LoadingState, Btn } from '@/components/shared/module-page'
import { formatDate, formatCurrency } from '@/lib/utils'

const STATUS_LABELS: Record<string, string> = { OPEN: 'Aberta', CLOSED: 'Fechada', CANCELLED: 'Cancelada', SUBMITTED: 'Enviada' }
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
          <div style={{ padding: '8px 12px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '12px', color: '#64748b' }}>{selectedIds.length} loja(s)</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              {selectedIds.length > 0 && (
                <button onClick={() => onChange([])} style={{ fontSize: '12px', color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer' }}>Limpar</button>
              )}
              <button onClick={() => { setOpen(false); setSearch('') }} style={{ fontSize: '12px', fontWeight: '600', color: 'white', background: '#2563eb', border: 'none', borderRadius: '8px', padding: '6px 16px', cursor: 'pointer' }}>Confirmar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Multi-select de Colaboradores (filtro) ──────────────────────────────────
function CollabMultiSelect({ collabs, selectedIds, onChange }: { collabs: any[]; selectedIds: string[]; onChange: (ids: string[]) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const selected = collabs.filter(c => selectedIds.includes(c.id))
  function toggle(id: string) { onChange(selectedIds.includes(id) ? selectedIds.filter(x => x !== id) : [...selectedIds, id]) }
  useEffect(() => {
    function onClickOutside(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <div onClick={() => setOpen(o => !o)} style={{ padding: '8px 12px', borderRadius: '8px', border: '1.5px solid #e2e8f0', fontSize: '13px', background: 'white', cursor: 'pointer', minHeight: '38px', display: 'flex', flexWrap: 'wrap', gap: '4px', alignItems: 'center' }}>
        {!selectedIds.length && <span style={{ color: '#94a3b8' }}>Todos</span>}
        {selected.map((c: any) => (
          <span key={c.id} style={{ background: '#dbeafe', color: '#1e40af', fontSize: '12px', fontWeight: '600', padding: '2px 8px', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '4px' }}>
            {c.name}
            <button onClick={e => { e.stopPropagation(); toggle(c.id) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#1e40af', lineHeight: 1, padding: 0, fontSize: '13px' }}>×</button>
          </span>
        ))}
        <span style={{ marginLeft: 'auto', color: '#94a3b8', fontSize: '11px', flexShrink: 0 }}>{open ? '▲' : '▼'}</span>
      </div>
      {open && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100, background: 'white', border: '1.5px solid #e2e8f0', borderRadius: '10px', boxShadow: '0 8px 24px rgba(0,0,0,0.12)', marginTop: '4px', minWidth: '200px' }}>
          <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
            {collabs.map((c: any) => {
              const isSel = selectedIds.includes(c.id)
              return (
                <div key={c.id} onClick={() => toggle(c.id)} style={{ padding: '9px 14px', cursor: 'pointer', background: isSel ? '#eff6ff' : 'transparent', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px' }}
                  onMouseEnter={e => { if (!isSel) (e.currentTarget as HTMLElement).style.background = '#f8fafc' }}
                  onMouseLeave={e => { if (!isSel) (e.currentTarget as HTMLElement).style.background = 'transparent' }}>
                  <div style={{ width: '16px', height: '16px', borderRadius: '4px', border: `2px solid ${isSel ? '#2563eb' : '#d1d5db'}`, background: isSel ? '#2563eb' : 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {isSel && <span style={{ color: 'white', fontSize: '10px' }}>✓</span>}
                  </div>
                  <span style={{ color: '#0f172a' }}>{c.name}</span>
                  {c.role && <span style={{ color: '#94a3b8', fontSize: '12px', marginLeft: 'auto' }}>{c.role}</span>}
                </div>
              )
            })}
          </div>
          <div style={{ padding: '8px 12px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', color: '#64748b' }}>{selectedIds.length} selecionado(s)</span>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              {selectedIds.length > 0 && <button onClick={() => onChange([])} style={{ fontSize: '12px', color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer' }}>Limpar</button>}
              <button onClick={() => setOpen(false)} style={{ fontSize: '12px', fontWeight: '600', color: 'white', background: '#2563eb', border: 'none', borderRadius: '8px', padding: '5px 14px', cursor: 'pointer' }}>Confirmar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Multi-select inline para Loja do dia ────────────────────────────────────
function LojasDoDiaSelect({ options, selected, onChange }: { options: string[]; selected: string[]; onChange: (v: string[]) => void }) {
  const [open, setOpen] = useState(false)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const triggerRef = useRef<HTMLDivElement>(null)
  const dropRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handler(e: MouseEvent) {
      const inTrigger = triggerRef.current?.contains(e.target as Node)
      const inDrop = dropRef.current?.contains(e.target as Node)
      if (!inTrigger && !inDrop) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  function handleToggle() {
    if (!open && triggerRef.current) setRect(triggerRef.current.getBoundingClientRect())
    setOpen(o => !o)
  }

  function toggle(s: string) { onChange(selected.includes(s) ? selected.filter(x => x !== s) : [...selected, s]) }
  const allSelected = options.length > 0 && selected.length === options.length
  const label = selected.length === 0 ? null : allSelected ? `Todas (${options.length})` : selected.length > 1 ? `${selected.length} lojas` : selected[0]

  const spaceBelow = rect ? window.innerHeight - rect.bottom : 400
  const openAbove = spaceBelow < 260
  const dropStyle: React.CSSProperties = rect ? {
    position: 'fixed',
    left: rect.left,
    minWidth: Math.max(rect.width, 220),
    zIndex: 99999,
    background: 'white',
    border: '1.5px solid #e2e8f0',
    borderRadius: '10px',
    boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
    overflowY: 'auto',
    ...(openAbove
      ? { bottom: window.innerHeight - rect.top + 2, maxHeight: Math.min(rect.top - 16, 280) }
      : { top: rect.bottom + 2, maxHeight: Math.min(spaceBelow - 16, 280) }),
  } : {}

  const dropdown = open && rect ? (
    <div ref={dropRef} style={dropStyle}>
      <div style={{ padding: '8px 12px', borderBottom: '1px solid #f1f5f9', display: 'flex', gap: '12px', alignItems: 'center', position: 'sticky', top: 0, background: 'white', zIndex: 1 }}>
        <button onClick={() => onChange([...options])} style={{ fontSize: '12px', color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer', fontWeight: '600' }}>Todas</button>
        <button onClick={() => onChange([])} style={{ fontSize: '12px', color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer' }}>Limpar</button>
      </div>
      {options.map(s => {
        const isSel = selected.includes(s)
        return (
          <div key={s} onClick={() => toggle(s)} style={{ padding: '9px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', background: isSel ? '#eff6ff' : 'transparent' }}
            onMouseEnter={e => { if (!isSel) (e.currentTarget as HTMLElement).style.background = '#f8fafc' }}
            onMouseLeave={e => { if (!isSel) (e.currentTarget as HTMLElement).style.background = 'transparent' }}>
            <div style={{ width: '16px', height: '16px', borderRadius: '4px', border: `2px solid ${isSel ? '#2563eb' : '#d1d5db'}`, background: isSel ? '#2563eb' : 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              {isSel && <span style={{ color: 'white', fontSize: '10px', lineHeight: 1 }}>✓</span>}
            </div>
            <span style={{ fontSize: '13px', color: '#0f172a' }}>{s}</span>
          </div>
        )
      })}
      <div style={{ padding: '8px 12px', borderTop: '1px solid #f1f5f9', textAlign: 'right', position: 'sticky', bottom: 0, background: 'white' }}>
        <button onClick={() => setOpen(false)} style={{ fontSize: '12px', fontWeight: '600', color: 'white', background: '#2563eb', border: 'none', borderRadius: '6px', padding: '6px 16px', cursor: 'pointer' }}>Confirmar</button>
      </div>
    </div>
  ) : null

  return (
    <div ref={triggerRef}>
      <div onClick={handleToggle} style={{ ...inpSm, cursor: 'pointer', minHeight: '38px', display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 10px', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '13px', color: label ? '#0f172a' : '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{label ?? 'Selecionar loja...'}</span>
        <span style={{ color: '#94a3b8', fontSize: '10px', flexShrink: 0, marginLeft: '6px' }}>{open ? '▲' : '▼'}</span>
      </div>
      {typeof document !== 'undefined' && dropdown ? createPortal(dropdown, document.body) : null}
    </div>
  )
}

// ─── Tabela Diária de Colaborador ─────────────────────────────────────────────
type DayRow = { storeNames: string[]; values: Record<string, string> }

function TabelaDiaria({
  dates, storeOptions, tipos, rows, onChange
}: {
  dates: string[]
  storeOptions: string[]
  tipos: string[]
  rows: Record<string, DayRow>
  onChange: (rows: Record<string, DayRow>) => void
}) {
  function setStores(d: string, v: string[]) {
    onChange({ ...rows, [d]: { ...rows[d], storeNames: v } })
  }
  function setValue(d: string, tipo: string, v: string) {
    onChange({ ...rows, [d]: { ...rows[d], values: { ...rows[d]?.values, [tipo]: v } } })
  }
  if (!dates.length) return <div style={{ padding: '16px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>Defina as datas da viagem para preencher a tabela.</div>

  const stickyBase: React.CSSProperties = { position: 'sticky', zIndex: 2, background: '#f8fafc' }
  const thSt: React.CSSProperties = { padding: '10px 10px', fontSize: '11px', fontWeight: '700', color: '#64748b', background: '#f8fafc', borderBottom: '2px solid #e2e8f0', whiteSpace: 'nowrap', textAlign: 'left' }
  const tdSt: React.CSSProperties = { padding: '8px 8px', borderBottom: '1px solid #f1f5f9', verticalAlign: 'middle' }

  const totaisPorTipo: Record<string, number> = {}
  for (const tipo of tipos) totaisPorTipo[tipo] = 0
  for (const d of dates) for (const tipo of tipos) totaisPorTipo[tipo] += parseMoney(rows[d]?.values?.[tipo] ?? '')
  const totalGeral = Object.values(totaisPorTipo).reduce((a, b) => a + b, 0)

  return (
    <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden' }}>
      {/* Scroll interno: horizontal para colunas extras, vertical para muitos dias */}
      <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: '520px' }}>
        <table style={{ borderCollapse: 'collapse', fontSize: '13px', width: '100%' }}>
          <thead>
            <tr>
              {/* Colunas fixas (sticky) — sempre visíveis */}
              <th style={{ ...thSt, ...stickyBase, left: 0, minWidth: '90px', borderRight: '1px solid #e2e8f0' }}>Data</th>
              <th style={{ ...thSt, ...stickyBase, left: '90px', minWidth: '90px', borderRight: '1px solid #e2e8f0' }}>Dia</th>
              <th style={{ ...thSt, ...stickyBase, left: '180px', minWidth: '200px', borderRight: '2px solid #e2e8f0' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                  <span>Loja do dia</span>
                  <button
                    onClick={() => {
                      const updated = { ...rows }
                      for (const d of dates) updated[d] = { ...updated[d], storeNames: [...storeOptions] }
                      onChange(updated)
                    }}
                    style={{ fontSize: '10px', fontWeight: '600', color: '#2563eb', background: '#eff6ff', border: 'none', borderRadius: '4px', padding: '2px 7px', cursor: 'pointer', whiteSpace: 'nowrap' }}
                  >Marcar todas</button>
                </div>
              </th>
              {/* Colunas de despesa — rolam lateralmente */}
              {tipos.map(t => (
                <th key={t} style={{ ...thSt, minWidth: '110px', textAlign: 'right' }}>{t}</th>
              ))}
              <th style={{ ...thSt, textAlign: 'right', minWidth: '90px' }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {dates.map(d => {
              const row = rows[d] ?? { storeNames: [], values: {} }
              const total = tipos.reduce((s, t) => s + parseMoney(row.values?.[t] ?? ''), 0)
              return (
                <tr key={d}>
                  <td style={{ ...tdSt, ...stickyBase, left: 0, fontWeight: '600', color: '#0f172a', borderRight: '1px solid #e2e8f0' }}>{fmtDate(d)}</td>
                  <td style={{ ...tdSt, ...stickyBase, left: '90px', color: '#64748b', fontSize: '12px', borderRight: '1px solid #e2e8f0' }}>{diaSemana(d)}</td>
                  <td style={{ ...tdSt, ...stickyBase, left: '180px', borderRight: '2px solid #e2e8f0' }}>
                    <LojasDoDiaSelect options={storeOptions} selected={row.storeNames ?? []} onChange={v => setStores(d, v)} />
                  </td>
                  {tipos.map(t => (
                    <td key={t} style={{ ...tdSt, textAlign: 'right' }}>
                      <input
                        value={row.values?.[t] ?? ''}
                        onChange={e => setValue(d, t, e.target.value)}
                        placeholder="—"
                        inputMode="decimal"
                        style={{ ...inpSm, textAlign: 'right', width: '100px' }}
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
              <td colSpan={3} style={{ ...tdSt, ...stickyBase, left: 0, fontWeight: '700', borderTop: '2px solid #e2e8f0', borderRight: '2px solid #e2e8f0' }}>Total</td>
              {tipos.map(t => (
                <td key={t} style={{ ...tdSt, textAlign: 'right', fontWeight: '700', color: '#1e40af', borderTop: '2px solid #e2e8f0', background: '#f8fafc' }}>
                  {totaisPorTipo[t] > 0 ? formatCurrency(totaisPorTipo[t]) : '—'}
                </td>
              ))}
              <td style={{ ...tdSt, textAlign: 'right', fontWeight: '900', color: '#0f172a', borderTop: '2px solid #e2e8f0', whiteSpace: 'nowrap', background: '#f8fafc' }}>
                {formatCurrency(totalGeral)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}

// ─── Modal Nova Viagem (fluxo novo) ───────────────────────────────────────────
type CollabEntry = { id: string; collaboratorId: string; advancedAmount: string; rows: Record<string, DayRow> }

function buildEmptyRows(dates: string[]): Record<string, DayRow> {
  const rows: Record<string, DayRow> = {}
  for (const d of dates) rows[d] = { storeNames: [], values: {} }
  return rows
}
function syncRows(prev: Record<string, DayRow>, newDates: string[]): Record<string, DayRow> {
  const result: Record<string, DayRow> = {}
  for (const d of newDates) result[d] = prev[d] ?? { storeNames: [], values: {} }
  return result
}

function NovaTripModal({ onClose, onCreated, collabsList, storesList, costTypes }: {
  onClose: () => void
  onCreated?: () => void
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
      const cityDisplay = cidadesInfo || (firstStore?.city ? `${firstStore.city}${firstStore.state ? `/${firstStore.state}` : ''}` : '')
      for (const entry of collabEntries) {
        const totalAllowance = dates.reduce((sum, d) => sum + tipos.reduce((s, t) => s + parseMoney(entry.rows[d]?.values?.[t] ?? ''), 0), 0)
        const trip = await createTripMut.mutateAsync({
          collaboratorId: entry.collaboratorId,
          stores: storeNames,
          city: cityDisplay || undefined,
          state: undefined,
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
                storeName: row.storeNames?.length ? row.storeNames.join(', ') : undefined,
                cityUf: row.storeNames?.length ? cidadesInfo || undefined : undefined,
                paymentMethod: 'Adiantamento',
              })
            }
          }
        }
      }
      utils.auditTrips.list.invalidate()
      onCreated ? onCreated() : onClose()
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
                    {collabsList
                      .filter((c: any) => c.id === entry.collaboratorId || !collabEntries.some(e => e.id !== entry.id && e.collaboratorId === c.id))
                      .map((c: any) => <option key={c.id} value={c.id}>{c.name}{c.role ? ` — ${c.role}` : ''}</option>)}
                  </select>
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
type NewLancamento = { value: string }

function TabelaVerificacao({ trip }: { trip: any }) {
  const allExpenses: any[] = trip.expenses ?? []
  // Originals = solicitações (advances, locked) — gastos = lançamentos de prestação
  const originalExp = allExpenses.filter((e: any) => e.subtype !== 'gasto')
  const gastoExp    = allExpenses.filter((e: any) => e.subtype === 'gasto')

  const utils = trpc.useUtils()
  const pendingSaveRef = useRef<{ key: string; idx: number } | null>(null)
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)

  const [attachments, setAttachments] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {}
    for (const e of gastoExp) init[e.id] = e.attachmentUrl ?? ''
    return init
  })
  const [newRows, setNewRows] = useState<Record<string, NewLancamento[]>>({})
  const [savingAttach, setSavingAttach] = useState<string | null>(null)
  const [savingNew, setSavingNew] = useState<string | null>(null)

  const setAttachMut = trpc.auditCost.setExpenseAttachment.useMutation({
    onSuccess: () => { setSavingAttach(null); utils.auditTrips.getById.invalidate({ id: trip.id }) },
    onError: () => setSavingAttach(null),
  })
  const createMut = trpc.auditCost.createExpense.useMutation({
    onSuccess: () => {
      if (pendingSaveRef.current) {
        const { key, idx } = pendingSaveRef.current
        setNewRows(r => { const cp = [...(r[key] ?? [])]; cp.splice(idx, 1); return { ...r, [key]: cp } })
        pendingSaveRef.current = null
      }
      setSavingNew(null)
      utils.auditTrips.getById.invalidate({ id: trip.id })
    },
    onError: () => { pendingSaveRef.current = null; setSavingNew(null) },
  })
  const deleteExpMut = trpc.auditCost.deleteExpense.useMutation({
    onSuccess: () => utils.auditTrips.getById.invalidate({ id: trip.id }),
  })

  function saveAttachment(expId: string, url: string) {
    setSavingAttach(expId)
    setAttachMut.mutate({ id: expId, attachmentUrl: url || undefined })
  }
  function saveNewRow(date: string, type: string, idx: number) {
    const key = `${date}|${type}`
    const row = (newRows[key] ?? [])[idx]
    if (!row || !parseMoney(row.value)) return
    pendingSaveRef.current = { key, idx }
    setSavingNew(`${key}-${idx}`)
    const ref = (byDateOrig[date] ?? []).find((e: any) => e.type === type) ?? (byDateOrig[date] ?? [])[0]
    createMut.mutate({
      auditorId: trip.auditorId,
      tripId: trip.id,
      collaboratorId: trip.collaboratorId ?? undefined,
      subtype: 'gasto',
      type,
      storeName: ref?.storeName ?? trip.stores ?? undefined,
      paymentMethod: 'Gasto',
      date: new Date(date + 'T12:00:00'),
      value: parseMoney(row.value),
    })
  }
  // Build date maps
  const byDateOrig: Record<string, any[]> = {}
  for (const e of originalExp) {
    const d = new Date(e.date).toISOString().slice(0, 10)
    if (!byDateOrig[d]) byDateOrig[d] = []
    byDateOrig[d].push(e)
  }
  const byDateGasto: Record<string, any[]> = {}
  for (const e of gastoExp) {
    const d = new Date(e.date).toISOString().slice(0, 10)
    if (!byDateGasto[d]) byDateGasto[d] = []
    byDateGasto[d].push(e)
  }
  for (const k of Object.keys(newRows)) { const d = k.split('|')[0]; if (d && !byDateOrig[d]) byDateOrig[d] = [] }
  const datas = [...new Set([...Object.keys(byDateOrig), ...Object.keys(byDateGasto)])].sort()
  const totalGastoGeral = gastoExp.reduce((s: number, e: any) => s + Number(e.value), 0)
  const totalOrigGeral  = originalExp.reduce((s: number, e: any) => s + Number(e.value), 0)

  const thSt: React.CSSProperties = { padding: '9px 12px', fontSize: '11px', fontWeight: '700', color: '#64748b', background: '#f8fafc', borderBottom: '2px solid #e2e8f0', whiteSpace: 'nowrap', textAlign: 'left' }

  return (
    <div style={{ overflowX: 'auto' }}>
      {lightboxUrl && (
        <div
          onClick={() => setLightboxUrl(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'zoom-out' }}
        >
          <img src={lightboxUrl} alt="comprovante" style={{ maxWidth: '90vw', maxHeight: '90vh', borderRadius: '8px', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }} onClick={e => e.stopPropagation()} />
          <button onClick={() => setLightboxUrl(null)} style={{ position: 'absolute', top: '20px', right: '24px', background: 'rgba(255,255,255,0.15)', border: 'none', color: 'white', fontSize: '28px', cursor: 'pointer', borderRadius: '50%', width: '40px', height: '40px', lineHeight: '40px', textAlign: 'center' }}>✕</button>
        </div>
      )}
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ ...thSt, width: '110px' }}>Data</th>
            <th style={{ ...thSt, width: '160px' }}>Solicitação</th>
            <th style={thSt}>Lançamentos de Gasto</th>
            <th style={{ ...thSt, textAlign: 'right', width: '95px' }}>Adiantado</th>
            <th style={{ ...thSt, textAlign: 'right', width: '95px' }}>Total Gasto</th>
            <th style={{ ...thSt, textAlign: 'right', width: '95px' }}>Saldo</th>
          </tr>
        </thead>
        <tbody>
          {datas.length === 0 && (
            <tr><td colSpan={6} style={{ padding: '32px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>Nenhuma solicitação registrada nesta viagem.</td></tr>
          )}
          {datas.flatMap(d => {
            const dayOrig   = byDateOrig[d] ?? []
            const dayGastos = byDateGasto[d] ?? []
            const totalAdt  = dayOrig.reduce((s: number, e: any) => s + Number(e.value), 0)
            const totalGst  = dayGastos.reduce((s: number, e: any) => s + Number(e.value), 0)
            const saldo     = totalAdt - totalGst
            const data      = new Date(d + 'T12:00:00')
            const saldoColor = saldo > 0.01 ? '#15803d' : saldo < -0.01 ? '#dc2626' : '#64748b'
            const saldoBg   = saldo > 0.01 ? '#f0fdf4' : saldo < -0.01 ? '#fef2f2' : '#f8fafc'
            const gastosByType: Record<string, any[]> = {}
            for (const e of dayGastos) { if (!gastosByType[e.type]) gastosByType[e.type] = []; gastosByType[e.type].push(e) }
            const rows = dayOrig.length > 0 ? dayOrig : [null]
            const rowCount = rows.length

            return rows.map((orig: any, i: number) => {
              const type = orig?.type ?? ''
              const rowKey = `${d}|${type}`
              const typeGastos = orig ? (gastosByType[type] ?? []) : dayGastos
              const pending = newRows[rowKey] ?? []
              const isFirst = i === 0
              const totalTypeGasto = typeGastos.reduce((s: number, e: any) => s + Number(e.value), 0)
              const matched = orig && typeGastos.length > 0 && Math.abs(totalTypeGasto - Number(orig.value)) < 0.01

              return (
                <tr key={`${d}-${i}`} style={{ borderBottom: i === rowCount - 1 ? '2px solid #e2e8f0' : '1px solid #f1f5f9', verticalAlign: 'top' }}>

                  {/* ── Data ── */}
                  {isFirst && (
                    <td rowSpan={rowCount} style={{ padding: '12px 10px', background: '#f8fafc', borderRight: '1px solid #e2e8f0', verticalAlign: 'top' }}>
                      <div style={{ fontWeight: '700', fontSize: '12px', color: '#0f172a' }}>{data.toLocaleDateString('pt-BR')}</div>
                      <div style={{ fontSize: '10px', color: '#64748b', marginTop: '2px', textTransform: 'capitalize' }}>{DIAS_SEMANA[data.getDay()]}</div>
                    </td>
                  )}

                  {/* ── Solicitação (centro de custo) ── */}
                  <td style={{ padding: '10px 10px', borderRight: '1px solid #e2e8f0', verticalAlign: 'top' }}>
                    {orig ? (
                      <div style={{ padding: '5px 8px', background: matched ? '#dcfce7' : '#f1f5f9', borderRadius: '6px', border: `1px solid ${matched ? '#86efac' : '#e2e8f0'}` }}>
                        <div style={{ fontSize: '10px', fontWeight: '600', color: matched ? '#166534' : '#475569' }}>{orig.type}</div>
                        {orig.storeName && <div style={{ fontSize: '10px', color: matched ? '#16a34a' : '#94a3b8', marginTop: '1px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '130px' }}>{orig.storeName}</div>}
                        <div style={{ fontSize: '13px', fontWeight: '800', color: matched ? '#15803d' : '#0f172a', marginTop: '3px' }}>{formatCurrency(Number(orig.value))}</div>
                      </div>
                    ) : (
                      <span style={{ fontSize: '11px', color: '#94a3b8' }}>—</span>
                    )}
                  </td>

                  {/* ── Lançamentos deste centro de custo ── */}
                  <td style={{ padding: '10px 12px', borderRight: '1px solid #e2e8f0', background: matched ? '#f0fdf4' : 'transparent' }}>
                    {typeGastos.map((e: any) => {
                      const expId = e.id as string
                      const attachUrl = attachments[expId] || e.attachmentUrl || ''
                      const hasAttach = !!attachUrl
                      const isImg = hasAttach && attachUrl.startsWith('data:image')
                      const fileInputId   = `file-exp-${expId}`
                      const cameraInputId = `cam-exp-${expId}`
                      const handleExpFile = (ev: React.ChangeEvent<HTMLInputElement>) => {
                        const file = ev.target.files?.[0]
                        if (!file) return
                        const reader = new FileReader()
                        reader.onload = re => {
                          const url = re.target?.result as string
                          setAttachments(a => ({ ...a, [expId]: url }))
                          saveAttachment(expId, url)
                        }
                        reader.readAsDataURL(file)
                        ev.target.value = ''
                      }
                      return (
                        <div key={expId} style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '5px 0', borderBottom: '1px solid #f1f5f9', flexWrap: 'wrap' }}>
                          <input type="file" accept="image/*,application/pdf" id={fileInputId} style={{ display: 'none' }} onChange={handleExpFile} />
                          <input type="file" accept="image/*" capture id={cameraInputId} style={{ display: 'none' }} onChange={handleExpFile} />
                          <span style={{ fontWeight: '800', fontSize: '13px', color: '#0f172a', flexShrink: 0 }}>
                            R$ {Number(e.value).toFixed(2).replace('.', ',')}
                          </span>
                          <button
                            onClick={() => { (document.getElementById(fileInputId) as HTMLInputElement)?.click() }}
                            style={{ padding: '3px 9px', borderRadius: '6px', border: `1.5px solid ${hasAttach ? '#16a34a' : '#fecaca'}`, background: hasAttach ? '#22c55e' : '#fef2f2', cursor: 'pointer', fontSize: '11px', fontWeight: '700', color: hasAttach ? 'white' : '#dc2626', whiteSpace: 'nowrap', flexShrink: 0 }}>
                            {savingAttach === expId ? '⏳' : hasAttach ? '✓ Comprovante' : '📎 Arquivo'}
                          </button>
                          <button
                            onClick={() => { (document.getElementById(cameraInputId) as HTMLInputElement)?.click() }}
                            style={{ padding: '3px 9px', borderRadius: '6px', border: '1.5px solid #a5b4fc', background: '#f5f3ff', cursor: 'pointer', fontSize: '11px', fontWeight: '700', color: '#4f46e5', whiteSpace: 'nowrap', flexShrink: 0 }}>
                            📷 Câmera
                          </button>
                          {isImg && (
                            <img
                              src={attachUrl} alt="comp"
                              onClick={() => setLightboxUrl(attachUrl)}
                              style={{ height: '22px', width: '33px', borderRadius: '3px', border: '1px solid #e2e8f0', objectFit: 'cover', cursor: 'zoom-in' }}
                            />
                          )}
                          {hasAttach && !isImg && <a href={attachUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: '11px', color: '#2563eb' }}>Ver ↗</a>}
                          <button onClick={() => deleteExpMut.mutate({ id: expId })}
                            title="Excluir lançamento"
                            style={{ padding: '2px 6px', borderRadius: '5px', border: '1px solid #fecaca', background: '#fef2f2', color: '#dc2626', cursor: 'pointer', fontSize: '11px', marginLeft: 'auto', flexShrink: 0 }}>✕</button>
                        </div>
                      )
                    })}

                    {pending.map((row, idx) => {
                      const pk = `${rowKey}-${idx}`
                      const ok = parseMoney(row.value) > 0
                      return (
                        <div key={pk} style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '6px 10px', background: '#fffbeb', borderRadius: '7px', marginTop: '5px', flexWrap: 'wrap' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '3px', flexShrink: 0 }}>
                            <span style={{ fontSize: '11px', color: '#94a3b8' }}>R$</span>
                            <input autoFocus
                              style={{ ...inpSm, width: '82px', textAlign: 'right', fontWeight: '700', padding: '4px 8px' }}
                              placeholder="0,00" value={row.value}
                              onChange={ev => setNewRows(r => { const cp = [...(r[rowKey] ?? [])]; cp[idx] = { value: ev.target.value }; return { ...r, [rowKey]: cp } })}
                              onKeyDown={ev => { if (ev.key === 'Enter' && ok) saveNewRow(d, type, idx) }}
                              inputMode="decimal" />
                          </div>
                          <button onClick={() => saveNewRow(d, type, idx)} disabled={savingNew === pk || !ok}
                            style={{ padding: '3px 12px', borderRadius: '6px', border: 'none', background: ok ? '#2563eb' : '#cbd5e1', color: 'white', cursor: ok ? 'pointer' : 'not-allowed', fontSize: '11px', fontWeight: '600', flexShrink: 0 }}>
                            {savingNew === pk ? '…' : 'Salvar'}
                          </button>
                          <button onClick={() => setNewRows(r => { const cp = [...(r[rowKey] ?? [])]; cp.splice(idx, 1); return { ...r, [rowKey]: cp } })}
                            style={{ padding: '3px 7px', borderRadius: '6px', border: '1px solid #fecaca', background: '#fef2f2', color: '#dc2626', cursor: 'pointer', fontSize: '12px', flexShrink: 0 }}>✕</button>
                        </div>
                      )
                    })}

                    <button onClick={() => setNewRows(r => ({ ...r, [rowKey]: [...(r[rowKey] ?? []), { value: '' }] }))}
                      style={{ fontSize: '12px', color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer', fontWeight: '600', padding: '6px 0 2px', marginTop: '4px', display: 'block' }}>
                      + Adicionar lançamento
                    </button>
                  </td>

                  {/* ── Adiantado (por centro de custo) ── */}
                  {(() => {
                    const rowAdt = Number(orig?.value ?? 0)
                    const rowGst = totalTypeGasto
                    const rowSaldo = rowAdt - rowGst
                    const rowSaldoColor = rowSaldo > 0.01 ? '#15803d' : rowSaldo < -0.01 ? '#dc2626' : '#64748b'
                    const rowSaldoBg = rowSaldo > 0.01 ? '#f0fdf4' : rowSaldo < -0.01 ? '#fef2f2' : '#f8fafc'
                    return (<>
                      <td style={{ padding: '12px 10px', textAlign: 'right', background: '#f8fafc', borderRight: '1px solid #e2e8f0', verticalAlign: 'top' }}>
                        <span style={{ fontWeight: '700', fontSize: '13px', color: '#6d28d9' }}>{formatCurrency(rowAdt)}</span>
                      </td>
                      <td style={{ padding: '12px 10px', textAlign: 'right', background: '#f8fafc', borderRight: '1px solid #e2e8f0', verticalAlign: 'top' }}>
                        <span style={{ fontWeight: '700', fontSize: '13px', color: rowGst > 0 ? '#92400e' : '#94a3b8' }}>{formatCurrency(rowGst)}</span>
                      </td>
                      <td style={{ padding: '12px 10px', textAlign: 'right', background: rowSaldoBg, verticalAlign: 'top' }}>
                        <span style={{ fontWeight: '800', fontSize: '13px', color: rowSaldoColor }}>{rowSaldo > 0.01 ? '+' : ''}{formatCurrency(Math.abs(rowSaldo))}</span>
                        <div style={{ fontSize: '9px', color: rowSaldoColor, marginTop: '2px', fontWeight: '600', opacity: 0.85 }}>{rowSaldo > 0.01 ? 'disponível' : rowSaldo < -0.01 ? 'a receber' : '✓ ok'}</div>
                      </td>
                    </>)
                  })()}
                </tr>
              )
            })
          })}
        </tbody>
        <tfoot>
          <tr style={{ background: '#e2e8f0' }}>
            <td colSpan={3} style={{ padding: '11px 12px', fontWeight: '700', fontSize: '12px', color: '#374151', borderTop: '2px solid #cbd5e1' }}>TOTAL GERAL</td>
            <td style={{ padding: '11px 10px', textAlign: 'right', fontWeight: '700', fontSize: '13px', color: '#6d28d9', borderTop: '2px solid #cbd5e1' }}>{formatCurrency(totalOrigGeral)}</td>
            <td style={{ padding: '11px 10px', textAlign: 'right', fontWeight: '900', fontSize: '15px', color: totalGastoGeral > 0 ? '#92400e' : '#94a3b8', borderTop: '2px solid #cbd5e1' }}>{formatCurrency(totalGastoGeral)}</td>
            <td style={{ padding: '11px 10px', textAlign: 'right', borderTop: '2px solid #cbd5e1', background: (totalOrigGeral - totalGastoGeral) > 0.01 ? '#f0fdf4' : (totalOrigGeral - totalGastoGeral) < -0.01 ? '#fef2f2' : '#f8fafc' }}>
              {(() => { const s = totalOrigGeral - totalGastoGeral; const c = s > 0.01 ? '#15803d' : s < -0.01 ? '#dc2626' : '#64748b'; return (<><span style={{ fontWeight: '900', fontSize: '15px', color: c }}>{s > 0.01 ? '+' : ''}{formatCurrency(Math.abs(s))}</span><div style={{ fontSize: '9px', color: c, fontWeight: '600', marginTop: '2px' }}>{s > 0.01 ? 'disponível' : s < -0.01 ? 'a receber' : '✓ ok'}</div></>) })()}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

// ─── Modal Prestação de Contas ────────────────────────────────────────────────
function PrestacaoModal({ trip, onClose }: { trip: any; onClose: () => void }) {
  const utils = trpc.useUtils()
  const expenses: any[] = trip.expenses ?? []
  const gastoExpenses    = expenses.filter((e: any) => e.subtype === 'gasto')
  const originalExpenses = expenses.filter((e: any) => e.subtype !== 'gasto')
  const spentAmount    = gastoExpenses.reduce((s: number, e: any) => s + Number(e.value), 0)
  const advancedAmount = originalExpenses.reduce((s: number, e: any) => s + Number(e.value), 0) || Number(trip.advancedAmount ?? 0)
  const balance = advancedAmount - spentAmount
  const toReturn  = Math.max(0, balance)
  const toReceive = Math.max(0, -balance)
  const isClosed    = trip.status === 'CLOSED'
  const isSubmitted = trip.status === 'SUBMITTED'
  const isRejected  = !isClosed && !isSubmitted && !!trip.rejectedAt

  const [saving, setSaving] = useState(false)
  const [enviarError, setEnviarError] = useState('')
  const [returnAmount, setReturnAmount] = useState('')
  const [returnProofUrls, setReturnProofUrls] = useState<string[]>(() => {
    try { return trip.returnProofUrls ? JSON.parse(trip.returnProofUrls) : [] } catch { return [] }
  })
  const returnFileRef = useRef<HTMLInputElement>(null)
  const returnCameraRef = useRef<HTMLInputElement>(null)
  const [showRejectForm, setShowRejectForm] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [rejectError, setRejectError] = useState('')
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)

  const missingComprovante = gastoExpenses.filter((e: any) => !e.attachmentUrl)
  const canEnviar = missingComprovante.length === 0

  const invalidate = () => { utils.auditTrips.list.invalidate(); utils.auditTrips.getById.invalidate({ id: trip.id }); setSaving(false) }
  const updateStatusMut    = trpc.auditTrips.update.useMutation({ onSuccess: invalidate, onError: () => setSaving(false) })
  const updateSettlementMut = trpc.auditTrips.updateSettlement.useMutation({
    onSuccess: () => { updateStatusMut.mutate({ id: trip.id, status: 'SUBMITTED' }) },
    onError: () => setSaving(false),
  })
  const rejectMut = trpc.auditTrips.reject.useMutation({ onSuccess: invalidate, onError: () => setSaving(false) })

  function handleReturnFileChange(ev: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(ev.target.files ?? [])
    if (!files.length) return
    for (const file of files) {
      const reader = new FileReader()
      reader.onload = e => { setReturnProofUrls(prev => [...prev, e.target?.result as string]) }
      reader.readAsDataURL(file)
    }
    ev.target.value = ''
  }

  function handleEnviar() {
    if (!canEnviar) { setEnviarError(`${missingComprovante.length} lançamento(s) sem comprovante anexado.`); return }
    if (toReturn > 0) {
      const amt = parseFloat(returnAmount.replace(',', '.'))
      if (isNaN(amt) || amt <= 0) { setEnviarError('Informe o valor devolvido (qualquer valor positivo).'); return }
      if (!returnProofUrls.length) { setEnviarError('Anexe ao menos um comprovante de devolução antes de enviar.'); return }
      setEnviarError(''); setSaving(true)
      updateSettlementMut.mutate({ id: trip.id, returnedAmount: amt, returnProofUrls, returnedAt: new Date() })
      return
    }
    setEnviarError(''); setSaving(true)
    updateStatusMut.mutate({ id: trip.id, status: 'SUBMITTED' })
  }
  function handleValidar() { setSaving(true); updateStatusMut.mutate({ id: trip.id, status: 'CLOSED' }) }
  function handleRejeitar() {
    if (!rejectReason.trim()) { setRejectError('Informe o motivo da rejeição.'); return }
    setRejectError(''); setSaving(true)
    rejectMut.mutate({ id: trip.id, reason: rejectReason.trim() })
  }

  const statusConfig = isClosed
    ? { bg: '#f0fdf4', border: '#86efac', dot: '#22c55e', text: '#166534', icon: '✓', msg: 'Prestação validada e concluída.' }
    : isSubmitted
    ? { bg: '#fef9c3', border: '#fde68a', dot: '#f59e0b', text: '#92400e', icon: '⏳', msg: 'Prestação enviada — aguardando validação do financeiro.' }
    : isRejected
    ? { bg: '#fef2f2', border: '#fca5a5', dot: '#ef4444', text: '#991b1b', icon: '✗', msg: 'Prestação rejeitada — colaborador deve corrigir e reenviar.' }
    : toReturn > 0
      ? { bg: '#fef2f2', border: '#fca5a5', dot: '#ef4444', text: '#991b1b', icon: '↩', msg: `Colaborador deve devolver ${formatCurrency(toReturn)} à empresa.` }
      : { bg: '#eff6ff', border: '#93c5fd', dot: '#3b82f6', text: '#1e40af', icon: '↪', msg: `Empresa deve reembolsar ${formatCurrency(toReceive)} ao colaborador.` }

  function SummaryCard({ label, value, sub, color, bg, border }: { label: string; value: string; sub?: string; color: string; bg: string; border: string }) {
    return (
      <div style={{ background: bg, border: `1.5px solid ${border}`, borderRadius: '12px', padding: '14px 16px', flex: '1 1 120px', minWidth: '110px' }}>
        <div style={{ fontSize: '10px', fontWeight: '700', color, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '5px' }}>{label}</div>
        <div style={{ fontSize: '19px', fontWeight: '800', color, lineHeight: 1.2 }}>{value}</div>
        {sub && <div style={{ fontSize: '11px', color, opacity: 0.75, marginTop: '3px' }}>{sub}</div>}
      </div>
    )
  }

  // Timeline acumulada — mescla JSON com campos individuais para garantir histórico completo
  type TLEvent = { type: string; user?: string; date?: string; comment?: string; returnedAmount?: number; returnProofUrls?: string[] }
  const timeline: TLEvent[] = (() => {
    const jsonEvents: TLEvent[] = (() => {
      try { return trip.timeline ? JSON.parse(trip.timeline) : [] } catch { return [] }
    })()
    const types = new Set(jsonEvents.map((e: TLEvent) => e.type))
    const prefix: TLEvent[] = []
    if (!types.has('submitted') && (trip.submittedBy || trip.submittedAt)) {
      prefix.push({ type: 'submitted', user: trip.submittedBy ?? undefined, date: trip.submittedAt ?? undefined })
    }
    const merged = [...prefix, ...jsonEvents]
    if (!types.has('validated') && (trip.validatedBy || trip.validatedAt)) {
      merged.push({ type: 'validated', user: trip.validatedBy ?? undefined, date: trip.validatedAt ?? undefined })
    }
    return merged.sort((a, b) => {
      if (!a.date) return -1
      if (!b.date) return 1
      return new Date(a.date).getTime() - new Date(b.date).getTime()
    })
  })()

  // Último evento submitted (para exibir dados ao financeiro e ao colaborador após rejeição)
  const lastSubmittedEvent = [...timeline].reverse().find(e => e.type === 'submitted')

  const tlConfig: Record<string, { icon: string; label: string; color: string; bg: string; border: string }> = {
    submitted: { icon: '📤', label: 'Prestação enviada',   color: '#92400e', bg: 'white',   border: '#e2e8f0' },
    validated: { icon: '✅', label: 'Prestação validada',  color: '#166534', bg: '#f0fdf4', border: '#86efac' },
    rejected:  { icon: '❌', label: 'Prestação rejeitada', color: '#991b1b', bg: '#fef2f2', border: '#fca5a5' },
  }

  function ProofThumbs({ urls }: { urls: string[] }) {
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px' }}>
        {urls.map((url, j) => {
          const isImg = url.startsWith('data:image')
          return isImg ? (
            <img key={j} src={url} alt={`comprovante ${j + 1}`}
              onClick={() => setLightboxUrl(url)}
              style={{ height: '48px', width: '64px', objectFit: 'cover', borderRadius: '6px', border: '1.5px solid #e2e8f0', cursor: 'zoom-in', flexShrink: 0 }} />
          ) : (
            <a key={j} href={url} target="_blank" rel="noopener noreferrer"
              style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: '#2563eb', background: '#eff6ff', border: '1px solid #93c5fd', borderRadius: '6px', padding: '6px 10px', textDecoration: 'none', flexShrink: 0 }}>
              📄 Comprovante {j + 1} ↗
            </a>
          )
        })}
      </div>
    )
  }

  return (
    <Modal title={`Prestação de Contas — ${trip.collaborator?.name ?? ''}`} onClose={onClose} wide>

      {/* ── Lightbox para comprovantes do histórico */}
      {lightboxUrl && (
        <div onClick={() => setLightboxUrl(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'zoom-out' }}>
          <img src={lightboxUrl} alt="comprovante" style={{ maxWidth: '90vw', maxHeight: '90vh', borderRadius: '8px', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }} onClick={e => e.stopPropagation()} />
          <button onClick={() => setLightboxUrl(null)} style={{ position: 'absolute', top: '20px', right: '24px', background: 'rgba(255,255,255,0.15)', border: 'none', color: 'white', fontSize: '28px', cursor: 'pointer', borderRadius: '50%', width: '40px', height: '40px', lineHeight: '40px', textAlign: 'center' }}>✕</button>
        </div>
      )}

      {/* ── Status Banner */}
      <div style={{ background: statusConfig.bg, border: `2px solid ${statusConfig.border}`, borderRadius: '12px', padding: '14px 18px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: statusConfig.dot, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <span style={{ color: 'white', fontSize: '16px', fontWeight: '700' }}>{statusConfig.icon}</span>
        </div>
        <div>
          <div style={{ fontSize: '15px', fontWeight: '700', color: statusConfig.text }}>{statusConfig.msg}</div>
          {trip.stores && <div style={{ fontSize: '12px', color: statusConfig.text, opacity: 0.75, marginTop: '2px' }}>Viagem: {trip.stores} · {trip.reason ?? ''}</div>}
        </div>
        {isClosed && <div style={{ marginLeft: 'auto', flexShrink: 0 }}><div style={{ fontSize: '11px', color: '#166534', fontWeight: '600' }}>CONCLUÍDA</div></div>}
      </div>

      {/* ── Cards de resumo */}
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '24px' }}>
        <SummaryCard label="Adiantado"   value={formatCurrency(advancedAmount)} color="#6d28d9" bg="#f5f3ff" border="#c4b5fd" />
        <SummaryCard label="Total Gasto" value={formatCurrency(spentAmount)} sub={`${gastoExpenses.length} lançamento${gastoExpenses.length !== 1 ? 's' : ''}`} color="#92400e" bg="#fffbeb" border="#fde68a" />
        <SummaryCard label="A Devolver"  value={formatCurrency(toReturn)}  color={toReturn  > 0 ? '#991b1b' : '#94a3b8'} bg={toReturn  > 0 ? '#fef2f2' : '#f8fafc'} border={toReturn  > 0 ? '#fca5a5' : '#e2e8f0'} sub={toReturn  > 0 ? 'colaborador → empresa' : undefined} />
        <SummaryCard label="Reembolso"   value={formatCurrency(toReceive)} color={toReceive > 0 ? '#1e40af' : '#94a3b8'} bg={toReceive > 0 ? '#eff6ff' : '#f8fafc'} border={toReceive > 0 ? '#93c5fd' : '#e2e8f0'} sub={toReceive > 0 ? 'empresa → colaborador' : undefined} />
      </div>

      {/* ── Lançamentos por dia */}
      <div style={{ fontSize: '13px', fontWeight: '700', color: '#374151', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>Verificação por Dia</div>
      <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden', marginBottom: '24px' }}>
        <TabelaVerificacao trip={trip} />
      </div>

      {/* ── Ação */}
      <div style={{ background: isClosed ? '#f0fdf4' : isSubmitted ? '#fef9c3' : isRejected ? '#fef2f2' : '#f8fafc', border: `2px solid ${isClosed ? '#86efac' : isSubmitted ? '#fde68a' : isRejected ? '#fca5a5' : '#e2e8f0'}`, borderRadius: '14px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>

        {/* ── Histórico completo (timeline) */}
        {timeline.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '2px' }}>Histórico</div>
            {timeline.map((ev, i) => {
              const cfg = tlConfig[ev.type] ?? tlConfig.submitted
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '10px 14px', background: cfg.bg, borderRadius: '10px', border: `1.5px solid ${cfg.border}`, textAlign: 'left' }}>
                  <span style={{ fontSize: '18px', flexShrink: 0 }}>{cfg.icon}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div>
                      <span style={{ fontSize: '13px', fontWeight: '700', color: cfg.color }}>
                        {cfg.label}{ev.user ? <> por <strong>{ev.user}</strong></> : ''}
                      </span>
                      {ev.date && <span style={{ fontSize: '12px', color: '#64748b', marginLeft: '6px' }}>em {new Date(ev.date).toLocaleString('pt-BR')}</span>}
                    </div>
                    {/* Dados de devolução da submissão */}
                    {ev.type === 'submitted' && ev.returnedAmount != null && ev.returnedAmount > 0 && (
                      <div style={{ marginTop: '6px', fontSize: '12px', color: '#92400e', background: '#fffbeb', borderRadius: '6px', padding: '5px 10px', border: '1px solid #fde68a', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        💰 Valor devolvido: <strong>{formatCurrency(ev.returnedAmount)}</strong>
                      </div>
                    )}
                    {ev.type === 'submitted' && ev.returnProofUrls && ev.returnProofUrls.length > 0 && (
                      <ProofThumbs urls={ev.returnProofUrls} />
                    )}
                    {/* Motivo da rejeição */}
                    {ev.comment && (
                      <div style={{ fontSize: '12px', color: '#991b1b', marginTop: '6px', background: '#fff', borderRadius: '6px', padding: '6px 10px', border: '1px solid #fca5a5' }}>
                        💬 <em>{ev.comment}</em>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* ── Ações conforme status */}
        {isClosed ? (
          <div style={{ color: '#166534', fontWeight: '700', fontSize: '15px', textAlign: 'center' }}>✓ Viagem concluída e validada pelo financeiro.</div>
        ) : isSubmitted ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'center' }}>
              <div style={{ color: '#92400e', fontWeight: '600', fontSize: '14px' }}>⏳ Aguardando validação do financeiro.</div>
              {!showRejectForm ? (
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center' }}>
                  <Btn onClick={handleValidar} disabled={saving}>{saving ? 'Validando...' : '✅ Validar Prestação'}</Btn>
                  <Btn variant="danger" onClick={() => setShowRejectForm(true)} disabled={saving}>❌ Rejeitar</Btn>
                </div>
              ) : (
                <div style={{ width: '100%', background: '#fef2f2', border: '1.5px solid #fca5a5', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ fontSize: '13px', fontWeight: '700', color: '#991b1b' }}>Motivo da rejeição</div>
                  <textarea
                    autoFocus
                    placeholder="Descreva o motivo da rejeição para o colaborador..."
                    value={rejectReason}
                    onChange={e => setRejectReason(e.target.value)}
                    rows={3}
                    style={{ border: '1.5px solid #fca5a5', borderRadius: '8px', padding: '10px 12px', fontSize: '13px', resize: 'vertical', outline: 'none', width: '100%', boxSizing: 'border-box' }}
                  />
                  {rejectError && <div style={{ color: '#dc2626', fontSize: '12px', fontWeight: '600' }}>⚠ {rejectError}</div>}
                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                    <Btn variant="outline" onClick={() => { setShowRejectForm(false); setRejectReason(''); setRejectError('') }} disabled={saving}>Cancelar</Btn>
                    <Btn variant="danger" onClick={handleRejeitar} disabled={saving}>{saving ? 'Rejeitando...' : '❌ Confirmar Rejeição'}</Btn>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', textAlign: 'center' }}>
            {isRejected && (
              <div style={{ width: '100%', background: '#fef2f2', border: '1.5px solid #fca5a5', borderRadius: '10px', padding: '14px 16px', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ fontSize: '13px', fontWeight: '700', color: '#991b1b' }}>❌ Prestação rejeitada — corrija os itens indicados e reenvie.</div>
                {/* Dados da tentativa anterior */}
                {lastSubmittedEvent && (lastSubmittedEvent.returnedAmount ?? 0) > 0 && (
                  <div style={{ background: 'white', border: '1px solid #fca5a5', borderRadius: '8px', padding: '10px 14px' }}>
                    <div style={{ fontSize: '11px', fontWeight: '700', color: '#991b1b', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '6px' }}>Dados da tentativa anterior</div>
                    <div style={{ fontSize: '13px', color: '#92400e', fontWeight: '600' }}>
                      💰 Valor informado: <strong>{formatCurrency(lastSubmittedEvent.returnedAmount!)}</strong>
                    </div>
                    {lastSubmittedEvent.returnProofUrls && lastSubmittedEvent.returnProofUrls.length > 0 && (
                      <ProofThumbs urls={lastSubmittedEvent.returnProofUrls} />
                    )}
                  </div>
                )}
              </div>
            )}
            {toReturn > 0 && (
              <div style={{ width: '100%', background: '#fef2f2', border: '1.5px solid #fca5a5', borderRadius: '12px', padding: '16px 20px', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ fontSize: '13px', fontWeight: '700', color: '#991b1b' }}>
                  ↩ Você deve devolver <strong>{formatCurrency(toReturn)}</strong> à empresa. Informe o valor devolvido e anexe o(s) comprovante(s).
                </div>
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '11px', fontWeight: '600', color: '#991b1b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Valor devolvido (R$)</label>
                    <input type="number" step="0.01" placeholder={toReturn.toFixed(2)} value={returnAmount} onChange={e => setReturnAmount(e.target.value)}
                      style={{ border: '1.5px solid #fca5a5', borderRadius: '8px', padding: '8px 12px', fontSize: '15px', fontWeight: '700', width: '160px', color: '#991b1b', background: 'white', outline: 'none' }} />
                    <div style={{ fontSize: '11px', color: '#94a3b8' }}>Pode informar qualquer valor (ex: com ajustes)</div>
                  </div>
                </div>
                {/* Comprovantes múltiplos */}
                <div>
                  <label style={{ fontSize: '11px', fontWeight: '600', color: '#991b1b', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: '6px' }}>Comprovantes de devolução</label>
                  <input ref={returnFileRef} type="file" accept="image/*,application/pdf" multiple style={{ display: 'none' }} onChange={handleReturnFileChange} />
                  <input ref={returnCameraRef} type="file" accept="image/*" capture style={{ display: 'none' }} onChange={handleReturnFileChange} />
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={() => returnFileRef.current?.click()}
                      style={{ border: '1.5px solid #ef4444', borderRadius: '8px', padding: '8px 14px', fontSize: '13px', fontWeight: '600', background: '#fff', color: '#dc2626', cursor: 'pointer', flex: 1 }}>
                      📎 Arquivo / Galeria
                    </button>
                    <button onClick={() => returnCameraRef.current?.click()}
                      style={{ border: '1.5px solid #a5b4fc', borderRadius: '8px', padding: '8px 14px', fontSize: '13px', fontWeight: '600', background: '#f5f3ff', color: '#4f46e5', cursor: 'pointer', flex: 1 }}>
                      📷 Câmera
                    </button>
                  </div>
                  {returnProofUrls.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '10px' }}>
                      {returnProofUrls.map((url, idx) => {
                        const isImg = url.startsWith('data:image')
                        return (
                          <div key={idx} style={{ position: 'relative', display: 'inline-block' }}>
                            {isImg ? (
                              <img src={url} alt={`comp ${idx + 1}`}
                                onClick={() => setLightboxUrl(url)}
                                style={{ height: '56px', width: '80px', objectFit: 'cover', borderRadius: '6px', border: '1.5px solid #22c55e', cursor: 'zoom-in', display: 'block' }} />
                            ) : (
                              <div style={{ padding: '8px 10px', background: '#f0fdf4', border: '1.5px solid #22c55e', borderRadius: '6px', fontSize: '12px', color: '#166534' }}>📄 {idx + 1}</div>
                            )}
                            <button onClick={() => setReturnProofUrls(p => p.filter((_, i) => i !== idx))}
                              style={{ position: 'absolute', top: '-6px', right: '-6px', width: '18px', height: '18px', borderRadius: '50%', border: 'none', background: '#ef4444', color: 'white', fontSize: '10px', cursor: 'pointer', lineHeight: '18px', textAlign: 'center', padding: 0 }}>✕</button>
                          </div>
                        )
                      })}
                    </div>
                  )}
                  {returnProofUrls.length > 0 && (
                    <div style={{ fontSize: '11px', color: '#16a34a', fontWeight: '600', marginTop: '6px' }}>✓ {returnProofUrls.length} comprovante(s) anexado(s)</div>
                  )}
                </div>
              </div>
            )}
            {!toReturn && !isRejected && <div style={{ color: '#64748b', fontSize: '13px' }}>Revise os lançamentos acima e envie a prestação de contas para validação.</div>}
            {enviarError && <div style={{ color: '#dc2626', fontSize: '12px', fontWeight: '600' }}>⚠ {enviarError}</div>}
            <Btn onClick={handleEnviar} disabled={saving}>{saving ? 'Enviando...' : '📤 Enviar Prestação de Contas'}</Btn>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Btn variant="outline" onClick={onClose}>Fechar</Btn>
        </div>
      </div>
    </Modal>
  )
}

// ─── Aba: Viagens (cadastro) ──────────────────────────────────────────────────
function AbaViagens({ onGoEmAndamento }: { onGoEmAndamento: () => void }) {
  const [showNew, setShowNew] = useState(false)
  const [filterSearch, setFilterSearch] = useState('')
  const [filterCreatedFrom, setFilterCreatedFrom] = useState('')
  const [filterCreatedTo, setFilterCreatedTo] = useState('')
  const [page, setPage] = useState(1)
  const [deleteTripId, setDeleteTripId] = useState<string | null>(null)

  const utils = trpc.useUtils()
  const { data, isLoading } = trpc.auditTrips.list.useQuery({
    page, pageSize: 50,
    search: filterSearch || undefined,
    createdAtFrom: filterCreatedFrom ? new Date(filterCreatedFrom) : undefined,
    createdAtTo: filterCreatedTo ? new Date(filterCreatedTo + 'T23:59:59') : undefined,
  })
  const { data: collabs } = trpc.auditCollaborators.list.useQuery()
  const { data: costTypes } = trpc.auditCostTypes.list.useQuery()
  const { data: storesData } = trpc.stores.list.useQuery({ pageSize: 200 })
  const storesList = storesData?.stores ?? []

  const deleteTripMut = trpc.auditTrips.delete.useMutation({ onSuccess: () => { utils.auditTrips.list.invalidate(); setDeleteTripId(null) } })

  const trips = data?.trips ?? []

  const thSt: React.CSSProperties = { padding: '9px 14px', fontSize: '11px', fontWeight: '700', color: '#64748b', background: '#f8fafc', borderBottom: '2px solid #e2e8f0', textAlign: 'left', whiteSpace: 'nowrap' }
  const tdSt: React.CSSProperties = { padding: '11px 14px', borderBottom: '1px solid #f1f5f9', verticalAlign: 'middle', fontSize: '13px' }

  return (
    <>
      {showNew && (
        <NovaTripModal
          onClose={() => setShowNew(false)}
          onCreated={() => { setShowNew(false); onGoEmAndamento() }}
          collabsList={collabs ?? []}
          storesList={storesList}
          costTypes={costTypes ?? []}
        />
      )}
      {deleteTripId && (
        <Modal title="Confirmar Exclusão" onClose={() => setDeleteTripId(null)}>
          <div style={{ padding: '8px 0 24px', fontSize: '15px', color: '#374151' }}>Excluir esta viagem e todas as despesas?</div>
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <Btn variant="outline" onClick={() => setDeleteTripId(null)}>Cancelar</Btn>
            <Btn variant="danger" onClick={() => deleteTripMut.mutate({ id: deleteTripId })} disabled={deleteTripMut.isPending}>Excluir</Btn>
          </div>
        </Modal>
      )}

      <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: '16px', background: 'white', border: '1.5px solid #e2e8f0', borderRadius: '14px', padding: '14px 16px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: '1 1 200px', minWidth: '180px' }}>
          <label style={{ fontSize: '11px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Pesquisar</label>
          <input
            placeholder="Colaborador, viagem, loja..."
            value={filterSearch}
            onChange={e => { setFilterSearch(e.target.value); setPage(1) }}
            style={{ padding: '8px 12px', borderRadius: '8px', border: '1.5px solid #e2e8f0', fontSize: '13px' }}
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label style={{ fontSize: '11px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Criado de</label>
          <input type="date" value={filterCreatedFrom} onChange={e => { setFilterCreatedFrom(e.target.value); setPage(1) }} style={{ padding: '8px 10px', borderRadius: '8px', border: '1.5px solid #e2e8f0', fontSize: '13px' }} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label style={{ fontSize: '11px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Criado até</label>
          <input type="date" value={filterCreatedTo} onChange={e => { setFilterCreatedTo(e.target.value); setPage(1) }} style={{ padding: '8px 10px', borderRadius: '8px', border: '1.5px solid #e2e8f0', fontSize: '13px' }} />
        </div>
        {!!(filterSearch || filterCreatedFrom || filterCreatedTo) && (
          <button onClick={() => { setFilterSearch(''); setFilterCreatedFrom(''); setFilterCreatedTo(''); setPage(1) }}
            style={{ padding: '8px 14px', borderRadius: '8px', border: '1.5px solid #e2e8f0', background: '#f8fafc', fontSize: '13px', cursor: 'pointer', color: '#64748b', alignSelf: 'flex-end' }}>
            ✕ Limpar
          </button>
        )}
        <Btn onClick={() => setShowNew(true)}>+ Nova Viagem (Adiantamento)</Btn>
      </div>

      <DataCard title={`Viagens (${trips.length})`}>
        {isLoading ? <LoadingState /> : !trips.length ? (
          <EmptyState icon="✈️" title="Nenhuma viagem cadastrada" description='Clique em "+ Nova Viagem" para criar a primeira viagem.' />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={thSt}>Colaborador</th>
                  <th style={thSt}>Destino / Lojas</th>
                  <th style={thSt}>Período</th>
                  <th style={thSt}>Criado em</th>
                  <th style={thSt}>Status</th>
                  <th style={{ ...thSt, textAlign: 'right' }}></th>
                </tr>
              </thead>
              <tbody>
                {trips.map((t: any) => {
                  const isRejected = t.status === 'OPEN' && t.rejectedAt
                  const badgeBg    = t.status === 'SUBMITTED' ? '#fef3c7' : isRejected ? '#fee2e2' : t.status === 'CLOSED' ? '#dcfce7' : '#dbeafe'
                  const badgeColor = t.status === 'SUBMITTED' ? '#92400e'  : isRejected ? '#dc2626' : t.status === 'CLOSED' ? '#166534' : '#1d4ed8'
                  const badgeLabel = t.status === 'SUBMITTED' ? 'Enviada'  : isRejected ? 'Rejeitada' : t.status === 'CLOSED' ? 'Concluída' : 'Aberta'
                  return (
                    <tr key={t.id} style={{ background: 'white' }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#f8fafc'}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'white'}>
                      <td style={tdSt}>
                        <div style={{ fontWeight: '600', color: '#0f172a' }}>{t.collaborator?.name ?? '—'}</div>
                        {t.collaborator?.role && <div style={{ fontSize: '11px', color: '#94a3b8' }}>{t.collaborator.role}</div>}
                      </td>
                      <td style={tdSt}>
                        <div style={{ fontWeight: '500', color: '#0f172a' }}>{t.city}{t.state ? `/${t.state}` : ''}</div>
                        {t.stores && <div style={{ fontSize: '11px', color: '#94a3b8', maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.stores}</div>}
                      </td>
                      <td style={tdSt}>
                        <div style={{ color: '#374151' }}>{formatDate(t.startDate)} → {formatDate(t.endDate)}</div>
                        {t.reason && <div style={{ fontSize: '11px', color: '#94a3b8' }}>{t.reason}</div>}
                      </td>
                      <td style={tdSt}>
                        <div style={{ fontSize: '12px', color: '#64748b' }}>{t.createdAt ? new Date(t.createdAt).toLocaleDateString('pt-BR') : '—'}</div>
                      </td>
                      <td style={tdSt}>
                        <span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '600', background: badgeBg, color: badgeColor }}>{badgeLabel}</span>
                      </td>
                      <td style={{ ...tdSt, textAlign: 'right' }}>
                        <button onClick={() => setDeleteTripId(t.id)}
                          style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid #fecaca', background: '#fef2f2', color: '#dc2626', cursor: 'pointer', fontSize: '11px' }}>
                          Excluir
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
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

// ─── Aba: Em Andamento ───────────────────────────────────────────────────────
function AbaEmAndamento() {
  const [page, setPage] = useState(1)
  const [filterCollabs, setFilterCollabs] = useState<string[]>([])
  const [filterSearch, setFilterSearch] = useState('')
  const [filterFrom, setFilterFrom] = useState('')
  const [filterTo, setFilterTo] = useState('')
  const [filterCreatedFrom, setFilterCreatedFrom] = useState('')
  const [filterCreatedTo, setFilterCreatedTo] = useState('')
  const [filterStatus, setFilterStatus] = useState<'' | 'OPEN' | 'SUBMITTED' | 'REJECTED'>('')
  const [editTripId, setEditTripId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({ reason: '', observations: '', status: 'OPEN' })
  const [showExpense, setShowExpense] = useState(false)
  const [expenseTripId, setExpenseTripId] = useState<string | null>(null)
  const [expForm, setExpForm] = useState({ collaboratorId: '', type: '', paymentMethod: 'Adiantamento', date: new Date().toISOString().slice(0,10), value: '', storeName: '', cityUf: '', description: '', observations: '' })
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null)
  const [prestacaoTripId, setPrestacaoTripId] = useState<string | null>(null)
  const [deleteTripId, setDeleteTripId] = useState<string | null>(null)
  const [error, setError] = useState('')

  const utils = trpc.useUtils()
  const queryStatusIn = filterStatus === 'SUBMITTED' ? ['SUBMITTED'] : ['OPEN', 'SUBMITTED']
  const { data, isLoading } = trpc.auditTrips.list.useQuery({
    page, pageSize: 50,
    statusIn: queryStatusIn,
    collaboratorIds: filterCollabs.length ? filterCollabs : undefined,
    search: filterSearch || undefined,
    startDateFrom: filterFrom ? new Date(filterFrom) : undefined,
    startDateTo: filterTo ? new Date(filterTo + 'T23:59:59') : undefined,
    createdAtFrom: filterCreatedFrom ? new Date(filterCreatedFrom) : undefined,
    createdAtTo: filterCreatedTo ? new Date(filterCreatedTo + 'T23:59:59') : undefined,
    rejectedOnly: filterStatus === 'REJECTED' ? true : undefined,
    excludeRejected: filterStatus === 'OPEN' ? true : undefined,
  })
  const { data: collabs } = trpc.auditCollaborators.list.useQuery()
  const { data: costTypes } = trpc.auditCostTypes.list.useQuery()
  const { data: storesData } = trpc.stores.list.useQuery({ pageSize: 200 })
  const { data: prestacaoDetail } = trpc.auditTrips.getById.useQuery({ id: prestacaoTripId! }, { enabled: !!prestacaoTripId })
  const storesList = storesData?.stores ?? []
  const tiposDisponiveis = costTypes && costTypes.length > 0 ? costTypes.map((t: any) => t.name) : DEFAULT_COST_TYPES

  const updateTripMut = trpc.auditTrips.update.useMutation({ onSuccess: () => { utils.auditTrips.list.invalidate(); setEditTripId(null); setError('') }, onError: e => setError(e.message) })
  const deleteTripMut = trpc.auditTrips.delete.useMutation({ onSuccess: () => { utils.auditTrips.list.invalidate(); setDeleteTripId(null) } })
  const createExpMut = trpc.auditCost.createExpense.useMutation({
    onSuccess: () => { utils.auditTrips.list.invalidate(); if (prestacaoTripId) utils.auditTrips.getById.invalidate({ id: prestacaoTripId }); setShowExpense(false); setError('') },
    onError: e => setError(e.message),
  })

  function setE(k: string, v: string) { setExpForm(f => ({ ...f, [k]: v })) }

  const trips = data?.trips ?? []

  // Agrupa viagens por cidade + período (a mesma viagem gera 1 registro por colaborador)
  const groups: any[] = Object.values(
    trips.reduce((acc: Record<string, any>, t: any) => {
      const key = `${t.city ?? ''}|${t.state ?? ''}|${new Date(t.startDate).toISOString().slice(0, 10)}|${new Date(t.endDate).toISOString().slice(0, 10)}|${t.stores ?? ''}`
      if (!acc[key]) acc[key] = { key, city: t.city, state: t.state, stores: t.stores, reason: t.reason, startDate: t.startDate, endDate: t.endDate, trips: [] }
      acc[key].trips.push(t)
      return acc
    }, {})
  )

  return (
    <>
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
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div style={{ background: 'white', border: '1.5px solid #e2e8f0', borderRadius: '14px', padding: '14px 16px', display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'flex-end', flex: 1 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: '1 1 180px', minWidth: '160px' }}>
            <label style={{ fontSize: '11px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Pesquisar</label>
            <input
              placeholder="Colaborador, viagem, loja..."
              value={filterSearch}
              onChange={e => { setFilterSearch(e.target.value); setPage(1) }}
              style={{ padding: '8px 12px', borderRadius: '8px', border: '1.5px solid #e2e8f0', fontSize: '13px', outline: 'none' }}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: '1 1 160px', minWidth: '140px' }}>
            <label style={{ fontSize: '11px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Colaborador</label>
            <CollabMultiSelect collabs={collabs ?? []} selectedIds={filterCollabs} onChange={ids => { setFilterCollabs(ids); setPage(1) }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '11px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>De</label>
            <input type="date" value={filterFrom} onChange={e => { setFilterFrom(e.target.value); setPage(1) }} style={{ padding: '8px 10px', borderRadius: '8px', border: '1.5px solid #e2e8f0', fontSize: '13px' }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '11px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Até</label>
            <input type="date" value={filterTo} onChange={e => { setFilterTo(e.target.value); setPage(1) }} style={{ padding: '8px 10px', borderRadius: '8px', border: '1.5px solid #e2e8f0', fontSize: '13px' }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '11px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Status</label>
            <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value as any); setPage(1) }}
              style={{ padding: '8px 10px', borderRadius: '8px', border: `1.5px solid ${filterStatus === 'REJECTED' ? '#fca5a5' : filterStatus === 'SUBMITTED' ? '#fde68a' : '#e2e8f0'}`, fontSize: '13px', background: filterStatus === 'REJECTED' ? '#fef2f2' : filterStatus === 'SUBMITTED' ? '#fef9c3' : 'white', color: filterStatus === 'REJECTED' ? '#991b1b' : filterStatus === 'SUBMITTED' ? '#92400e' : '#0f172a', minWidth: '120px' }}>
              <option value="">Todos</option>
              <option value="OPEN">Aberta</option>
              <option value="SUBMITTED">Enviada</option>
              <option value="REJECTED">Rejeitada</option>
            </select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '11px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Criado de</label>
            <input type="date" value={filterCreatedFrom} onChange={e => { setFilterCreatedFrom(e.target.value); setPage(1) }} style={{ padding: '8px 10px', borderRadius: '8px', border: '1.5px solid #e2e8f0', fontSize: '13px' }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '11px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Criado até</label>
            <input type="date" value={filterCreatedTo} onChange={e => { setFilterCreatedTo(e.target.value); setPage(1) }} style={{ padding: '8px 10px', borderRadius: '8px', border: '1.5px solid #e2e8f0', fontSize: '13px' }} />
          </div>
          {!!(filterCollabs.length || filterSearch || filterFrom || filterTo || filterStatus || filterCreatedFrom || filterCreatedTo) && (
            <button onClick={() => { setFilterCollabs([]); setFilterSearch(''); setFilterFrom(''); setFilterTo(''); setFilterStatus(''); setFilterCreatedFrom(''); setFilterCreatedTo(''); setPage(1) }}
              style={{ padding: '8px 14px', borderRadius: '8px', border: '1.5px solid #e2e8f0', background: '#f8fafc', fontSize: '13px', cursor: 'pointer', color: '#64748b', alignSelf: 'flex-end' }}>
              ✕ Limpar
            </button>
          )}
        </div>
      </div>

      <DataCard title={`Viagens (${groups.length})`}>
        {isLoading ? <LoadingState /> : !trips.length ? (
          <EmptyState icon="✈️" title="Nenhuma viagem" description='Clique em "+ Nova Viagem" para cadastrar.' />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {groups.map((g: any) => {
              const isOpen = expandedGroup === g.key
              const totalSpent = g.trips.reduce((s: number, t: any) => s + Number(t.spentAmount ?? 0), 0)
              const anyRejected  = g.trips.some((t: any) => t.status === 'OPEN' && t.rejectedAt)
              const anySubmitted = g.trips.some((t: any) => t.status === 'SUBMITTED')
              const groupBorder = anyRejected ? '#fca5a5' : anySubmitted ? '#fde68a' : '#e2e8f0'
              const groupBg     = anyRejected ? '#fff5f5' : 'white'
              const storeNamesInGroup = g.stores ? g.stores.split(', ').map((n: string) => n.trim()) : []
              const citiesFromStores = [...new Set(storeNamesInGroup.map((name: string) => { const s = storesList.find((x: any) => x.name === name); return s?.city && s?.state ? `${s.city}/${s.state}` : s?.city ?? null }).filter(Boolean))] as string[]
              const cityTitle = citiesFromStores.length > 0 ? citiesFromStores.join(', ') : g.city ? `${g.city}${g.state ? `/${g.state}` : ''}` : null
              return (
                <div key={g.key} style={{ border: `2px solid ${groupBorder}`, borderRadius: '14px', overflow: 'hidden', background: groupBg }}>
                  {/* ── Cabeçalho: cidade + período ── */}
                  <div style={{ padding: '16px', cursor: 'pointer' }} onClick={() => setExpandedGroup(isOpen ? null : g.key)}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                      <div style={{ flex: 1, minWidth: '160px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '17px' }}>📍</span>
                          <span style={{ fontWeight: '800', fontSize: '16px', color: '#0f172a' }}>{cityTitle || 'Viagem'}</span>
                          {anyRejected  && <span style={{ padding: '2px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: '600', background: '#fee2e2', color: '#dc2626' }}>Rejeitada</span>}
                          {!anyRejected && anySubmitted && <span style={{ padding: '2px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: '600', background: '#fef3c7', color: '#92400e' }}>Enviada</span>}
                        </div>
                        <div style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>📅 {formatDate(g.startDate)} → {formatDate(g.endDate)}{g.reason && <span> · {g.reason}</span>}</div>
                        {g.stores && <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>{g.stores}</div>}
                        {g.trips[0]?.createdAt && <div style={{ fontSize: '11px', color: '#cbd5e1', marginTop: '2px' }}>Criado em: {new Date(g.trips[0].createdAt).toLocaleDateString('pt-BR')}</div>}
                      </div>
                      <div style={{ textAlign: 'right', minWidth: '130px' }}>
                        <div style={{ fontSize: '18px', fontWeight: '800', color: '#0f172a' }}>{formatCurrency(totalSpent)}</div>
                        <div style={{ fontSize: '12px', color: '#64748b' }}>{g.trips.length} colaborador{g.trips.length !== 1 ? 'es' : ''}</div>
                      </div>
                      <span style={{ fontSize: '14px', color: '#94a3b8' }}>{isOpen ? '▲' : '▼'}</span>
                    </div>
                  </div>

                  {/* ── Colaboradores da viagem ── */}
                  {isOpen && (
                    <div style={{ borderTop: '1px solid #f1f5f9', padding: '14px 16px', background: '#f8fafc', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {g.trips.map((t: any) => {
                        const spent = Number(t.spentAmount ?? 0)
                        const released = Number(t.releasedAmount ?? 0)
                        const isOver = spent > released && released > 0
                        const tRejected = t.status === 'OPEN' && t.rejectedAt
                        const rowBorder = t.status === 'SUBMITTED' ? '#fde68a' : tRejected ? '#fca5a5' : '#e2e8f0'
                        const rowBg     = t.status === 'SUBMITTED' ? '#fffdf0' : tRejected ? '#fef2f2' : 'white'
                        const badgeBg   = t.status === 'SUBMITTED' ? '#fef3c7' : tRejected ? '#fee2e2' : '#dbeafe'
                        const badgeColor = t.status === 'SUBMITTED' ? '#92400e' : tRejected ? '#dc2626' : '#1d4ed8'
                        const badgeLabel = t.status === 'SUBMITTED' ? 'Enviada' : tRejected ? 'Rejeitada' : 'Aberta'
                        return (
                          <div key={t.id} onClick={() => setPrestacaoTripId(t.id)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', background: rowBg, borderRadius: '10px', padding: '12px 16px', border: `1.5px solid ${rowBorder}`, cursor: 'pointer', flexWrap: 'wrap' }}>
                            <div style={{ flex: 1, minWidth: '150px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                <span style={{ fontWeight: '700', fontSize: '14px', color: '#0f172a' }}>👤 {t.collaborator?.name ?? '—'}</span>
                                {t.collaborator?.role && <span style={{ fontSize: '12px', color: '#64748b' }}>{t.collaborator.role}</span>}
                                <span style={{ padding: '2px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: '600', background: badgeBg, color: badgeColor }}>{badgeLabel}</span>
                              </div>
                            </div>
                            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                              <button onClick={e => { e.stopPropagation(); setPrestacaoTripId(t.id) }} style={{ padding: '6px 12px', borderRadius: '8px', border: '1px solid #fde68a', background: '#fffbeb', fontSize: '12px', cursor: 'pointer', fontWeight: '600', color: '#92400e' }}>📊 Prestação</button>
                              <button onClick={e => { e.stopPropagation(); setDeleteTripId(t.id) }} style={{ padding: '6px 12px', borderRadius: '8px', border: '1px solid #fecaca', background: '#fef2f2', fontSize: '12px', cursor: 'pointer', color: '#dc2626' }}>Excluir</button>
                            </div>
                          </div>
                        )
                      })}
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

// ─── Custos Informativos vinculados a uma viagem ─────────────────────────────
function InformativosVinculados({ tripId }: { tripId: string }) {
  const { data } = trpc.auditInformativeCosts.list.useQuery({ tripId, pageSize: 50 })
  const items = data?.items ?? []
  if (!items.length) return null
  const total = items.reduce((s: number, i: any) => s + Number(i.value), 0)
  return (
    <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '10px', padding: '10px 14px' }}>
      <div style={{ fontSize: '11px', fontWeight: '700', color: '#1e40af', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '8px' }}>
        ℹ️ Custos Informativos ({items.length}) · Total: {formatCurrency(total)}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
        {items.map((item: any) => (
          <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '12px', color: '#1e40af', flexWrap: 'wrap' }}>
            <span style={{ fontWeight: '600', whiteSpace: 'nowrap' }}>{new Date(item.date).toLocaleDateString('pt-BR')}</span>
            <span style={{ background: '#dbeafe', padding: '1px 8px', borderRadius: '10px', fontWeight: '600', whiteSpace: 'nowrap' }}>{item.costCenterName}</span>
            {item.collaborator && <span style={{ color: '#3b82f6' }}>{item.collaborator.name}</span>}
            {item.storeName && <span style={{ color: '#64748b' }}>{item.storeName}</span>}
            {item.reason && <span style={{ color: '#64748b', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.reason}</span>}
            <span style={{ fontWeight: '800', color: '#1e40af', marginLeft: 'auto', whiteSpace: 'nowrap' }}>{formatCurrency(Number(item.value))}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Aba: Viagens Concluídas ──────────────────────────────────────────────────
function AbaConcluidas() {
  const [page, setPage] = useState(1)
  const [filterCollabs, setFilterCollabs] = useState<string[]>([])
  const [filterSearch, setFilterSearch] = useState('')
  const [filterFrom, setFilterFrom] = useState('')
  const [filterTo, setFilterTo] = useState('')
  const [filterCreatedFrom, setFilterCreatedFrom] = useState('')
  const [filterCreatedTo, setFilterCreatedTo] = useState('')
  const [prestacaoTripId, setPrestacaoTripId] = useState<string | null>(null)

  const { data, isLoading } = trpc.auditTrips.list.useQuery({
    page, pageSize: 15, status: 'CLOSED',
    collaboratorIds: filterCollabs.length ? filterCollabs : undefined,
    search: filterSearch || undefined,
    startDateFrom: filterFrom ? new Date(filterFrom) : undefined,
    startDateTo: filterTo ? new Date(filterTo + 'T23:59:59') : undefined,
    createdAtFrom: filterCreatedFrom ? new Date(filterCreatedFrom) : undefined,
    createdAtTo: filterCreatedTo ? new Date(filterCreatedTo + 'T23:59:59') : undefined,
  })
  const { data: collabs } = trpc.auditCollaborators.list.useQuery()
  const { data: prestacaoDetail } = trpc.auditTrips.getById.useQuery({ id: prestacaoTripId! }, { enabled: !!prestacaoTripId })

  const trips = data?.trips ?? []
  const hasFilters = filterCollabs.length || filterSearch || filterFrom || filterTo || filterCreatedFrom || filterCreatedTo

  return (
    <>
      {prestacaoTripId && prestacaoDetail && <PrestacaoModal trip={prestacaoDetail} onClose={() => setPrestacaoTripId(null)} />}

      <div style={{ background: 'white', border: '1.5px solid #e2e8f0', borderRadius: '14px', padding: '14px 16px', display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: '1 1 180px', minWidth: '160px' }}>
          <label style={{ fontSize: '11px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Pesquisar</label>
          <input
            placeholder="Colaborador, viagem, loja..."
            value={filterSearch}
            onChange={e => { setFilterSearch(e.target.value); setPage(1) }}
            style={{ padding: '8px 12px', borderRadius: '8px', border: '1.5px solid #e2e8f0', fontSize: '13px', outline: 'none' }}
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: '1 1 160px', minWidth: '140px' }}>
          <label style={{ fontSize: '11px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Colaborador</label>
          <CollabMultiSelect collabs={collabs ?? []} selectedIds={filterCollabs} onChange={ids => { setFilterCollabs(ids); setPage(1) }} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label style={{ fontSize: '11px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>De</label>
          <input type="date" value={filterFrom} onChange={e => { setFilterFrom(e.target.value); setPage(1) }} style={{ padding: '8px 10px', borderRadius: '8px', border: '1.5px solid #e2e8f0', fontSize: '13px' }} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label style={{ fontSize: '11px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Até</label>
          <input type="date" value={filterTo} onChange={e => { setFilterTo(e.target.value); setPage(1) }} style={{ padding: '8px 10px', borderRadius: '8px', border: '1.5px solid #e2e8f0', fontSize: '13px' }} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label style={{ fontSize: '11px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Criado de</label>
          <input type="date" value={filterCreatedFrom} onChange={e => { setFilterCreatedFrom(e.target.value); setPage(1) }} style={{ padding: '8px 10px', borderRadius: '8px', border: '1.5px solid #e2e8f0', fontSize: '13px' }} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label style={{ fontSize: '11px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Criado até</label>
          <input type="date" value={filterCreatedTo} onChange={e => { setFilterCreatedTo(e.target.value); setPage(1) }} style={{ padding: '8px 10px', borderRadius: '8px', border: '1.5px solid #e2e8f0', fontSize: '13px' }} />
        </div>
        {!!hasFilters && (
          <button onClick={() => { setFilterCollabs([]); setFilterSearch(''); setFilterFrom(''); setFilterTo(''); setFilterCreatedFrom(''); setFilterCreatedTo(''); setPage(1) }}
            style={{ padding: '8px 14px', borderRadius: '8px', border: '1.5px solid #e2e8f0', background: '#f8fafc', fontSize: '13px', cursor: 'pointer', color: '#64748b', alignSelf: 'flex-end' }}>
            ✕ Limpar
          </button>
        )}
      </div>

      <DataCard title={`Viagens Concluídas (${trips.length})`}>
        {isLoading ? <LoadingState /> : !trips.length ? (
          <EmptyState icon="✅" title="Nenhuma viagem concluída" description="As viagens validadas pelo financeiro aparecem aqui." />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {trips.map((t: any) => (
              <div key={t.id} style={{ border: '2px solid #86efac', borderRadius: '14px', overflow: 'hidden', background: '#f0fdf4' }}>
                <div style={{ padding: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: '160px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: '700', fontSize: '15px', color: '#0f172a' }}>{t.collaborator?.name ?? '—'}</span>
                        {t.collaborator?.role && <span style={{ fontSize: '12px', color: '#64748b' }}>{t.collaborator.role}</span>}
                        <span style={{ padding: '2px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: '700', background: '#dcfce7', color: '#166534' }}>✓ Concluída</span>
                      </div>
                      <div style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>{t.reason && <span>{t.reason}</span>}{t.stores && <span> · {t.stores}</span>}</div>
                      <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>{formatDate(t.startDate)} → {formatDate(t.endDate)}</div>
                      {t.createdAt && <div style={{ fontSize: '11px', color: '#cbd5e1', marginTop: '2px' }}>Criado em: {new Date(t.createdAt).toLocaleDateString('pt-BR')}</div>}
                    </div>
                    <div style={{ textAlign: 'right', minWidth: '130px' }}>
                      <div style={{ fontSize: '18px', fontWeight: '800', color: '#0f172a' }}>{formatCurrency(Number(t.spentAmount ?? 0))}</div>
                      <div style={{ fontSize: '12px', color: '#64748b' }}>gasto total</div>
                    </div>
                  </div>
                </div>
                <div style={{ padding: '0 16px 14px', borderTop: '1px solid #dcfce7', paddingTop: '10px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <button onClick={() => setPrestacaoTripId(t.id)} style={{ padding: '6px 12px', borderRadius: '8px', border: '1px solid #86efac', background: 'white', fontSize: '12px', cursor: 'pointer', fontWeight: '600', color: '#166534', alignSelf: 'flex-start' }}>📊 Ver Prestação</button>
                  <InformativosVinculados tripId={t.id} />
                </div>
              </div>
            ))}
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

// ─── Modal Novo Custo Informativo ─────────────────────────────────────────────
function NovoCustoInformativoModal({ onClose, onCreated, collabsList, costTypes, storesList }: {
  onClose: () => void
  onCreated?: () => void
  collabsList: any[]
  costTypes: any[]
  storesList: any[]
}) {
  const utils = trpc.useUtils()
  const today = new Date().toISOString().slice(0, 10)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)

  const tipos = costTypes.length > 0 ? costTypes.map((t: any) => t.name) : DEFAULT_COST_TYPES

  const [form, setForm] = useState({
    costCenterName: '',
    date: today,
    reason: '',
    value: '',
    paymentMethod: '',
  })
  const [selectedCollabIds, setSelectedCollabIds] = useState<string[]>([])
  const [selectedStoreNames, setSelectedStoreNames] = useState<string[]>([])
  const [attachments, setAttachments] = useState<string[]>([])
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const createMut = trpc.auditInformativeCosts.create.useMutation()

  function set(k: string, v: string) { setForm(f => ({ ...f, [k]: v })) }

  const storeOptions = storesList.map((s: any) => (s.code ? `[${s.code}] ${s.name}` : s.name))

  function handleFiles(ev: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(ev.target.files ?? [])
    if (!files.length) return
    for (const file of files) {
      const reader = new FileReader()
      reader.onload = e => setAttachments(prev => [...prev, e.target?.result as string])
      reader.readAsDataURL(file)
    }
    ev.target.value = ''
  }

  async function handleSave() {
    if (!form.costCenterName) { setError('Selecione o centro de custo.'); return }
    if (!form.date) { setError('Informe a data.'); return }
    if (!form.value || isNaN(Number(form.value.replace(',', '.')))) { setError('Informe o valor.'); return }
    setError('')
    setSaving(true)
    try {
      await createMut.mutateAsync({
        costCenterName:  form.costCenterName,
        date:            new Date(form.date + 'T12:00:00'),
        storeName:       selectedStoreNames.length ? selectedStoreNames.join(', ') : undefined,
        reason:          form.reason || undefined,
        collaboratorId:  selectedCollabIds[0] || undefined,
        collaboratorIds: selectedCollabIds.length ? selectedCollabIds : undefined,
        value:           Number(form.value.replace(',', '.')),
        paymentMethod:   form.paymentMethod || undefined,
        attachmentUrls:  attachments.length ? attachments : undefined,
      })
      utils.auditInformativeCosts.list.invalidate()
      onCreated ? onCreated() : onClose()
    } catch (e: any) {
      setError(e?.message ?? 'Erro ao salvar.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title="Novo Custo Informativo" onClose={onClose}>
      {lightboxUrl && (
        <div onClick={() => setLightboxUrl(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'zoom-out' }}>
          <img src={lightboxUrl} alt="comprovante" style={{ maxWidth: '90vw', maxHeight: '90vh', borderRadius: '8px' }} onClick={e => e.stopPropagation()} />
          <button onClick={() => setLightboxUrl(null)} style={{ position: 'absolute', top: '20px', right: '24px', background: 'rgba(255,255,255,0.15)', border: 'none', color: 'white', fontSize: '28px', cursor: 'pointer', borderRadius: '50%', width: '40px', height: '40px', lineHeight: '40px', textAlign: 'center' }}>✕</button>
        </div>
      )}

      {error && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '10px 14px', marginBottom: '16px', fontSize: '13px', color: '#dc2626' }}>{error}</div>}

      <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '10px', padding: '10px 14px', marginBottom: '16px', fontSize: '12px', color: '#1e40af' }}>
        Registro informativo — não gera obrigação de prestação de contas nem afeta saldo de adiantamento.
      </div>

      <Field label="Centro de Custo *">
        <select style={inp} value={form.costCenterName} onChange={e => set('costCenterName', e.target.value)}>
          <option value="">Selecione o tipo de custo...</option>
          {tipos.map((t: string) => <option key={t} value={t}>{t}</option>)}
        </select>
      </Field>

      <div style={{ display: 'flex', gap: '12px' }}>
        <Field label="Data *" row>
          <input style={inp} type="date" value={form.date} onChange={e => set('date', e.target.value)} />
        </Field>
        <Field label="Valor (R$) *" row>
          <input style={inp} value={form.value} onChange={e => set('value', e.target.value)} inputMode="decimal" placeholder="0,00" />
        </Field>
      </div>

      <Field label="Colaborador" hint="Pode selecionar mais de um">
        <CollabMultiSelect
          collabs={collabsList}
          selectedIds={selectedCollabIds}
          onChange={setSelectedCollabIds}
        />
      </Field>

      <Field label="Loja" hint="Pode selecionar mais de uma">
        <LojasDoDiaSelect
          options={storeOptions}
          selected={selectedStoreNames}
          onChange={setSelectedStoreNames}
        />
      </Field>

      <Field label="Motivo">
        <textarea style={{ ...inp, minHeight: '60px', resize: 'vertical' }} value={form.reason} onChange={e => set('reason', e.target.value)} placeholder="Descreva o motivo do custo..." />
      </Field>

      <Field label="Forma de Pagamento">
        <input style={inp} value={form.paymentMethod} onChange={e => set('paymentMethod', e.target.value)} placeholder="Ex: Pix, Cartão, Dinheiro..." />
      </Field>

      {/* ── Comprovantes ── */}
      <Field label="Comprovantes" hint="Aceita imagens e PDFs — pode adicionar mais de um ou tirar foto">
        <input ref={fileInputRef} type="file" accept="image/*,application/pdf" multiple style={{ display: 'none' }} onChange={handleFiles} />
        <input ref={cameraInputRef} type="file" accept="image/*" capture style={{ display: 'none' }} onChange={handleFiles} />
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => fileInputRef.current?.click()}
            style={{ padding: '9px 16px', borderRadius: '10px', border: '1.5px dashed #cbd5e1', background: '#f8fafc', fontSize: '13px', fontWeight: '600', color: '#475569', cursor: 'pointer', flex: 1, textAlign: 'center' }}>
            📎 Arquivo / Galeria
          </button>
          <button
            onClick={() => cameraInputRef.current?.click()}
            style={{ padding: '9px 16px', borderRadius: '10px', border: '1.5px dashed #a5b4fc', background: '#f5f3ff', fontSize: '13px', fontWeight: '600', color: '#4f46e5', cursor: 'pointer', flex: 1, textAlign: 'center' }}>
            📷 Câmera
          </button>
        </div>
        {attachments.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '10px' }}>
            {attachments.map((url, idx) => {
              const isImg = url.startsWith('data:image')
              return (
                <div key={idx} style={{ position: 'relative', display: 'inline-block' }}>
                  {isImg ? (
                    <img src={url} alt={`comp ${idx + 1}`}
                      onClick={() => setLightboxUrl(url)}
                      style={{ height: '64px', width: '88px', objectFit: 'cover', borderRadius: '8px', border: '1.5px solid #bfdbfe', cursor: 'zoom-in', display: 'block' }} />
                  ) : (
                    <div style={{ padding: '10px 14px', background: '#eff6ff', border: '1.5px solid #bfdbfe', borderRadius: '8px', fontSize: '12px', color: '#1e40af', fontWeight: '600' }}>📄 {idx + 1}</div>
                  )}
                  <button
                    onClick={() => setAttachments(p => p.filter((_, i) => i !== idx))}
                    style={{ position: 'absolute', top: '-6px', right: '-6px', width: '18px', height: '18px', borderRadius: '50%', border: 'none', background: '#ef4444', color: 'white', fontSize: '10px', cursor: 'pointer', lineHeight: '18px', textAlign: 'center', padding: 0 }}>✕</button>
                </div>
              )
            })}
          </div>
        )}
        {attachments.length > 0 && (
          <div style={{ fontSize: '12px', color: '#16a34a', fontWeight: '600', marginTop: '6px' }}>✓ {attachments.length} comprovante(s) anexado(s)</div>
        )}
      </Field>

      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', borderTop: '1px solid #f1f5f9', paddingTop: '16px' }}>
        <Btn variant="outline" onClick={onClose}>Cancelar</Btn>
        <Btn onClick={handleSave} disabled={saving}>{saving ? 'Salvando...' : 'Cadastrar'}</Btn>
      </div>
    </Modal>
  )
}

// ─── Aba: Custos Informativos ─────────────────────────────────────────────────
function AbaInformativos() {
  const utils = trpc.useUtils()
  const [page, setPage] = useState(1)
  const [filterSearch, setFilterSearch] = useState('')
  const [filterFrom, setFilterFrom] = useState('')
  const [filterTo, setFilterTo] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const { data, isLoading } = trpc.auditInformativeCosts.list.useQuery({
    page, pageSize: 20,
    search: filterSearch || undefined,
    startDate: filterFrom ? new Date(filterFrom) : undefined,
    endDate: filterTo ? new Date(filterTo + 'T23:59:59') : undefined,
  })
  const { data: collabs }    = trpc.auditCollaborators.list.useQuery()
  const { data: costTypes }  = trpc.auditCostTypes.list.useQuery()
  const { data: storesData } = trpc.stores.list.useQuery({ pageSize: 200 })
  const storesList = storesData?.stores ?? []

  const deleteMut = trpc.auditInformativeCosts.delete.useMutation({
    onSuccess: () => { utils.auditInformativeCosts.list.invalidate(); setDeleteId(null) },
  })

  const items = data?.items ?? []
  const hasFilters = filterSearch || filterFrom || filterTo

  const thSt: React.CSSProperties = { padding: '9px 14px', fontSize: '11px', fontWeight: '700', color: '#64748b', background: '#f8fafc', borderBottom: '2px solid #e2e8f0', textAlign: 'left', whiteSpace: 'nowrap' }
  const tdSt: React.CSSProperties = { padding: '11px 14px', borderBottom: '1px solid #f1f5f9', verticalAlign: 'middle', fontSize: '13px' }

  return (
    <>
      {showNew && (
        <NovoCustoInformativoModal
          onClose={() => setShowNew(false)}
          onCreated={() => setShowNew(false)}
          collabsList={collabs ?? []}
          costTypes={costTypes ?? []}
          storesList={storesList}
        />
      )}
      {deleteId && (
        <Modal title="Confirmar Exclusão" onClose={() => setDeleteId(null)}>
          <div style={{ padding: '8px 0 24px', fontSize: '15px', color: '#374151' }}>Excluir este custo informativo?</div>
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <Btn variant="outline" onClick={() => setDeleteId(null)}>Cancelar</Btn>
            <Btn variant="danger" onClick={() => deleteMut.mutate({ id: deleteId })} disabled={deleteMut.isPending}>Excluir</Btn>
          </div>
        </Modal>
      )}

      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', marginBottom: '16px' }}>
        <div style={{ background: 'white', border: '1.5px solid #e2e8f0', borderRadius: '14px', padding: '14px 16px', display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'flex-end', flex: 1 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: '1 1 180px', minWidth: '160px' }}>
            <label style={{ fontSize: '11px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Pesquisar</label>
            <input
              placeholder="Colaborador, loja, motivo..."
              value={filterSearch}
              onChange={e => { setFilterSearch(e.target.value); setPage(1) }}
              style={{ padding: '8px 12px', borderRadius: '8px', border: '1.5px solid #e2e8f0', fontSize: '13px', outline: 'none' }}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '11px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>De</label>
            <input type="date" value={filterFrom} onChange={e => { setFilterFrom(e.target.value); setPage(1) }} style={{ padding: '8px 10px', borderRadius: '8px', border: '1.5px solid #e2e8f0', fontSize: '13px' }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '11px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Até</label>
            <input type="date" value={filterTo} onChange={e => { setFilterTo(e.target.value); setPage(1) }} style={{ padding: '8px 10px', borderRadius: '8px', border: '1.5px solid #e2e8f0', fontSize: '13px' }} />
          </div>
          {!!hasFilters && (
            <button onClick={() => { setFilterSearch(''); setFilterFrom(''); setFilterTo(''); setPage(1) }}
              style={{ padding: '8px 14px', borderRadius: '8px', border: '1.5px solid #e2e8f0', background: '#f8fafc', fontSize: '13px', cursor: 'pointer', color: '#64748b', alignSelf: 'flex-end' }}>
              ✕ Limpar
            </button>
          )}
        </div>
        <Btn onClick={() => setShowNew(true)}>+ Novo Custo Informativo</Btn>
      </div>

      <DataCard title={`Custos Informativos (${data?.meta?.total ?? items.length})`}>
        {isLoading ? <LoadingState /> : !items.length ? (
          <EmptyState icon="ℹ️" title="Nenhum custo informativo" description='Clique em "+ Novo Custo Informativo" para registrar.' />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={thSt}>Data</th>
                  <th style={thSt}>Centro de Custo</th>
                  <th style={thSt}>Colaborador</th>
                  <th style={thSt}>Loja</th>
                  <th style={thSt}>Motivo</th>
                  <th style={thSt}>Pagamento</th>
                  <th style={{ ...thSt, textAlign: 'right' }}>Valor</th>
                  <th style={thSt}>Comprovantes</th>
                  <th style={{ ...thSt, textAlign: 'right' }}></th>
                </tr>
              </thead>
              <tbody>
                {items.map((item: any) => (
                  <tr key={item.id} style={{ background: 'white' }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#f8fafc'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'white'}>
                    <td style={{ ...tdSt, whiteSpace: 'nowrap', color: '#374151' }}>{new Date(item.date).toLocaleDateString('pt-BR')}</td>
                    <td style={tdSt}>
                      <span style={{ padding: '2px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '600', background: '#eff6ff', color: '#1d4ed8' }}>
                        ℹ️ {item.costCenterName}
                      </span>
                    </td>
                    <td style={{ ...tdSt, maxWidth: '200px' }}>
                      {(() => {
                        const ids: string[] = (() => { try { return item.collaboratorIds ? JSON.parse(item.collaboratorIds) : [] } catch { return [] } })()
                        if (ids.length > 1) {
                          return (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px' }}>
                              {ids.map((id: string) => {
                                const c = (collabs as any[])?.find((x: any) => x.id === id)
                                return <span key={id} style={{ fontSize: '11px', background: '#dbeafe', color: '#1e40af', padding: '2px 7px', borderRadius: '10px', fontWeight: '600', whiteSpace: 'nowrap' }}>{c?.name ?? '—'}</span>
                              })}
                            </div>
                          )
                        }
                        if (item.collaborator) return (
                          <div>
                            <div style={{ fontWeight: '600', color: '#0f172a', fontSize: '13px' }}>{item.collaborator.name}</div>
                            {item.collaborator.role && <div style={{ fontSize: '11px', color: '#94a3b8' }}>{item.collaborator.role}</div>}
                          </div>
                        )
                        return <span style={{ color: '#94a3b8' }}>—</span>
                      })()}
                    </td>
                    <td style={{ ...tdSt, maxWidth: '200px' }}>
                      {(() => {
                        if (!item.storeName) return <span style={{ color: '#94a3b8' }}>—</span>
                        const names = item.storeName.split(',').map((s: string) => s.trim()).filter(Boolean)
                        if (names.length <= 1) return <span style={{ color: '#374151', fontSize: '13px' }}>{item.storeName}</span>
                        return (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px' }}>
                            {names.map((name: string, i: number) => (
                              <span key={i} style={{ fontSize: '11px', background: '#f0fdf4', color: '#166534', padding: '2px 7px', borderRadius: '10px', fontWeight: '600', border: '1px solid #bbf7d0', whiteSpace: 'nowrap' }}>{name}</span>
                            ))}
                          </div>
                        )
                      })()}
                    </td>
                    <td style={{ ...tdSt, color: '#64748b', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.reason || <span style={{ color: '#94a3b8' }}>—</span>}
                    </td>
                    <td style={{ ...tdSt, color: '#64748b' }}>{item.paymentMethod || <span style={{ color: '#94a3b8' }}>—</span>}</td>
                    <td style={{ ...tdSt, textAlign: 'right', fontWeight: '700', color: '#0f172a' }}>{formatCurrency(Number(item.value))}</td>
                    <td style={tdSt}>
                      {(() => {
                        const urls: string[] = (() => { try { return item.attachmentUrls ? JSON.parse(item.attachmentUrls) : [] } catch { return [] } })()
                        if (!urls.length) return <span style={{ color: '#94a3b8', fontSize: '12px' }}>—</span>
                        return (
                          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                            {urls.map((url: string, idx: number) => {
                              const isImg = url.startsWith('data:image')
                              return isImg ? (
                                <img key={idx} src={url} alt={`comp ${idx + 1}`}
                                  onClick={() => { const w = window.open(); w?.document.write(`<img src="${url}" style="max-width:100%">`) }}
                                  style={{ height: '36px', width: '50px', objectFit: 'cover', borderRadius: '5px', border: '1px solid #bfdbfe', cursor: 'zoom-in' }} />
                              ) : (
                                <a key={idx} href={url} target="_blank" rel="noopener noreferrer"
                                  style={{ fontSize: '11px', padding: '4px 8px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '6px', color: '#1e40af', textDecoration: 'none' }}>
                                  📄 {idx + 1}
                                </a>
                              )
                            })}
                          </div>
                        )
                      })()}
                    </td>
                    <td style={{ ...tdSt, textAlign: 'right' }}>
                      <button onClick={() => setDeleteId(item.id)}
                        style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid #fecaca', background: '#fef2f2', color: '#dc2626', cursor: 'pointer', fontSize: '11px' }}>
                        Excluir
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
type Tab = 'viagens' | 'emandamento' | 'concluidas' | 'informativos' | 'colaboradores' | 'tipos'

export default function ViagensPage() {
  const [tab, setTab] = useState<Tab>('viagens')
  const tabStyle = (active: boolean): React.CSSProperties => ({ padding: '9px 20px', borderRadius: '10px', border: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: active ? '700' : '500', background: active ? '#0f172a' : 'transparent', color: active ? 'white' : '#64748b', transition: 'all 0.15s' })
  return (
    <ModulePage title="Custo de Auditoria — Viagens" description="Gerencie colaboradores, tipos de custo e cadastre viagens com prestação de contas">
      <div style={{ display: 'flex', gap: '4px', background: '#f1f5f9', padding: '4px', borderRadius: '14px', width: 'fit-content', flexWrap: 'wrap' }}>
        <button style={tabStyle(tab === 'viagens')} onClick={() => setTab('viagens')}>✈️ Viagens</button>
        <button style={tabStyle(tab === 'emandamento')} onClick={() => setTab('emandamento')}>⏳ Em Andamento</button>
        <button style={tabStyle(tab === 'concluidas')} onClick={() => setTab('concluidas')}>✅ Concluídas</button>
        <button style={tabStyle(tab === 'informativos')} onClick={() => setTab('informativos')}>ℹ️ Custos Informativos</button>
        <button style={tabStyle(tab === 'colaboradores')} onClick={() => setTab('colaboradores')}>👥 Colaboradores</button>
        <button style={tabStyle(tab === 'tipos')} onClick={() => setTab('tipos')}>🏷️ Tipos de Custo</button>
      </div>
      {tab === 'viagens' && <AbaViagens onGoEmAndamento={() => setTab('emandamento')} />}
      {tab === 'emandamento' && <AbaEmAndamento />}
      {tab === 'concluidas' && <AbaConcluidas />}
      {tab === 'informativos' && <AbaInformativos />}
      {tab === 'colaboradores' && <AbaColaboradores />}
      {tab === 'tipos' && <AbaTiposCusto />}
    </ModulePage>
  )
}
