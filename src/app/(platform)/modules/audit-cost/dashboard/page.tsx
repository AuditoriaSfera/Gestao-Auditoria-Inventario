'use client'

export const dynamic = 'force-dynamic'

import { useState, useMemo, useEffect } from 'react'
import { trpc } from '@/lib/trpc'
import { ModulePage, DataCard, EmptyState } from '@/components/shared/module-page'
import { formatCurrency } from '@/lib/utils'

const MONTHS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
const BAR_COLORS = ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#f97316','#84cc16']

// ── Wrapper clicável para os cards ────────────────────────────────────────────
function ClickableCard({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <div onClick={onClick} style={{ cursor: 'pointer', borderRadius: '16px', transition: 'box-shadow 0.15s, transform 0.15s', height: '100%', display: 'flex', flexDirection: 'column' }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 20px rgba(37,99,235,0.13)'; (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)' }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = ''; (e.currentTarget as HTMLElement).style.transform = '' }}
    >
      {children}
    </div>
  )
}

// ── Detalhe em tela cheia ─────────────────────────────────────────────────────
function DetailView({ type, onClose, expenses, trips, salaries, collabs, selectedPeriods, effectiveCollabs }: {
  type: 'colaborador' | 'centrocusto' | 'pagamento' | 'loja' | 'dias' | 'pessoal'
  onClose: () => void
  expenses: any[]; trips: any[]; salaries: any[]; collabs: any[]
  selectedPeriods: string[]; effectiveCollabs: string[]
}) {
  const [search, setSearch] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const titles: Record<typeof type, string> = {
    colaborador: 'Gastos por Colaborador',
    centrocusto: 'Gastos por Centro de Custo',
    pagamento: 'Por Forma de Pagamento',
    loja: 'Gastos e Inventários por Loja',
    dias: 'Dias em Viagem por Colaborador',
    pessoal: 'Custo de Pessoal por Colaborador',
  }

  // Filtra despesas respeitando os filtros do detail
  const filtered = useMemo(() => {
    return expenses.filter(e => {
      const inPeriod = selectedPeriods.length === 0 || selectedPeriods.some(pk => {
        const [y, m] = pk.split('-').map(Number)
        const d = new Date(e.date)
        return d.getFullYear() === y && d.getMonth() + 1 === m
      })
      const inCollab = effectiveCollabs.length === 0 || effectiveCollabs.includes(e.collaboratorId) || effectiveCollabs.includes(e.auditorId)
      const d = new Date(e.date)
      const inFrom = !dateFrom || d >= new Date(dateFrom)
      const inTo   = !dateTo   || d <= new Date(dateTo + 'T23:59:59')
      const q = search.toLowerCase()
      const inSearch = !q || (e.type ?? '').toLowerCase().includes(q) ||
        (e.storeName ?? '').toLowerCase().includes(q) ||
        (e.paymentMethod ?? '').toLowerCase().includes(q) ||
        (collabs?.find((c: any) => c.id === (e.collaboratorId ?? e.auditorId))?.name ?? '').toLowerCase().includes(q)
      return inPeriod && inCollab && inFrom && inTo && inSearch
    })
  }, [expenses, selectedPeriods, effectiveCollabs, dateFrom, dateTo, search, collabs])

  const filteredTrips = useMemo(() => {
    return trips.filter(t => {
      const inPeriod = selectedPeriods.length === 0 || selectedPeriods.some(pk => {
        const [y, m] = pk.split('-').map(Number)
        const d = new Date(t.startDate)
        return d.getFullYear() === y && d.getMonth() + 1 === m
      })
      const inCollab = effectiveCollabs.length === 0 || effectiveCollabs.includes(t.collaboratorId)
      const q = search.toLowerCase()
      const collab = collabs?.find((c: any) => c.id === t.collaboratorId)
      const inSearch = !q || (collab?.name ?? '').toLowerCase().includes(q) || (t.stores ?? '').toLowerCase().includes(q) || (t.reason ?? '').toLowerCase().includes(q)
      return inPeriod && inCollab && inSearch
    })
  }, [trips, selectedPeriods, effectiveCollabs, search, collabs])

  const thSt: React.CSSProperties = { padding: '10px 14px', fontSize: '11px', fontWeight: '700', color: '#64748b', background: '#f8fafc', borderBottom: '2px solid #e2e8f0', textAlign: 'left', whiteSpace: 'nowrap', position: 'sticky', top: 0, zIndex: 1 }
  const tdSt: React.CSSProperties = { padding: '10px 14px', borderBottom: '1px solid #f1f5f9', fontSize: '13px', verticalAlign: 'middle' }

  function fmt(d: any) { return d ? new Date(d).toLocaleDateString('pt-BR') : '—' }
  function curr(v: any) { return `R$ ${Number(v).toFixed(2).replace('.', ',')}` }
  function collabName(id: string) { return collabs?.find((c: any) => c.id === id)?.name ?? '—' }

  // Agrupamento para cada tipo
  const grouped = useMemo(() => {
    if (type === 'colaborador') {
      const map = new Map<string, { name: string; total: number; rows: any[] }>()
      for (const e of filtered) {
        const id = e.collaboratorId ?? e.auditorId ?? '?'
        const name = collabName(id)
        const prev = map.get(id) ?? { name, total: 0, rows: [] }
        map.set(id, { name, total: prev.total + Number(e.value), rows: [...prev.rows, e] })
      }
      return [...map.values()].sort((a, b) => b.total - a.total)
    }
    if (type === 'centrocusto') {
      const map = new Map<string, { name: string; total: number; rows: any[] }>()
      for (const e of filtered) {
        const key = e.type ?? 'Não informado'
        const prev = map.get(key) ?? { name: key, total: 0, rows: [] }
        map.set(key, { name: key, total: prev.total + Number(e.value), rows: [...prev.rows, e] })
      }
      return [...map.values()].sort((a, b) => b.total - a.total)
    }
    if (type === 'pagamento') {
      const map = new Map<string, { name: string; total: number; rows: any[] }>()
      for (const e of filtered) {
        const key = e.paymentMethod ?? 'Não informado'
        const prev = map.get(key) ?? { name: key, total: 0, rows: [] }
        map.set(key, { name: key, total: prev.total + Number(e.value), rows: [...prev.rows, e] })
      }
      return [...map.values()].sort((a, b) => b.total - a.total)
    }
    if (type === 'loja') {
      const map = new Map<string, { name: string; spent: number; inventories: number; rows: any[] }>()
      for (const e of filtered) {
        if (!e.storeName) continue
        const prev = map.get(e.storeName) ?? { name: e.storeName, spent: 0, inventories: 0, rows: [] }
        map.set(e.storeName, { ...prev, spent: prev.spent + Number(e.value), rows: [...prev.rows, e] })
      }
      for (const t of filteredTrips) {
        if (!t.stores) continue
        for (const sn of t.stores.split(',').map((s: string) => s.trim()).filter(Boolean)) {
          const prev = map.get(sn) ?? { name: sn, spent: 0, inventories: 0, rows: [] }
          map.set(sn, { ...prev, inventories: prev.inventories + 1 })
        }
      }
      return [...map.values()].sort((a, b) => b.inventories - a.inventories || b.spent - a.spent)
    }
    return []
  }, [type, filtered, filteredTrips, collabs])

  const salFiltered = useMemo(() => {
    if (type !== 'pessoal') return []
    const q = search.toLowerCase()
    return salaries.filter(s => s.deletedAt == null && s.status === 'ACTIVE' &&
      (effectiveCollabs.length === 0 || effectiveCollabs.includes(s.collaboratorId)) &&
      (!q || (s.collaborator?.name ?? '').toLowerCase().includes(q) || (s.cargo ?? '').toLowerCase().includes(q))
    ).sort((a, b) => (Number(b.salarioBase) + Number(b.encargos)) - (Number(a.salarioBase) + Number(a.encargos)))
  }, [type, salaries, effectiveCollabs, search])

  function exportCSV() {
    const BOM = '﻿'
    const escape = (v: any) => {
      const s = String(v ?? '').replace(/"/g, '""')
      return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s}"` : s
    }
    const toRow = (arr: any[]) => arr.map(escape).join(',')
    let rows: string[][] = []

    if (type === 'colaborador' || type === 'centrocusto' || type === 'pagamento') {
      const secondCol = type === 'colaborador' ? 'Centro de Custo' : 'Colaborador'
      rows.push(['Data', secondCol, 'Loja', 'Forma de Pagamento', 'Valor'])
      for (const g of grouped as any[]) {
        for (const e of [...g.rows].sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())) {
          const secondVal = type === 'colaborador' ? (e.type ?? '') : collabName(e.collaboratorId ?? e.auditorId)
          rows.push([fmt(e.date), secondVal, e.storeName ?? '', e.paymentMethod ?? '', Number(e.value).toFixed(2).replace('.', ',')])
        }
      }
    } else if (type === 'loja') {
      rows.push(['Loja', 'Inventários', 'Total Gasto'])
      for (const s of grouped as any[]) {
        rows.push([s.name, String(s.inventories), Number(s.spent).toFixed(2).replace('.', ',')])
      }
    } else if (type === 'dias') {
      rows.push(['Colaborador', 'Cidade', 'Estado', 'Lojas', 'Início', 'Fim', 'Dias', 'Motivo'])
      for (const t of [...filteredTrips].sort((a: any, b: any) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime())) {
        const s = new Date(t.startDate); const e = t.endDate ? new Date(t.endDate) : new Date(t.startDate)
        let days = 0; const cur = new Date(s); while (cur <= e) { days++; cur.setDate(cur.getDate() + 1) }
        rows.push([collabName(t.collaboratorId), t.city ?? '', t.state ?? '', t.stores ?? '', fmt(t.startDate), fmt(t.endDate), String(days), t.reason ?? ''])
      }
    } else if (type === 'pessoal') {
      rows.push(['Colaborador', 'Cargo', 'Time', 'Vigência Início', 'Vigência Fim', 'Salário Base', 'Encargos', 'Total'])
      for (const s of salFiltered) {
        rows.push([s.collaborator?.name ?? '', s.cargo ?? '', s.tipoTime === 'campo' ? 'Campo' : 'Administrativo', fmt(s.vigenciaInicio), s.vigenciaFim ? fmt(s.vigenciaFim) : 'atual', Number(s.salarioBase).toFixed(2).replace('.', ','), Number(s.encargos).toFixed(2).replace('.', ','), (Number(s.salarioBase) + Number(s.encargos)).toFixed(2).replace('.', ',')])
      }
    }

    const csv = BOM + rows.map(toRow).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${titles[type].replace(/\s+/g, '_')}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9000, background: '#f8fafc', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '16px 24px', background: 'white', borderBottom: '1px solid #e2e8f0', flexShrink: 0 }}>
        <button onClick={onClose} style={{ padding: '8px 16px', borderRadius: '8px', border: '1.5px solid #e2e8f0', background: 'white', cursor: 'pointer', fontSize: '13px', fontWeight: '600', color: '#475569', display: 'flex', alignItems: 'center', gap: '6px' }}>
          ← Voltar
        </button>
        <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: '#0f172a', flex: 1 }}>{titles[type]}</h2>
        <button onClick={exportCSV} style={{ padding: '8px 16px', borderRadius: '8px', border: '1.5px solid #22c55e', background: '#f0fdf4', cursor: 'pointer', fontSize: '13px', fontWeight: '600', color: '#16a34a', display: 'flex', alignItems: 'center', gap: '6px' }}>
          ⬇ Exportar CSV
        </button>
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', padding: '14px 24px', background: 'white', borderBottom: '1px solid #e2e8f0', flexShrink: 0 }}>
        <input placeholder="Pesquisar..." value={search} onChange={e => setSearch(e.target.value)}
          style={{ padding: '8px 12px', borderRadius: '8px', border: '1.5px solid #e2e8f0', fontSize: '13px', minWidth: '220px', flex: 1 }} />
        {type !== 'pessoal' && type !== 'dias' && (<>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <label style={{ fontSize: '10px', fontWeight: '600', color: '#94a3b8', textTransform: 'uppercase' }}>De</label>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ padding: '7px 10px', borderRadius: '8px', border: '1.5px solid #e2e8f0', fontSize: '13px' }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <label style={{ fontSize: '10px', fontWeight: '600', color: '#94a3b8', textTransform: 'uppercase' }}>Até</label>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={{ padding: '7px 10px', borderRadius: '8px', border: '1.5px solid #e2e8f0', fontSize: '13px' }} />
          </div>
          {(search || dateFrom || dateTo) && (
            <button onClick={() => { setSearch(''); setDateFrom(''); setDateTo('') }} style={{ alignSelf: 'flex-end', padding: '8px 14px', borderRadius: '8px', border: '1.5px solid #e2e8f0', background: 'white', cursor: 'pointer', fontSize: '13px', color: '#64748b' }}>✕ Limpar</button>
          )}
        </>)}
      </div>

      {/* Conteúdo */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>

        {/* Despesas agrupadas */}
        {(type === 'colaborador' || type === 'centrocusto' || type === 'pagamento') && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {grouped.length === 0 ? <div style={{ textAlign: 'center', color: '#94a3b8', padding: '48px' }}>Nenhum registro encontrado.</div> :
              grouped.map((g: any) => (
                <div key={g.name} style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                    <span style={{ fontWeight: '700', fontSize: '14px', color: '#0f172a' }}>{g.name}</span>
                    <span style={{ fontWeight: '800', fontSize: '15px', color: '#2563eb' }}>{curr(g.total)}</span>
                  </div>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr>
                          <th style={thSt}>Data</th>
                          {type === 'colaborador' && <th style={thSt}>Centro de Custo</th>}
                          {type === 'centrocusto' && <th style={thSt}>Colaborador</th>}
                          {type === 'pagamento'   && <th style={thSt}>Colaborador</th>}
                          <th style={thSt}>Loja</th>
                          <th style={thSt}>Forma de Pagamento</th>
                          <th style={{ ...thSt, textAlign: 'right' }}>Valor</th>
                        </tr>
                      </thead>
                      <tbody>
                        {g.rows.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((e: any) => (
                          <tr key={e.id}>
                            <td style={tdSt}>{fmt(e.date)}</td>
                            {type === 'colaborador' && <td style={tdSt}>{e.type ?? '—'}</td>}
                            {type === 'centrocusto' && <td style={tdSt}>{collabName(e.collaboratorId ?? e.auditorId)}</td>}
                            {type === 'pagamento'   && <td style={tdSt}>{collabName(e.collaboratorId ?? e.auditorId)}</td>}
                            <td style={tdSt}>{e.storeName ?? '—'}</td>
                            <td style={tdSt}>{e.paymentMethod ?? '—'}</td>
                            <td style={{ ...tdSt, textAlign: 'right', fontWeight: '700' }}>{curr(e.value)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))
            }
          </div>
        )}

        {/* Lojas */}
        {type === 'loja' && (
          grouped.length === 0 ? <div style={{ textAlign: 'center', color: '#94a3b8', padding: '48px' }}>Nenhum registro encontrado.</div> :
          <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>
                <th style={thSt}>Loja</th>
                <th style={{ ...thSt, textAlign: 'center' }}>Inventários</th>
                <th style={{ ...thSt, textAlign: 'right' }}>Total Gasto</th>
              </tr></thead>
              <tbody>
                {(grouped as any[]).map((s: any) => (
                  <tr key={s.name}>
                    <td style={tdSt}><span style={{ fontWeight: '600' }}>{s.name}</span></td>
                    <td style={{ ...tdSt, textAlign: 'center' }}>{s.inventories > 0 ? <span style={{ background: '#dbeafe', color: '#1d4ed8', borderRadius: '20px', padding: '2px 10px', fontWeight: '700', fontSize: '12px' }}>{s.inventories} inv.</span> : '—'}</td>
                    <td style={{ ...tdSt, textAlign: 'right', fontWeight: '700' }}>{s.spent > 0 ? curr(s.spent) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Dias em viagem */}
        {type === 'dias' && (
          filteredTrips.length === 0 ? <div style={{ textAlign: 'center', color: '#94a3b8', padding: '48px' }}>Nenhuma viagem encontrada.</div> :
          <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>
                <th style={thSt}>Colaborador</th>
                <th style={thSt}>Destino / Lojas</th>
                <th style={thSt}>Período</th>
                <th style={thSt}>Motivo</th>
                <th style={{ ...thSt, textAlign: 'center' }}>Dias</th>
              </tr></thead>
              <tbody>
                {filteredTrips.sort((a: any, b: any) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime()).map((t: any) => {
                  const s = new Date(t.startDate); const e = t.endDate ? new Date(t.endDate) : new Date(t.startDate)
                  let days = 0; const cur = new Date(s); while (cur <= e) { days++; cur.setDate(cur.getDate() + 1) }
                  return (
                    <tr key={t.id}>
                      <td style={tdSt}><span style={{ fontWeight: '600' }}>{collabName(t.collaboratorId)}</span></td>
                      <td style={tdSt}><div>{t.city}{t.state ? `/${t.state}` : ''}</div>{t.stores && <div style={{ fontSize: '11px', color: '#94a3b8' }}>{t.stores}</div>}</td>
                      <td style={tdSt}>{fmt(t.startDate)} → {fmt(t.endDate)}</td>
                      <td style={tdSt}>{t.reason ?? '—'}</td>
                      <td style={{ ...tdSt, textAlign: 'center', fontWeight: '700' }}>{days}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pessoal */}
        {type === 'pessoal' && (
          salFiltered.length === 0 ? <div style={{ textAlign: 'center', color: '#94a3b8', padding: '48px' }}>Nenhum registro encontrado.</div> :
          <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>
                <th style={thSt}>Colaborador</th>
                <th style={thSt}>Cargo</th>
                <th style={thSt}>Time</th>
                <th style={thSt}>Vigência</th>
                <th style={{ ...thSt, textAlign: 'right' }}>Salário Base</th>
                <th style={{ ...thSt, textAlign: 'right' }}>Encargos</th>
                <th style={{ ...thSt, textAlign: 'right' }}>Total</th>
              </tr></thead>
              <tbody>
                {salFiltered.map((s: any) => (
                  <tr key={s.id}>
                    <td style={tdSt}><span style={{ fontWeight: '600' }}>{s.collaborator?.name ?? '—'}</span></td>
                    <td style={tdSt}>{s.cargo ?? '—'}</td>
                    <td style={tdSt}><span style={{ padding: '2px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: '600', background: s.tipoTime === 'campo' ? '#e0f2fe' : '#ede9fe', color: s.tipoTime === 'campo' ? '#0369a1' : '#6d28d9' }}>{s.tipoTime === 'campo' ? '🏃 Campo' : '🖥️ Adm.'}</span></td>
                    <td style={tdSt}>{fmt(s.vigenciaInicio)}{s.vigenciaFim ? ` → ${fmt(s.vigenciaFim)}` : ' → atual'}</td>
                    <td style={{ ...tdSt, textAlign: 'right' }}>{curr(s.salarioBase)}</td>
                    <td style={{ ...tdSt, textAlign: 'right' }}>{curr(s.encargos)}</td>
                    <td style={{ ...tdSt, textAlign: 'right', fontWeight: '800', color: '#0f172a' }}>{curr(Number(s.salarioBase) + Number(s.encargos))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

      </div>
    </div>
  )
}

// ── Multi-select dropdown ─────────────────────────────────────────────────────
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
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 199 }}
          onClick={() => setOpen(false)}
        />
      )}
      <button
        onClick={() => setOpen(o => !o)}
        style={{ padding: '9px 14px', borderRadius: '10px', border: '1.5px solid #e2e8f0', fontSize: '14px', background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', minWidth: '160px', justifyContent: 'space-between', position: 'relative', zIndex: 200 }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
        <span style={{ fontSize: '11px', color: '#94a3b8', flexShrink: 0 }}>▾</span>
      </button>
      {open && (
        <div
          style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 200, background: 'white', border: '1.5px solid #e2e8f0', borderRadius: '10px', boxShadow: '0 4px 16px rgba(0,0,0,0.12)', minWidth: '200px', padding: '8px 0 0', maxHeight: '300px', overflowY: 'auto' }}
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

// ── Componentes de apresentação ───────────────────────────────────────────────
function KpiCard({ label, value, sub, icon, color }: { label: string; value: string; sub?: string; icon: string; color?: string }) {
  return (
    <div style={{ background: 'white', borderRadius: '12px', padding: '16px 18px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '1px solid #f1f5f9', display: 'flex', flexDirection: 'column', gap: '6px', minWidth: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', lineHeight: 1.3 }}>{label}</span>
        <span style={{ fontSize: '22px', opacity: 0.75, flexShrink: 0, marginLeft: '8px' }}>{icon}</span>
      </div>
      <div style={{ fontSize: '20px', fontWeight: '800', color: color ?? '#0f172a', lineHeight: 1.2 }}>{value}</div>
      {sub && <div style={{ fontSize: '11px', color: '#94a3b8', lineHeight: 1.3 }}>{sub}</div>}
    </div>
  )
}

function Bar({ label, value, max, color = '#3b82f6', badge }: { label: string; value: number; max: number; color?: string; badge?: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0
  return (
    <div style={{ marginBottom: '12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
          <span style={{ fontSize: '13px', color: '#374151', fontWeight: '500', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
          {badge && <span style={{ fontSize: '11px', fontWeight: '700', background: '#dbeafe', color: '#1e40af', padding: '1px 7px', borderRadius: '20px', flexShrink: 0 }}>{badge}</span>}
        </div>
        <span style={{ fontSize: '13px', fontWeight: '700', color: '#0f172a', flexShrink: 0, marginLeft: '8px' }}>{formatCurrency(value)}</span>
      </div>
      <div style={{ background: '#f1f5f9', borderRadius: '6px', height: '10px' }}>
        <div style={{ background: color, borderRadius: '6px', height: '10px', width: `${pct}%`, transition: 'width 0.5s' }} />
      </div>
    </div>
  )
}

// ── Verifica se uma viagem sobrepõe o mês/ano filtrado ───────────────────────
function tripInPeriod(trip: any, year: number, month: number): boolean {
  if (!trip.startDate) return false
  const s = new Date(trip.startDate)
  const e = trip.endDate ? new Date(trip.endDate) : s
  const periodStart = new Date(year, month - 1, 1)
  const periodEnd = new Date(year, month, 0, 23, 59, 59)
  return s <= periodEnd && e >= periodStart
}

function tripInAnyPeriod(trip: any, periods: string[]): boolean {
  if (periods.length === 0) return false
  return periods.some(pk => {
    const [y, m] = pk.split('-').map(Number)
    return tripInPeriod(trip, y, m)
  })
}

type DetailCard = 'colaborador' | 'centrocusto' | 'pagamento' | 'loja' | 'dias' | 'pessoal'

export default function AuditDashboardPage() {
  const [selectedPeriods, setSelectedPeriods] = useState<string[]>([])
  const [selectedCollabs, setSelectedCollabs] = useState<string[]>([])
  const [filterTipoTime, setFilterTipoTime] = useState<'' | 'campo' | 'administrativo'>('')
  const [detailCard, setDetailCard] = useState<DetailCard | null>(null)

  const { data: availablePeriods } = trpc.auditTrips.listAvailablePeriods.useQuery()

  // Auto-seleciona o período mais recente
  useEffect(() => {
    if (availablePeriods?.length && selectedPeriods.length === 0) {
      setSelectedPeriods([`${availablePeriods[0].year}-${availablePeriods[0].month}`])
    }
  }, [availablePeriods, selectedPeriods.length])

  const periodOptions = useMemo(
    () => (availablePeriods ?? []).map(p => ({ value: `${p.year}-${p.month}`, label: p.label })),
    [availablePeriods]
  )

  const { data: tripsData } = trpc.auditTrips.list.useQuery(
    { pageSize: 500 },
    { enabled: selectedPeriods.length > 0 }
  )
  const { data: collabs } = trpc.auditCollaborators.list.useQuery()
  const { data: expenses } = trpc.auditCost.listExpenses.useQuery({ pageSize: 500 })
  const { data: salariesData } = trpc.auditCollaboratorSalaries.list.useQuery({ pageSize: 500 })

  const collabOptions = useMemo(
    () => ((collabs as any[]) ?? []).map((c: any) => ({ value: c.id, label: c.name })),
    [collabs]
  )

  // IDs de colaboradores do tipo selecionado (pelo registro de salário mais recente)
  const tipoTimeCollabIds = useMemo(() => {
    if (!filterTipoTime) return null
    const { data: sal } = { data: salariesData }
    const items: any[] = sal?.items ?? []
    const latest = new Map<string, string>() // collabId → tipoTime
    const sorted = [...items].filter(s => s.deletedAt == null && s.status === 'ACTIVE')
      .sort((a, b) => new Date(b.vigenciaInicio).getTime() - new Date(a.vigenciaInicio).getTime())
    for (const s of sorted) {
      if (!latest.has(s.collaboratorId)) latest.set(s.collaboratorId, s.tipoTime ?? 'campo')
    }
    return new Set([...latest.entries()].filter(([, t]) => t === filterTipoTime).map(([id]) => id))
  }, [filterTipoTime, salariesData])

  // Filtro efetivo de colaboradores (combina seleção manual + filtro de tipo)
  const effectiveCollabs = useMemo(() => {
    if (!tipoTimeCollabIds) return selectedCollabs
    const tipoArr = [...tipoTimeCollabIds]
    if (selectedCollabs.length === 0) return tipoArr
    return selectedCollabs.filter(id => tipoTimeCollabIds.has(id))
  }, [selectedCollabs, tipoTimeCollabIds])

  // ── Viagens do período (com filtro de colaborador) ───────────────────────────
  const tripsAll = tripsData?.trips ?? []
  const tripsInPeriod = useMemo(() => {
    const byPeriod = tripsAll.filter((t: any) => tripInAnyPeriod(t, selectedPeriods))
    if (effectiveCollabs.length === 0) return byPeriod
    return byPeriod.filter((t: any) => effectiveCollabs.includes(t.collaboratorId))
  }, [tripsAll, selectedPeriods, effectiveCollabs])

  // ── Despesas do período (com filtro de colaborador) ──────────────────────────
  const monthExpenses = useMemo(() => {
    if (!expenses?.expenses || selectedPeriods.length === 0) return []
    return expenses.expenses.filter((e: any) => {
      const d = new Date(e.date)
      const inPeriod = selectedPeriods.some(pk => {
        const [y, m] = pk.split('-').map(Number)
        return d.getFullYear() === y && d.getMonth() + 1 === m
      })
      const inCollab = effectiveCollabs.length === 0 ||
        effectiveCollabs.includes(e.collaboratorId) ||
        effectiveCollabs.includes(e.auditorId)
      return inPeriod && inCollab
    })
  }, [expenses, selectedPeriods, effectiveCollabs])

  // ── KPIs ─────────────────────────────────────────────────────────────────────
  const totalMonthExpenses = useMemo(
    () => monthExpenses.reduce((s: number, e: any) => s + Number(e.value), 0),
    [monthExpenses]
  )

  const totalDaysInTravel = useMemo(() => {
    const uniqueDays = new Set<string>()
    for (const t of tripsInPeriod) {
      if (!t.startDate) continue
      const s = new Date(t.startDate)
      const e = t.endDate ? new Date(t.endDate) : new Date(t.startDate)
      if (isNaN(s.getTime()) || isNaN(e.getTime())) continue
      const cur = new Date(s)
      while (cur <= e) {
        uniqueDays.add(cur.toISOString().slice(0, 10))
        cur.setDate(cur.getDate() + 1)
      }
    }
    return uniqueDays.size
  }, [tripsInPeriod])

  const uniqueCollabsInPeriod = useMemo(() => {
    const ids = new Set<string>()
    for (const e of monthExpenses) { if (e.collaboratorId) ids.add(e.collaboratorId) }
    for (const t of tripsInPeriod) { if (t.collaboratorId) ids.add(t.collaboratorId) }
    return ids.size
  }, [monthExpenses, tripsInPeriod])

  const uniqueStores = useMemo(() => {
    const names = new Set<string>()
    for (const e of monthExpenses) { if (e.storeName) names.add(e.storeName) }
    for (const t of tripsInPeriod) {
      if (t.stores) t.stores.split(',').map((s: string) => s.trim()).filter(Boolean).forEach((s: string) => names.add(s))
    }
    return names.size
  }, [monthExpenses, tripsInPeriod])

  const totalInventories = useMemo(() =>
    tripsInPeriod.reduce((sum: number, t: any) => {
      if (!t.stores) return sum + 1
      const stores = t.stores.split(',').map((s: string) => s.trim()).filter(Boolean)
      return sum + (stores.length || 1)
    }, 0)
  , [tripsInPeriod])

  const avgPerInventory = totalInventories > 0 ? totalMonthExpenses / totalInventories : 0
  const avgPerCollab = uniqueCollabsInPeriod > 0 ? totalMonthExpenses / uniqueCollabsInPeriod : 0

  // ── Custo de pessoal (salários + encargos, 1x por colaborador por mês) ───────
  const allSalaries: any[] = salariesData?.items ?? []
  const personnelCostByCollab = useMemo(() => {
    const result = new Map<string, { name: string; total: number; tipoTime: string }>()
    for (const pk of selectedPeriods) {
      const [y, m] = pk.split('-').map(Number)
      const periodStart = new Date(y, m - 1, 1)
      const periodEnd   = new Date(y, m, 0, 23, 59, 59)
      const seen = new Set<string>()
      const sorted = [...allSalaries]
        .filter(s => s.deletedAt == null && s.status === 'ACTIVE')
        .filter(s => {
          const vi = new Date(s.vigenciaInicio)
          const vf = s.vigenciaFim ? new Date(s.vigenciaFim) : null
          return vi <= periodEnd && (vf == null || vf >= periodStart)
        })
        .sort((a, b) => new Date(b.vigenciaInicio).getTime() - new Date(a.vigenciaInicio).getTime())
      for (const s of sorted) {
        if (seen.has(s.collaboratorId)) continue
        seen.add(s.collaboratorId)
        if (effectiveCollabs.length > 0 && !effectiveCollabs.includes(s.collaboratorId)) continue
        const name = s.collaborator?.name ?? s.collaboratorId.slice(0, 8)
        const cost = Number(s.salarioBase) + Number(s.encargos)
        const tipoTime = s.tipoTime ?? 'campo'
        const prev = result.get(s.collaboratorId) ?? { name, total: 0, tipoTime }
        result.set(s.collaboratorId, { name, total: prev.total + cost, tipoTime })
      }
    }
    return Array.from(result.values()).sort((a, b) => b.total - a.total)
  }, [allSalaries, selectedPeriods, effectiveCollabs])

  const totalPersonnelCost = useMemo(
    () => personnelCostByCollab.reduce((s, c) => s + c.total, 0),
    [personnelCostByCollab]
  )
  const totalCampoCost = useMemo(
    () => personnelCostByCollab.filter(c => c.tipoTime === 'campo').reduce((s, c) => s + c.total, 0),
    [personnelCostByCollab]
  )
  const totalAdmCost = useMemo(
    () => personnelCostByCollab.filter(c => c.tipoTime === 'administrativo').reduce((s, c) => s + c.total, 0),
    [personnelCostByCollab]
  )
  const totalOperationCost = totalMonthExpenses + totalPersonnelCost

  // ── Agrupamentos para gráficos ───────────────────────────────────────────────
  const byCollaborator = useMemo(() => {
    const map = new Map<string, { name: string; total: number; days: number }>()
    for (const e of monthExpenses) {
      const key = e.collaboratorId ?? e.auditorId ?? 'Desconhecido'
      const collab = (collabs as any[])?.find((c: any) => c.id === key)
      const name = collab?.name ?? key.slice(0, 8)
      const prev = map.get(key) ?? { name, total: 0, days: 0 }
      map.set(key, { ...prev, total: prev.total + Number(e.value) })
    }
    const daysPerCollab = new Map<string, Set<string>>()
    for (const t of tripsInPeriod) {
      if (!t.collaboratorId || !t.startDate) continue
      if (!daysPerCollab.has(t.collaboratorId)) daysPerCollab.set(t.collaboratorId, new Set())
      const s = new Date(t.startDate)
      const e = t.endDate ? new Date(t.endDate) : new Date(t.startDate)
      const cur = new Date(s)
      while (cur <= e) {
        daysPerCollab.get(t.collaboratorId)!.add(cur.toISOString().slice(0, 10))
        cur.setDate(cur.getDate() + 1)
      }
    }
    for (const [collabId, daysSet] of daysPerCollab) {
      const prev = map.get(collabId)
      if (prev) map.set(collabId, { ...prev, days: daysSet.size })
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total)
  }, [monthExpenses, tripsInPeriod, collabs])

  const byCostCenter = useMemo(() => {
    const map = new Map<string, number>()
    for (const e of monthExpenses) map.set(e.type, (map.get(e.type) ?? 0) + Number(e.value))
    return Array.from(map.entries()).map(([k, v]) => ({ label: k, value: v })).sort((a, b) => b.value - a.value)
  }, [monthExpenses])

  const byPayment = useMemo(() => {
    const map = new Map<string, number>()
    for (const e of monthExpenses) {
      const k = e.paymentMethod ?? 'Não informado'
      map.set(k, (map.get(k) ?? 0) + Number(e.value))
    }
    return Array.from(map.entries()).map(([k, v]) => ({ label: k, value: v })).sort((a, b) => b.value - a.value)
  }, [monthExpenses])

  const byStore = useMemo(() => {
    const map = new Map<string, { spent: number; inventories: number }>()
    for (const e of monthExpenses) {
      if (!e.storeName) continue
      const prev = map.get(e.storeName) ?? { spent: 0, inventories: 0 }
      map.set(e.storeName, { ...prev, spent: prev.spent + Number(e.value) })
    }
    for (const t of tripsInPeriod) {
      if (!t.stores) continue
      const names = t.stores.split(',').map((s: string) => s.trim()).filter(Boolean)
      for (const sn of names) {
        const prev = map.get(sn) ?? { spent: 0, inventories: 0 }
        map.set(sn, { ...prev, inventories: prev.inventories + 1 })
      }
    }
    return Array.from(map.entries())
      .map(([label, d]) => ({ label, ...d }))
      .sort((a, b) => b.inventories - a.inventories || b.spent - a.spent)
      .slice(0, 10)
  }, [monthExpenses, tripsInPeriod])

  // ── Custo por mês (histórico de todos os períodos disponíveis) ──────────────
  const byMonth = useMemo(() => {
    if (!availablePeriods?.length) return []
    const allExp: any[] = expenses?.expenses ?? []
    return [...availablePeriods]
      .slice()
      .reverse() // ordem cronológica (mais antigo → mais recente)
      .map(p => {
        const periodStart = new Date(p.year, p.month - 1, 1)
        const periodEnd   = new Date(p.year, p.month, 0, 23, 59, 59)

        // despesas de viagem do mês
        const expTotal = allExp
          .filter(e => {
            const d = new Date(e.date)
            return d.getFullYear() === p.year && d.getMonth() + 1 === p.month
          })
          .reduce((s, e) => s + Number(e.value), 0)

        // custo de pessoal do mês (1 registro mais recente por colaborador)
        const seen = new Set<string>()
        let salTotal = 0
        const sorted = [...allSalaries]
          .filter(s => s.deletedAt == null && s.status === 'ACTIVE')
          .filter(s => {
            const vi = new Date(s.vigenciaInicio)
            const vf = s.vigenciaFim ? new Date(s.vigenciaFim) : null
            return vi <= periodEnd && (vf == null || vf >= periodStart)
          })
          .sort((a, b) => new Date(b.vigenciaInicio).getTime() - new Date(a.vigenciaInicio).getTime())
        for (const s of sorted) {
          if (seen.has(s.collaboratorId)) continue
          seen.add(s.collaboratorId)
          salTotal += Number(s.salarioBase) + Number(s.encargos)
        }

        return { label: p.label, expTotal, salTotal, total: expTotal + salTotal }
      })
  }, [availablePeriods, expenses, allSalaries])

  const maxMonthVal = Math.max(...byMonth.map(m => m.total), 1)

  const maxBarVal = Math.max(...byCollaborator.map(c => c.total), 1)
  const maxCcVal = Math.max(...byCostCenter.map(c => c.value), 1)
  const maxPayVal = Math.max(...byPayment.map(c => c.value), 1)
  const maxStoreVal = Math.max(...byStore.map(c => c.spent), 1)

  return (
    <ModulePage
      title="Dashboard de Auditoria"
      description="Visão consolidada de viagens, inventários e despesas da equipe"
    >
      {/* Filtros */}
      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
        <MultiSelectDropdown
          options={periodOptions}
          selected={selectedPeriods}
          onChange={setSelectedPeriods}
          placeholder="Selecionar período"
        />
        <MultiSelectDropdown
          options={collabOptions}
          selected={selectedCollabs}
          onChange={setSelectedCollabs}
          placeholder="Todos os colaboradores"
        />
        <div style={{ display: 'flex', gap: '0', borderRadius: '10px', overflow: 'hidden', border: '1.5px solid #e2e8f0' }}>
          {([
            { value: '', label: 'Todos' },
            { value: 'campo', label: '🏃 Campo' },
            { value: 'administrativo', label: '🖥️ Adm.' },
          ] as const).map(opt => (
            <button
              key={opt.value}
              onClick={() => setFilterTipoTime(opt.value)}
              style={{
                padding: '8px 14px', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: filterTipoTime === opt.value ? '700' : '500',
                background: filterTipoTime === opt.value ? '#2563eb' : 'white',
                color: filterTipoTime === opt.value ? 'white' : '#475569',
                borderRight: opt.value !== 'administrativo' ? '1px solid #e2e8f0' : 'none',
                transition: 'all 0.15s',
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* KPIs — Grupo 1: Custos e Colaboradores */}
      <div>
        <div style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#94a3b8', marginBottom: '8px' }}>
          Custos e Colaboradores
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: '10px' }}>
          <KpiCard icon="🏦" label="Custo Total Operação"      value={formatCurrency(totalOperationCost)} color="#2563eb" />
          <KpiCard icon="💰" label="Despesas de Viagem"        value={formatCurrency(totalMonthExpenses)} />
          <KpiCard icon="👤" label="Custo de Pessoal"          value={formatCurrency(totalPersonnelCost)} sub={`${personnelCostByCollab.length} colaborador(es)`} />
          <KpiCard icon="🏃" label="Time de Campo"             value={formatCurrency(totalCampoCost)} sub={`${personnelCostByCollab.filter(c => c.tipoTime === 'campo').length} colab.`} />
          <KpiCard icon="🖥️" label="Administrativo"            value={formatCurrency(totalAdmCost)} sub={`${personnelCostByCollab.filter(c => c.tipoTime === 'administrativo').length} colab.`} />
          <KpiCard icon="👥" label="Colaboradores"             value={String(uniqueCollabsInPeriod)} sub="no período" />
          <KpiCard icon="🧑" label="Custo Médio / Colaborador" value={formatCurrency(avgPerCollab)} />
        </div>
      </div>

      {/* KPIs — Grupo 2: Inventários e Viagens */}
      <div>
        <div style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#94a3b8', marginBottom: '8px' }}>
          Inventários e Viagens
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: '10px' }}>
          <KpiCard icon="📋" label="Inventários Realizados"   value={String(totalInventories)} sub={`em ${tripsInPeriod.length} viagem(ns)`} />
          <KpiCard icon="📊" label="Custo Médio / Inventário" value={formatCurrency(avgPerInventory)} sub={totalInventories === 0 ? 'sem inventários' : undefined} />
          <KpiCard icon="🏪" label="Lojas Inventariadas"      value={String(uniqueStores)} sub="lojas únicas" />
          <KpiCard icon="📅" label="Dias em Viagem"           value={String(totalDaysInTravel)} sub={`${tripsInPeriod.length} viagem(ns) no período`} />
        </div>
      </div>

      {/* Card Custo por Mês — gráfico de linhas */}
      {byMonth.length > 0 && (() => {
        const W = Math.max(byMonth.length * 110, 400)
        const H = 210
        const PAD = { top: 56, right: 30, bottom: 36, left: 60 }
        const iW = W - PAD.left - PAD.right
        const iH = H - PAD.top - PAD.bottom
        const xStep = byMonth.length > 1 ? iW / (byMonth.length - 1) : iW / 2

        const toY = (v: number) => PAD.top + iH - (v / maxMonthVal) * iH

        const pts = (key: 'total' | 'expTotal' | 'salTotal') =>
          byMonth.map((m, i) => [PAD.left + i * xStep, toY(m[key])] as [number, number])

        const polyline = (key: 'total' | 'expTotal' | 'salTotal') =>
          pts(key).map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')

        const area = (key: 'total' | 'expTotal' | 'salTotal', color: string, stroke: string) => {
          const p = pts(key)
          const areaPath = `M${p[0][0].toFixed(1)},${(PAD.top + iH).toFixed(1)} ` +
            p.map(([x, y]) => `L${x.toFixed(1)},${y.toFixed(1)}`).join(' ') +
            ` L${p[p.length-1][0].toFixed(1)},${(PAD.top + iH).toFixed(1)} Z`
          return (
            <>
              <path d={areaPath} fill={color} opacity={0.12} />
              <polyline points={polyline(key)} fill="none" stroke={stroke} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
              {p.map(([x, y], i) => {
                const isSelected = selectedPeriods.some(pk => {
                  const [yr, mo] = pk.split('-').map(Number)
                  return byMonth[i].label === `${MONTHS[mo - 1]}/${String(yr).slice(2)}`
                })
                return <circle key={i} cx={x} cy={y} r={isSelected ? 5 : 3.5} fill={stroke} stroke="white" strokeWidth="1.5" />
              })}
            </>
          )
        }

        // Y axis labels
        const yTicks = [0, 0.25, 0.5, 0.75, 1].map(f => ({ v: maxMonthVal * f, y: toY(maxMonthVal * f) }))

        // Labels de % e valor real acima de cada ponto do total
        const grandTotal = byMonth.reduce((acc, m) => acc + m.total, 0)
        const totalPts = pts('total')
        const fmtCompact = (v: number) => v >= 1000 ? `R$${(v/1000).toFixed(1)}k` : `R$${v.toFixed(0)}`
        const BOX_W = 62
        const BOX_H = 32

        return (
          <DataCard title="Custo por Mês">
            <div style={{ overflowX: 'auto' }}>
              <svg width={W} height={H} style={{ display: 'block', minWidth: '320px' }}>
                {/* grid lines */}
                {yTicks.map(({ v, y }) => (
                  <g key={v}>
                    <line x1={PAD.left} y1={y} x2={PAD.left + iW} y2={y} stroke="#e2e8f0" strokeWidth="1" strokeDasharray="4 3" />
                    <text x={PAD.left - 6} y={y + 4} textAnchor="end" fontSize="10" fill="#94a3b8">
                      {v >= 1000 ? `${(v/1000).toFixed(0)}k` : v.toFixed(0)}
                    </text>
                  </g>
                ))}
                {/* areas + lines */}
                {area('expTotal', '#3b82f6', '#3b82f6')}
                {area('salTotal', '#8b5cf6', '#8b5cf6')}
                {/* total line + dots */}
                <polyline points={polyline('total')} fill="none" stroke="#0f172a" strokeWidth="2" strokeDasharray="5 3" strokeLinejoin="round" />
                {totalPts.map(([x, y]) => (
                  <circle key={`dot-${x}`} cx={x} cy={y} r={4} fill="#0f172a" stroke="white" strokeWidth="1.5" />
                ))}
                {/* label boxes: % + valor real */}
                {totalPts.map(([x, y], i) => {
                  const pct = grandTotal > 0 ? Math.round((byMonth[i].total / grandTotal) * 100) : 0
                  const valStr = fmtCompact(byMonth[i].total)
                  const bx = Math.max(PAD.left, Math.min(x - BOX_W / 2, PAD.left + iW - BOX_W))
                  const by = Math.max(2, y - BOX_H - 10)
                  return (
                    <g key={`lbl-${i}`}>
                      <line x1={x} y1={by + BOX_H} x2={x} y2={y - 5} stroke="#0f172a" strokeWidth="1" strokeDasharray="2 2" opacity={0.35} />
                      <rect x={bx} y={by} width={BOX_W} height={BOX_H} rx={5} fill="#0f172a" opacity={0.88} />
                      <text x={bx + BOX_W / 2} y={by + 12} textAnchor="middle" fontSize="9" fill="#94a3b8">{pct}% do total</text>
                      <text x={bx + BOX_W / 2} y={by + 25} textAnchor="middle" fontSize="11" fontWeight="800" fill="white">{valStr}</text>
                    </g>
                  )
                })}
                {/* x labels */}
                {byMonth.map((m, i) => {
                  const x = PAD.left + i * xStep
                  const isSelected = selectedPeriods.some(pk => {
                    const [yr, mo] = pk.split('-').map(Number)
                    return m.label === `${MONTHS[mo - 1]}/${String(yr).slice(2)}`
                  })
                  return (
                    <text key={m.label} x={x} y={H - 6} textAnchor="middle" fontSize="11"
                      fill={isSelected ? '#2563eb' : '#64748b'} fontWeight={isSelected ? '700' : '400'}>
                      {m.label}
                    </text>
                  )
                })}
              </svg>
              <div style={{ display: 'flex', gap: '20px', marginTop: '8px', paddingLeft: `${PAD.left}px` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#64748b' }}>
                  <svg width="20" height="4"><line x1="0" y1="2" x2="20" y2="2" stroke="#3b82f6" strokeWidth="2.5" /></svg>
                  Despesas de Viagem
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#64748b' }}>
                  <svg width="20" height="4"><line x1="0" y1="2" x2="20" y2="2" stroke="#8b5cf6" strokeWidth="2.5" /></svg>
                  Custo de Pessoal
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#64748b' }}>
                  <svg width="20" height="4"><line x1="0" y1="2" x2="20" y2="2" stroke="#0f172a" strokeWidth="2" strokeDasharray="5 3" /></svg>
                  Total
                </div>
              </div>
            </div>
          </DataCard>
        )
      })()}

      {detailCard && (
        <DetailView
          type={detailCard}
          onClose={() => setDetailCard(null)}
          expenses={expenses?.expenses ?? []}
          trips={tripsAll}
          salaries={allSalaries}
          collabs={collabs as any[]}
          selectedPeriods={selectedPeriods}
          effectiveCollabs={effectiveCollabs}
        />
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>

        <ClickableCard onClick={() => setDetailCard('colaborador')}>
          <DataCard title="Gastos por Colaborador">
            {!byCollaborator.length
              ? <EmptyState icon="👥" title="Sem dados" description="Nenhuma despesa no período." />
              : byCollaborator.map((c, i) => (
                  <Bar key={c.name} label={c.name} value={c.total} max={maxBarVal}
                    color={BAR_COLORS[i % BAR_COLORS.length]}
                    badge={c.days > 0 ? `${c.days}d` : undefined} />
                ))
            }
          </DataCard>
        </ClickableCard>

        <ClickableCard onClick={() => setDetailCard('centrocusto')}>
          <DataCard title="Gastos por Centro de Custo">
            {!byCostCenter.length
              ? <EmptyState icon="📂" title="Sem dados" description="Nenhuma despesa no período." />
              : byCostCenter.map((c, i) => (
                  <Bar key={c.label} label={c.label} value={c.value} max={maxCcVal} color={BAR_COLORS[i % BAR_COLORS.length]} />
                ))
            }
          </DataCard>
        </ClickableCard>

        <ClickableCard onClick={() => setDetailCard('pagamento')}>
          <DataCard title="Por Forma de Pagamento">
            {!byPayment.length
              ? <EmptyState icon="💳" title="Sem dados" description="Nenhuma despesa no período." />
              : byPayment.map((c, i) => (
                  <Bar key={c.label} label={c.label} value={c.value} max={maxPayVal} color={BAR_COLORS[(i + 2) % BAR_COLORS.length]} />
                ))
            }
          </DataCard>
        </ClickableCard>

        <ClickableCard onClick={() => setDetailCard('loja')}>
          <DataCard title="Gastos e Inventários por Loja (Top 10)">
            {!byStore.length
              ? <EmptyState icon="🏪" title="Sem dados" description="Nenhuma despesa ou visita com loja no período." />
              : (
                <div>
                  {byStore.map((s, i) => (
                    <Bar key={s.label} label={s.label} value={s.spent} max={maxStoreVal}
                      color={BAR_COLORS[(i + 4) % BAR_COLORS.length]}
                      badge={s.inventories > 0 ? `${s.inventories} inv.` : undefined} />
                  ))}
                  <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '8px' }}>Badge azul = quantidade de inventários realizados na loja</div>
                </div>
              )
            }
          </DataCard>
        </ClickableCard>

        <ClickableCard onClick={() => setDetailCard('dias')}>
          <DataCard title="Dias em Viagem por Colaborador">
            {!tripsInPeriod.length
              ? <EmptyState icon="📅" title="Sem viagens" description="Nenhuma viagem no período." />
              : (() => {
                  const daysMap = new Map<string, { name: string; days: number }>()
                  const setsMap = new Map<string, Set<string>>()
                  for (const t of tripsInPeriod) {
                    if (!t.collaboratorId || !t.startDate) continue
                    const collab = (collabs as any[])?.find((c: any) => c.id === t.collaboratorId)
                    const name = collab?.name ?? t.collaboratorId.slice(0, 8)
                    if (!daysMap.has(t.collaboratorId)) { daysMap.set(t.collaboratorId, { name, days: 0 }); setsMap.set(t.collaboratorId, new Set()) }
                    const s = new Date(t.startDate); const e = t.endDate ? new Date(t.endDate) : new Date(t.startDate); const cur = new Date(s)
                    while (cur <= e) { setsMap.get(t.collaboratorId)!.add(cur.toISOString().slice(0, 10)); cur.setDate(cur.getDate() + 1) }
                  }
                  for (const [id, set] of setsMap) { const prev = daysMap.get(id)!; daysMap.set(id, { ...prev, days: set.size }) }
                  const rows = Array.from(daysMap.values()).sort((a, b) => b.days - a.days)
                  const maxDays = Math.max(...rows.map(r => r.days), 1)
                  return rows.map((r, i) => (
                    <div key={r.name} style={{ marginBottom: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                        <span style={{ fontSize: '13px', color: '#374151', fontWeight: '500' }}>{r.name}</span>
                        <span style={{ fontSize: '13px', fontWeight: '700', color: '#0f172a' }}>{r.days} dia{r.days !== 1 ? 's' : ''}</span>
                      </div>
                      <div style={{ background: '#f1f5f9', borderRadius: '6px', height: '10px' }}>
                        <div style={{ background: BAR_COLORS[i % BAR_COLORS.length], borderRadius: '6px', height: '10px', width: `${(r.days / maxDays) * 100}%`, transition: 'width 0.5s' }} />
                      </div>
                    </div>
                  ))
                })()
            }
          </DataCard>
        </ClickableCard>

        <ClickableCard onClick={() => setDetailCard('pessoal')}>
          <DataCard title="Custo de Pessoal por Colaborador">
            {personnelCostByCollab.length === 0 ? (
              <EmptyState icon="👤" title="Sem dados" description="Nenhum salário ativo no período." />
            ) : (() => {
                const maxPerson = Math.max(...personnelCostByCollab.map(c => c.total), 1)
                const campo = personnelCostByCollab.filter(c => c.tipoTime === 'campo')
                const adm   = personnelCostByCollab.filter(c => c.tipoTime === 'administrativo')
                return (
                  <>
                    {campo.length > 0 && (<>
                      <div style={{ fontSize: '11px', fontWeight: '700', color: '#0284c7', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px', marginTop: '4px' }}>🏃 Time de Campo</div>
                      {campo.map(c => <Bar key={c.name} label={c.name} value={c.total} max={maxPerson} color="#0ea5e9" />)}
                    </>)}
                    {adm.length > 0 && (<>
                      <div style={{ fontSize: '11px', fontWeight: '700', color: '#7c3aed', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px', marginTop: campo.length > 0 ? '14px' : '4px' }}>🖥️ Administrativo</div>
                      {adm.map(c => <Bar key={c.name} label={c.name} value={c.total} max={maxPerson} color="#8b5cf6" />)}
                    </>)}
                  </>
                )
              })()
            }
          </DataCard>
        </ClickableCard>

      </div>
    </ModulePage>
  )
}
