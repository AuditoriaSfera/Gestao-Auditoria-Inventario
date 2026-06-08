'use client'

export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { trpc } from '@/lib/trpc'
import { ModulePage, DataCard, EmptyState, LoadingState } from '@/components/shared/module-page'
import { formatDate, formatNumber } from '@/lib/utils'

export default function InventoryKpiPage() {
  const { data: comparisons, isLoading } = trpc.inventoryKpi.compare.useQuery({ limit: 20 })

  return (
    <ModulePage
      title="KPI Interno do Time de Inventário"
      description="Indicadores de produtividade, qualidade da contagem e performance do time. Calculado após fechamento oficial."
    >
      <DataCard title="Histórico de KPIs por Ciclo">
        {isLoading ? <LoadingState /> : (
          !comparisons?.length ? (
            <EmptyState icon="📊" title="Nenhum KPI registrado" description="Os KPIs são calculados automaticamente após o fechamento oficial do inventário." />
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #f1f5f9' }}>
                    {['Loja', 'Data', 'Peças Bipadas', 'SKU Bipados', 'Colaboradores', 'Peças/Hora', 'Peças/Colab.', 'Tx. Erro', 'Tx. Recontagem'].map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '10px 12px', fontSize: '12px', fontWeight: '600', color: '#64748b', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {comparisons.map((c: any) => {
                    const kpi = c.teamKpis?.[0]
                    return (
                      <tr key={c.id} style={{ borderBottom: '1px solid #f8fafc' }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#f8fafc')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                        <td style={{ padding: '12px' }}>
                          <div style={{ fontWeight: '500' }}>{c.store?.name}</div>
                          <div style={{ fontSize: '12px', color: '#94a3b8' }}>{c.store?.code}</div>
                        </td>
                        <td style={{ padding: '12px', color: '#374151' }}>{formatDate(c.date)}</td>
                        <td style={{ padding: '12px', fontWeight: '600' }}>{kpi ? formatNumber(Number(kpi.totalPiecesCounted), 0) : '—'}</td>
                        <td style={{ padding: '12px' }}>{kpi ? formatNumber(kpi.totalSkuCounted, 0) : '—'}</td>
                        <td style={{ padding: '12px', textAlign: 'center' }}>{kpi ? kpi.collaboratorsCount : '—'}</td>
                        <td style={{ padding: '12px', fontWeight: '600', color: '#2563eb' }}>{kpi ? formatNumber(Number(kpi.productivityPerHour), 0) : '—'}</td>
                        <td style={{ padding: '12px' }}>{kpi ? formatNumber(Number(kpi.piecesPerCollaborator), 0) : '—'}</td>
                        <td style={{ padding: '12px', color: kpi && Number(kpi.errorRate) > 0.05 ? '#dc2626' : '#16a34a' }}>
                          {kpi ? formatNumber(Number(kpi.errorRate) * 100, 1) + '%' : '—'}
                        </td>
                        <td style={{ padding: '12px', color: kpi && Number(kpi.recountRate) > 0.1 ? '#d97706' : '#16a34a' }}>
                          {kpi ? formatNumber(Number(kpi.recountRate) * 100, 1) + '%' : '—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )
        )}
      </DataCard>

      {/* Legenda de fórmulas */}
      <DataCard title="Como são calculados os indicadores">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', fontSize: '13px' }}>
          {[
            { label: 'Peças Bipadas', formula: 'Soma do campo Apurado de todos os itens' },
            { label: 'SKU Bipados', formula: 'Quantidade de linhas com Apurado > 0' },
            { label: 'Peças por Colaborador', formula: 'Total de Peças ÷ Quantidade de Colaboradores' },
            { label: 'Produtividade/Hora', formula: 'Total de Peças ÷ Duração Total em Horas' },
            { label: 'Taxa de Erro', formula: 'SKU com Erro de CTG ÷ Total de SKU Bipados' },
            { label: 'Taxa de Recontagem', formula: 'Qtd. Recontagens ÷ Total de SKU Bipados' },
          ].map(f => (
            <div key={f.label} style={{ padding: '12px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <div style={{ fontWeight: '600', color: '#374151', marginBottom: '4px' }}>{f.label}</div>
              <div style={{ color: '#64748b', fontFamily: 'monospace', fontSize: '12px' }}>{f.formula}</div>
            </div>
          ))}
        </div>
      </DataCard>
    </ModulePage>
  )
}
