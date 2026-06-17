'use client'

export const dynamic = 'force-dynamic'

import { useState, useMemo, useEffect } from 'react'
import { trpc } from '@/lib/trpc'
import { ModulePage, DataCard, EmptyState } from '@/components/shared/module-page'
import { formatCurrency } from '@/lib/utils'

const MONTHS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
const BAR_COLORS = ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#f97316','#84cc16']

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
    <div style={{ background: 'white', borderRadius: '14px', padding: '18px 20px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '1px solid #f1f5f9' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: '12px', color: '#94a3b8', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>{label}</div>
          <div style={{ fontSize: '22px', fontWeight: '800', color: color ?? '#0f172a' }}>{value}</div>
          {sub && <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>{sub}</div>}
        </div>
        <span style={{ fontSize: '26px', opacity: 0.8 }}>{icon}</span>
      </div>
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

export default function AuditDashboardPage() {
  const [selectedPeriods, setSelectedPeriods] = useState<string[]>([])
  const [selectedCollabs, setSelectedCollabs] = useState<string[]>([])
  const [filterTipoTime, setFilterTipoTime] = useState<'' | 'campo' | 'administrativo'>('')

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

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '12px' }}>
        <KpiCard icon="🏦" label="Custo Total Operação"      value={formatCurrency(totalOperationCost)} color="#2563eb" />
        <KpiCard icon="💰" label="Despesas de Viagem"        value={formatCurrency(totalMonthExpenses)} />
        <KpiCard icon="👤" label="Custo de Pessoal"          value={formatCurrency(totalPersonnelCost)} sub={`${personnelCostByCollab.length} colaborador(es)`} />
        <KpiCard icon="🏃" label="Time de Campo"             value={formatCurrency(totalCampoCost)} sub={`${personnelCostByCollab.filter(c => c.tipoTime === 'campo').length} colab.`} />
        <KpiCard icon="🖥️" label="Administrativo"            value={formatCurrency(totalAdmCost)} sub={`${personnelCostByCollab.filter(c => c.tipoTime === 'administrativo').length} colab.`} />
        <KpiCard icon="📅" label="Dias em Viagem"            value={String(totalDaysInTravel)} sub={`${tripsInPeriod.length} viagem(ns) no período`} />
        <KpiCard icon="👥" label="Colaboradores"             value={String(uniqueCollabsInPeriod)} sub="no período" />
        <KpiCard icon="🏪" label="Lojas Inventariadas"       value={String(uniqueStores)} sub="lojas únicas" />
        <KpiCard icon="📋" label="Inventários Realizados"    value={String(totalInventories)} sub={`em ${tripsInPeriod.length} viagem(ns)`} />
        <KpiCard icon="📊" label="Custo Médio / Inventário"  value={formatCurrency(avgPerInventory)} sub={totalInventories === 0 ? 'sem inventários' : undefined} />
        <KpiCard icon="🧑" label="Custo Médio / Colaborador" value={formatCurrency(avgPerCollab)} />
      </div>

      {/* Card Custo por Mês — gráfico de linhas */}
      {byMonth.length > 0 && (() => {
        const W = Math.max(byMonth.length * 90, 400)
        const H = 160
        const PAD = { top: 20, right: 24, bottom: 36, left: 60 }
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
                {/* total line */}
                <polyline points={polyline('total')} fill="none" stroke="#0f172a" strokeWidth="2" strokeDasharray="5 3" strokeLinejoin="round" />
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

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '16px' }}>

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

        <DataCard title="Gastos por Centro de Custo">
          {!byCostCenter.length
            ? <EmptyState icon="📂" title="Sem dados" description="Nenhuma despesa no período." />
            : byCostCenter.map((c, i) => (
                <Bar key={c.label} label={c.label} value={c.value} max={maxCcVal} color={BAR_COLORS[i % BAR_COLORS.length]} />
              ))
          }
        </DataCard>

        <DataCard title="Por Forma de Pagamento">
          {!byPayment.length
            ? <EmptyState icon="💳" title="Sem dados" description="Nenhuma despesa no período." />
            : byPayment.map((c, i) => (
                <Bar key={c.label} label={c.label} value={c.value} max={maxPayVal} color={BAR_COLORS[(i + 2) % BAR_COLORS.length]} />
              ))
          }
        </DataCard>

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
                <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '8px' }}>
                  Badge azul = quantidade de inventários realizados na loja
                </div>
              </div>
            )
          }
        </DataCard>

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
                  const s = new Date(t.startDate)
                  const e = t.endDate ? new Date(t.endDate) : new Date(t.startDate)
                  const cur = new Date(s)
                  while (cur <= e) { setsMap.get(t.collaboratorId)!.add(cur.toISOString().slice(0, 10)); cur.setDate(cur.getDate() + 1) }
                }
                for (const [id, set] of setsMap) {
                  const prev = daysMap.get(id)!
                  daysMap.set(id, { ...prev, days: set.size })
                }
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

        <DataCard title="Custo de Pessoal por Colaborador">
          {personnelCostByCollab.length === 0 ? (
            <EmptyState icon="👤" title="Sem dados" description="Nenhum salário ativo no período." />
          ) : (() => {
              const maxPerson = Math.max(...personnelCostByCollab.map(c => c.total), 1)
              const campo = personnelCostByCollab.filter(c => c.tipoTime === 'campo')
              const adm   = personnelCostByCollab.filter(c => c.tipoTime === 'administrativo')
              return (
                <>
                  {campo.length > 0 && (
                    <>
                      <div style={{ fontSize: '11px', fontWeight: '700', color: '#0284c7', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px', marginTop: '4px' }}>🏃 Time de Campo</div>
                      {campo.map(c => <Bar key={c.name} label={c.name} value={c.total} max={maxPerson} color="#0ea5e9" />)}
                    </>
                  )}
                  {adm.length > 0 && (
                    <>
                      <div style={{ fontSize: '11px', fontWeight: '700', color: '#7c3aed', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px', marginTop: campo.length > 0 ? '14px' : '4px' }}>🖥️ Administrativo</div>
                      {adm.map(c => <Bar key={c.name} label={c.name} value={c.total} max={maxPerson} color="#8b5cf6" />)}
                    </>
                  )}
                </>
              )
            })()
          }
        </DataCard>

      </div>
    </ModulePage>
  )
}
