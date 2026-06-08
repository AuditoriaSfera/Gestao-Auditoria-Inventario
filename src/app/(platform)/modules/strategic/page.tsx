'use client'

export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { trpc } from '@/lib/trpc'
import { ModulePage, DataCard, EmptyState, LoadingState } from '@/components/shared/module-page'
import { formatCurrency, formatNumber, formatDate } from '@/lib/utils'
import { startOfMonth, subMonths } from 'date-fns'

export default function StrategicPage() {
  const now = new Date()
  const [startDate, setStartDate] = useState(startOfMonth(now))
  const [endDate, setEndDate] = useState(now)

  const { data: summary, isLoading } = trpc.strategic.executiveSummary.useQuery({ startDate, endDate })
  const { data: ranking, isLoading: rankLoading } = trpc.strategic.storeRanking.useQuery({ startDate, endDate, limit: 10 })

  const metrics = summary ? [
    { label: 'Perda em Inventário', value: formatCurrency(summary.totalInventoryLoss), color: '#dc2626', icon: '📦', sub: `${summary.inventoriesCount} inventários finalizados` },
    { label: 'Perda em Baixas', value: formatCurrency(summary.totalWriteOffLoss), color: '#ea580c', icon: '📉', sub: 'no período' },
    { label: 'Perda Total Estimada', value: formatCurrency(summary.totalLoss), color: '#7c3aed', icon: '💰', sub: 'inventário + baixas' },
    { label: 'Pendências Abertas', value: summary.pendingCount, color: summary.pendingCount > 0 ? '#d97706' : '#16a34a', icon: '⚠️', sub: '' },
    { label: 'Rondas Concluídas', value: summary.auditRoundsCompleted, color: '#2563eb', icon: '🔍', sub: 'no período' },
    { label: 'Notas Atrasadas', value: summary.noteTransitsLate, color: summary.noteTransitsLate > 0 ? '#dc2626' : '#16a34a', icon: '🚚', sub: 'pendentes de recebimento' },
    { label: 'Patrimônio Divergente', value: summary.assetsDivergent, color: summary.assetsDivergent > 0 ? '#dc2626' : '#16a34a', icon: '🏷️', sub: 'ativos extraviados ou divergentes' },
  ] : []

  return (
    <ModulePage
      title="Indicadores Estratégicos"
      description="Consolidação executiva de todos os módulos operacionais da plataforma"
    >
      {/* Filtro de período */}
      <div style={{ display: 'flex', gap: '16px', alignItems: 'center', background: 'white', padding: '16px 20px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
        <span style={{ fontSize: '14px', fontWeight: '600', color: '#374151' }}>Período:</span>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <label style={{ fontSize: '13px', color: '#64748b' }}>De</label>
          <input type="date" value={startDate.toISOString().split('T')[0]}
            onChange={e => setStartDate(new Date(e.target.value))}
            style={{ padding: '6px 10px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '13px' }} />
          <label style={{ fontSize: '13px', color: '#64748b' }}>Até</label>
          <input type="date" value={endDate.toISOString().split('T')[0]}
            onChange={e => setEndDate(new Date(e.target.value))}
            style={{ padding: '6px 10px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '13px' }} />
        </div>
        {[
          { label: 'Este mês', start: startOfMonth(now), end: now },
          { label: 'Mês anterior', start: startOfMonth(subMonths(now, 1)), end: startOfMonth(now) },
          { label: 'Últimos 3 meses', start: startOfMonth(subMonths(now, 3)), end: now },
        ].map(p => (
          <button key={p.label} onClick={() => { setStartDate(p.start); setEndDate(p.end) }}
            style={{ padding: '6px 14px', borderRadius: '8px', border: '1px solid #d1d5db', background: 'white', fontSize: '13px', cursor: 'pointer', color: '#374151' }}>
            {p.label}
          </button>
        ))}
      </div>

      {/* KPIs */}
      {isLoading ? <LoadingState /> : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
          {metrics.map((m, i) => (
            <div key={i} style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <div style={{ fontSize: '24px', marginBottom: '8px' }}>{m.icon}</div>
              <div style={{ fontSize: '13px', color: '#64748b', marginBottom: '4px' }}>{m.label}</div>
              <div style={{ fontSize: '24px', fontWeight: '700', color: m.color }}>{m.value}</div>
              {m.sub && <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>{m.sub}</div>}
            </div>
          ))}
        </div>
      )}

      {/* Ranking de Lojas */}
      <DataCard title="Ranking de Lojas — Maior Perda em Inventário">
        {rankLoading ? <LoadingState /> : !ranking?.length ? (
          <EmptyState icon="🏆" title="Sem dados de ranking" description="Finalize inventários para gerar o ranking de lojas." />
        ) : (
          <div>
            {ranking.map((store: any, i: number) => {
              const maxLoss = Number(ranking[0]?.totalLoss || 1)
              const pct = (Number(store.totalLoss) / maxLoss * 100).toFixed(0)
              return (
                <div key={store.storeId} style={{ marginBottom: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ width: '24px', height: '24px', borderRadius: '50%', background: i < 3 ? '#fee2e2' : '#f1f5f9', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: '700', color: i < 3 ? '#dc2626' : '#64748b' }}>{i + 1}</span>
                      <div>
                        <span style={{ fontWeight: '600', fontSize: '14px', color: '#0f172a' }}>{store.storeName}</span>
                        <span style={{ fontSize: '12px', color: '#94a3b8', marginLeft: '8px' }}>{store.storeCode} · {store.region}</span>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: '700', color: '#dc2626', fontSize: '15px' }}>{formatCurrency(Number(store.totalLoss))}</div>
                      <div style={{ fontSize: '11px', color: '#94a3b8' }}>{store.inventoryCount} inventário(s)</div>
                    </div>
                  </div>
                  <div style={{ background: '#f1f5f9', borderRadius: '4px', height: '6px' }}>
                    <div style={{ background: i < 3 ? '#dc2626' : '#3b82f6', borderRadius: '4px', height: '6px', width: `${pct}%`, transition: 'width 0.5s' }} />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </DataCard>
    </ModulePage>
  )
}
