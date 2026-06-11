'use client'

export const dynamic = 'force-dynamic'

import { useState, useMemo } from 'react'
import { trpc } from '@/lib/trpc'
import { ModulePage, DataCard, EmptyState } from '@/components/shared/module-page'
import { formatCurrency } from '@/lib/utils'

const MONTHS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
const BAR_COLORS = ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#f97316','#84cc16']

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

// ── Cálculo de dias num intervalo (inclusive em ambas as pontas) ──────────────
function calcTripDays(startDate: any, endDate: any): number {
  if (!startDate || !endDate) return 1
  const s = new Date(startDate)
  const e = new Date(endDate)
  if (isNaN(s.getTime()) || isNaN(e.getTime())) return 1
  const days = Math.round((e.getTime() - s.getTime()) / 86400000) + 1
  return Math.max(1, days)
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

export default function AuditDashboardPage() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [filterCollab, setFilterCollab] = useState('')

  // Queries — trips com pageSize alto para cálculos client-side
  const { data: tripsData } = trpc.auditTrips.list.useQuery({ pageSize: 500, collaboratorId: filterCollab || undefined })
  const { data: collabs } = trpc.auditCollaborators.list.useQuery()
  const { data: expenses } = trpc.auditCost.listExpenses.useQuery({ pageSize: 500 })

  // ── Viagens do período ───────────────────────────────────────────────────────
  const tripsAll = tripsData?.trips ?? []
  const tripsInPeriod = useMemo(
    () => tripsAll.filter((t: any) => tripInPeriod(t, year, month)),
    [tripsAll, year, month]
  )

  // ── Despesas do período ──────────────────────────────────────────────────────
  const monthExpenses = useMemo(() => {
    if (!expenses?.expenses) return []
    return expenses.expenses.filter((e: any) => {
      const d = new Date(e.date)
      return d.getFullYear() === year && d.getMonth() + 1 === month &&
        (!filterCollab || e.collaboratorId === filterCollab || e.auditorId === filterCollab)
    })
  }, [expenses, year, month, filterCollab])

  // ── KPIs principais ──────────────────────────────────────────────────────────
  const totalMonthExpenses = useMemo(
    () => monthExpenses.reduce((s: number, e: any) => s + Number(e.value), 0),
    [monthExpenses]
  )

  // Dias em viagem: soma dos dias de cada viagem no período
  const totalDaysInTravel = useMemo(
    () => tripsInPeriod.reduce((s: number, t: any) => s + calcTripDays(t.startDate, t.endDate), 0),
    [tripsInPeriod]
  )

  // Total liberado e colaboradores únicos
  const totalReleased = useMemo(
    () => tripsInPeriod.reduce((s: number, t: any) => s + Number(t.releasedAmount ?? 0), 0),
    [tripsInPeriod]
  )

  // Colaboradores com despesas no período
  const uniqueCollabsInPeriod = useMemo(() => {
    const ids = new Set<string>()
    for (const e of monthExpenses) { if (e.collaboratorId) ids.add(e.collaboratorId) }
    for (const t of tripsInPeriod) { if (t.collaboratorId) ids.add(t.collaboratorId) }
    return ids.size
  }, [monthExpenses, tripsInPeriod])

  // Lojas únicas inventariadas (pela store nas despesas + nas viagens)
  const uniqueStores = useMemo(() => {
    const names = new Set<string>()
    for (const e of monthExpenses) { if (e.storeName) names.add(e.storeName) }
    for (const t of tripsInPeriod) {
      if (t.stores) t.stores.split(',').map((s: string) => s.trim()).filter(Boolean).forEach((s: string) => names.add(s))
    }
    return names.size
  }, [monthExpenses, tripsInPeriod])

  // Total de inventários = total de viagens no período (cada viagem = 1 inventário)
  const totalInventories = tripsInPeriod.length

  // Custo médio por inventário
  const avgPerInventory = totalInventories > 0 ? totalMonthExpenses / totalInventories : 0

  // Custo médio por colaborador ativo no período
  const avgPerCollab = uniqueCollabsInPeriod > 0 ? totalMonthExpenses / uniqueCollabsInPeriod : 0

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
    // Acumula dias por colaborador
    for (const t of tripsInPeriod) {
      if (t.collaboratorId) {
        const prev = map.get(t.collaboratorId)
        if (prev) map.set(t.collaboratorId, { ...prev, days: prev.days + calcTripDays(t.startDate, t.endDate) })
      }
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

  // Por loja: gasto + contagem de inventários (viagens que passaram pela loja)
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
        <select value={month} onChange={e => setMonth(Number(e.target.value))}
          style={{ padding: '9px 14px', borderRadius: '10px', border: '1.5px solid #e2e8f0', fontSize: '14px' }}>
          {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
        </select>
        <select value={year} onChange={e => setYear(Number(e.target.value))}
          style={{ padding: '9px 14px', borderRadius: '10px', border: '1.5px solid #e2e8f0', fontSize: '14px' }}>
          {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <select value={filterCollab} onChange={e => setFilterCollab(e.target.value)}
          style={{ padding: '9px 14px', borderRadius: '10px', border: '1.5px solid #e2e8f0', fontSize: '14px', minWidth: '180px' }}>
          <option value="">Todos os colaboradores</option>
          {((collabs as any[]) ?? []).map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {/* KPIs — 8 cards, 4 por linha em telas largas */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '12px' }}>
        <KpiCard icon="💰" label="Total do Mês"           value={formatCurrency(totalMonthExpenses)} />
        <KpiCard icon="📅" label="Dias em Viagem"         value={String(totalDaysInTravel)} sub={`${tripsInPeriod.length} viagem(ns) no período`} />
        <KpiCard icon="👥" label="Colaboradores"          value={String(uniqueCollabsInPeriod)} sub="no período" />
        <KpiCard icon="🟢" label="Total Liberado"         value={formatCurrency(totalReleased)} />
        <KpiCard icon="🏪" label="Lojas Inventariadas"    value={String(uniqueStores)} sub="lojas únicas" />
        <KpiCard icon="📋" label="Inventários Realizados" value={String(totalInventories)} sub="viagens no período" />
        <KpiCard icon="📊" label="Custo Médio / Inventário" value={formatCurrency(avgPerInventory)} sub={totalInventories === 0 ? 'sem inventários' : undefined} />
        <KpiCard icon="🧑" label="Custo Médio / Colaborador" value={formatCurrency(avgPerCollab)} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '16px' }}>

        {/* Gastos por Colaborador (com dias em viagem) */}
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

        {/* Gastos por Centro de Custo */}
        <DataCard title="Gastos por Centro de Custo">
          {!byCostCenter.length
            ? <EmptyState icon="📂" title="Sem dados" description="Nenhuma despesa no período." />
            : byCostCenter.map((c, i) => (
                <Bar key={c.label} label={c.label} value={c.value} max={maxCcVal} color={BAR_COLORS[i % BAR_COLORS.length]} />
              ))
          }
        </DataCard>

        {/* Por Forma de Pagamento */}
        <DataCard title="Por Forma de Pagamento">
          {!byPayment.length
            ? <EmptyState icon="💳" title="Sem dados" description="Nenhuma despesa no período." />
            : byPayment.map((c, i) => (
                <Bar key={c.label} label={c.label} value={c.value} max={maxPayVal} color={BAR_COLORS[(i + 2) % BAR_COLORS.length]} />
              ))
          }
        </DataCard>

        {/* Lojas: gasto + inventários */}
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

        {/* Orçamento por viagem */}
        <DataCard title="Orçamento: Liberado vs Gasto por Viagem">
          {!tripsInPeriod.length
            ? <EmptyState icon="📉" title="Sem viagens" description="Nenhuma viagem no período selecionado." />
            : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {tripsInPeriod.slice(0, 8).map((t: any) => {
                  const spent = Number(t.spentAmount ?? 0)
                  const released = Number(t.releasedAmount ?? 0)
                  const pct = released > 0 ? Math.min(100, (spent / released) * 100) : 0
                  const over = spent > released
                  const days = calcTripDays(t.startDate, t.endDate)
                  return (
                    <div key={t.id}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontSize: '13px', fontWeight: '600', color: '#374151' }}>{t.collaborator?.name ?? '—'}</span>
                          <span style={{ fontSize: '11px', color: '#64748b', background: '#f1f5f9', padding: '1px 6px', borderRadius: '10px' }}>{days}d</span>
                        </div>
                        <span style={{ fontSize: '12px', color: over ? '#dc2626' : '#16a34a', fontWeight: '700' }}>
                          {formatCurrency(spent)} / {formatCurrency(released)}
                        </span>
                      </div>
                      <div style={{ background: '#f1f5f9', borderRadius: '6px', height: '8px' }}>
                        <div style={{ background: over ? '#ef4444' : pct > 80 ? '#f59e0b' : '#22c55e', borderRadius: '6px', height: '8px', width: `${Math.min(100, pct)}%` }} />
                      </div>
                      <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
                        {t.reason && <span>{t.reason}</span>}
                        {t.stores && <span> · {t.stores}</span>}
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          }
        </DataCard>

        {/* Dias em viagem por colaborador */}
        <DataCard title="Dias em Viagem por Colaborador">
          {!tripsInPeriod.length
            ? <EmptyState icon="📅" title="Sem viagens" description="Nenhuma viagem no período." />
            : (() => {
                const daysMap = new Map<string, { name: string; days: number }>()
                for (const t of tripsInPeriod) {
                  if (!t.collaboratorId) continue
                  const collab = (collabs as any[])?.find((c: any) => c.id === t.collaboratorId)
                  const name = collab?.name ?? t.collaboratorId.slice(0, 8)
                  const prev = daysMap.get(t.collaboratorId) ?? { name, days: 0 }
                  daysMap.set(t.collaboratorId, { ...prev, days: prev.days + calcTripDays(t.startDate, t.endDate) })
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

      </div>
    </ModulePage>
  )
}
