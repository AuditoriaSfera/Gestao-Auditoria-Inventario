'use client'

export const dynamic = 'force-dynamic'

import { useState, useMemo } from 'react'
import { trpc } from '@/lib/trpc'
import { ModulePage, DataCard, EmptyState, LoadingState } from '@/components/shared/module-page'
import { formatCurrency } from '@/lib/utils'

const MONTHS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']

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

function Bar({ label, value, max, color = '#3b82f6' }: { label: string; value: number; max: number; color?: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0
  return (
    <div style={{ marginBottom: '12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
        <span style={{ fontSize: '13px', color: '#374151', fontWeight: '500' }}>{label}</span>
        <span style={{ fontSize: '13px', fontWeight: '700', color: '#0f172a' }}>{formatCurrency(value)}</span>
      </div>
      <div style={{ background: '#f1f5f9', borderRadius: '6px', height: '10px' }}>
        <div style={{ background: color, borderRadius: '6px', height: '10px', width: `${pct}%`, transition: 'width 0.5s' }} />
      </div>
    </div>
  )
}

export default function AuditDashboardPage() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [filterCollab, setFilterCollab] = useState('')

  const { data: panel, isLoading: panelLoading } = trpc.auditCost.monthlyPanel.useQuery({ year, month, auditorId: filterCollab || undefined })
  const { data: trips } = trpc.auditTrips.list.useQuery({ pageSize: 100, collaboratorId: filterCollab || undefined })
  const { data: collabs } = trpc.auditCollaborators.list.useQuery()
  const { data: formLinks } = trpc.auditForms.listLinks.useQuery()
  const { data: expenses } = trpc.auditCost.listExpenses.useQuery({ pageSize: 200 })

  const monthExpenses = useMemo(() => {
    if (!expenses?.expenses) return []
    return expenses.expenses.filter((e: any) => {
      const d = new Date(e.date)
      return d.getFullYear() === year && d.getMonth() + 1 === month
    })
  }, [expenses, year, month])

  // Agrupamentos
  const byCollaborator = useMemo(() => {
    const map = new Map<string, { name: string; total: number }>()
    for (const e of monthExpenses) {
      const key = e.collaboratorId ?? e.auditorId ?? 'Desconhecido'
      const collab = (collabs as any[])?.find((c: any) => c.id === key)
      const name = collab?.name ?? e.auditorId?.slice(0, 8) ?? 'Desconhecido'
      const prev = map.get(key) ?? { name, total: 0 }
      map.set(key, { name, total: prev.total + Number(e.value) })
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total)
  }, [monthExpenses, collabs])

  const byCostCenter = useMemo(() => {
    const map = new Map<string, number>()
    for (const e of monthExpenses) {
      map.set(e.type, (map.get(e.type) ?? 0) + Number(e.value))
    }
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
    const map = new Map<string, number>()
    for (const e of monthExpenses) {
      const k = e.storeName ?? 'Não informado'
      map.set(k, (map.get(k) ?? 0) + Number(e.value))
    }
    return Array.from(map.entries()).map(([k, v]) => ({ label: k, value: v })).sort((a, b) => b.value - a.value).slice(0, 10)
  }, [monthExpenses])

  const tripsAll = trips?.trips ?? []
  const totalReleased = tripsAll.reduce((s: number, t: any) => s + Number(t.releasedAmount), 0)
  const totalSpent = tripsAll.reduce((s: number, t: any) => s + Number(t.spentAmount ?? 0), 0)
  const totalBalance = totalReleased - totalSpent

  const formsSent = (formLinks as any[])?.length ?? 0
  const formsAnswered = (formLinks as any[])?.filter((l: any) => l.status === 'ANSWERED').length ?? 0

  const totalMonthExpenses = monthExpenses.reduce((s: number, e: any) => s + Number(e.value), 0)
  const avgPerTrip = tripsAll.length > 0 ? totalSpent / tripsAll.length : 0
  const avgPerCollab = byCollaborator.length > 0 ? totalMonthExpenses / byCollaborator.length : 0
  const uniqueStores = new Set(monthExpenses.map((e: any) => e.storeName).filter(Boolean)).size
  const maxBarVal = Math.max(...byCollaborator.map(c => c.total), 1)
  const maxCcVal = Math.max(...byCostCenter.map(c => c.value), 1)
  const maxPayVal = Math.max(...byPayment.map(c => c.value), 1)
  const maxStoreVal = Math.max(...byStore.map(c => c.value), 1)

  const BAR_COLORS = ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#f97316','#84cc16']

  return (
    <ModulePage
      title="Dashboard de Auditoria"
      description="Visão consolidada de viagens, despesas, formulários e orçamento da equipe"
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

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '12px' }}>
        <KpiCard icon="💰" label="Total do Mês" value={formatCurrency(totalMonthExpenses)} />
        <KpiCard icon="✈️" label="Total de Viagens" value={String(tripsAll.length)} />
        <KpiCard icon="👥" label="Colaboradores" value={String(byCollaborator.length)} />
        <KpiCard icon="🟢" label="Total Liberado" value={formatCurrency(totalReleased)} />
        <KpiCard icon="💳" label="Total Gasto" value={formatCurrency(totalSpent)} color={totalSpent > totalReleased ? '#dc2626' : '#0f172a'} />
        <KpiCard icon="💵" label="Saldo Disponível" value={formatCurrency(totalBalance)} color={totalBalance < 0 ? '#dc2626' : '#16a34a'} />
        <KpiCard icon="📋" label="Formulários Enviados" value={String(formsSent)} sub={`${formsAnswered} respondidos`} />
        <KpiCard icon="🏪" label="Lojas Inventariadas" value={String(uniqueStores)} sub="no período" />
        <KpiCard icon="📊" label="Custo Médio / Viagem" value={formatCurrency(avgPerTrip)} />
        <KpiCard icon="🧑" label="Custo Médio / Colaborador" value={formatCurrency(avgPerCollab)} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '16px' }}>
        {/* Por Colaborador */}
        <DataCard title="Gastos por Colaborador">
          {!byCollaborator.length ? <EmptyState icon="👥" title="Sem dados" description="Nenhuma despesa no período." /> : (
            byCollaborator.map((c, i) => <Bar key={c.name} label={c.name} value={c.total} max={maxBarVal} color={BAR_COLORS[i % BAR_COLORS.length]} />)
          )}
        </DataCard>

        {/* Por Centro de Custo */}
        <DataCard title="Gastos por Centro de Custo">
          {!byCostCenter.length ? <EmptyState icon="📂" title="Sem dados" description="Nenhuma despesa no período." /> : (
            byCostCenter.map((c, i) => <Bar key={c.label} label={c.label} value={c.value} max={maxCcVal} color={BAR_COLORS[i % BAR_COLORS.length]} />)
          )}
        </DataCard>

        {/* Por Forma de Pagamento */}
        <DataCard title="Por Forma de Pagamento">
          {!byPayment.length ? <EmptyState icon="💳" title="Sem dados" description="Nenhuma despesa no período." /> : (
            byPayment.map((c, i) => <Bar key={c.label} label={c.label} value={c.value} max={maxPayVal} color={BAR_COLORS[(i + 2) % BAR_COLORS.length]} />)
          )}
        </DataCard>

        {/* Por Loja */}
        <DataCard title="Gastos por Loja (Top 10)">
          {!byStore.length ? <EmptyState icon="🏪" title="Sem dados" description="Nenhuma despesa com loja no período." /> : (
            byStore.map((c, i) => <Bar key={c.label} label={c.label} value={c.value} max={maxStoreVal} color={BAR_COLORS[(i + 4) % BAR_COLORS.length]} />)
          )}
        </DataCard>

        {/* Liberado vs Gasto por colaborador */}
        <DataCard title="Orçamento: Liberado vs Gasto">
          {!tripsAll.length ? <EmptyState icon="📉" title="Sem viagens" description="Cadastre viagens para ver o orçamento." /> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {tripsAll.slice(0, 8).map((t: any) => {
                const pct = t.releasedAmount > 0 ? Math.min(100, (t.spentAmount / t.releasedAmount) * 100) : 0
                const over = t.spentAmount > t.releasedAmount
                return (
                  <div key={t.id}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ fontSize: '13px', fontWeight: '500', color: '#374151' }}>{t.collaborator?.name ?? '—'}</span>
                      <span style={{ fontSize: '12px', color: over ? '#dc2626' : '#16a34a', fontWeight: '700' }}>
                        {formatCurrency(t.spentAmount)} / {formatCurrency(t.releasedAmount)}
                      </span>
                    </div>
                    <div style={{ background: '#f1f5f9', borderRadius: '6px', height: '8px' }}>
                      <div style={{ background: over ? '#ef4444' : pct > 80 ? '#f59e0b' : '#22c55e', borderRadius: '6px', height: '8px', width: `${Math.min(100, pct)}%` }} />
                    </div>
                    <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>{t.reason} {t.city ? `· ${t.city}` : ''}</div>
                  </div>
                )
              })}
            </div>
          )}
        </DataCard>

        {/* Status dos formulários */}
        <DataCard title="Status dos Formulários">
          {!formLinks?.length ? <EmptyState icon="📋" title="Sem formulários" description="Nenhum link gerado ainda." /> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {[
                { label: 'Não enviado', key: 'NOT_SENT', color: '#f59e0b', bg: '#fef3c7' },
                { label: 'Enviado', key: 'SENT', color: '#3b82f6', bg: '#dbeafe' },
                { label: 'Visualizado', key: 'VIEWED', color: '#8b5cf6', bg: '#ede9fe' },
                { label: 'Respondido', key: 'ANSWERED', color: '#22c55e', bg: '#dcfce7' },
              ].map(s => {
                const count = (formLinks as any[]).filter((l: any) => l.status === s.key).length
                return (
                  <div key={s.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', borderRadius: '8px', background: s.bg }}>
                    <span style={{ fontSize: '13px', fontWeight: '600', color: s.color }}>{s.label}</span>
                    <span style={{ fontSize: '18px', fontWeight: '800', color: s.color }}>{count}</span>
                  </div>
                )
              })}
            </div>
          )}
        </DataCard>
      </div>
    </ModulePage>
  )
}
