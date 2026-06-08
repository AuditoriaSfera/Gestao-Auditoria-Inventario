'use client'

export const dynamic = 'force-dynamic'

import { trpc } from '@/lib/trpc'
import { ModulePage, DataCard, EmptyState, LoadingState } from '@/components/shared/module-page'
import { formatDate, formatCurrency, formatNumber } from '@/lib/utils'

export default function InventoryCostPage() {
  const { data: comparisons, isLoading } = trpc.inventoryKpi.compare.useQuery({ limit: 20 })

  return (
    <ModulePage
      title="Custo de Inventário"
      description="Controle do custo operacional da realização de inventários por loja e equipe"
    >
      <DataCard title="Custos por Ciclo de Inventário">
        {isLoading ? <LoadingState /> : (
          !comparisons?.length ? (
            <EmptyState
              icon="💰"
              title="Nenhum custo registrado"
              description="Os custos são vinculados ao fechamento do inventário. Finalize um inventário para registrar os custos."
            />
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #f1f5f9' }}>
                    {['Loja', 'Data', 'Colaboradores', 'Horas Totais', 'Custo Equipe', 'Custo Total', 'Custo/Peça', 'Custo/SKU'].map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '10px 12px', fontSize: '12px', fontWeight: '600', color: '#64748b', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {comparisons.map((c: any) => {
                    const cost = c.costs?.[0]
                    return (
                      <tr key={c.id} style={{ borderBottom: '1px solid #f8fafc' }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#f8fafc')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                        <td style={{ padding: '12px' }}>
                          <div style={{ fontWeight: '500' }}>{c.store?.name}</div>
                          <div style={{ fontSize: '12px', color: '#94a3b8' }}>{c.store?.code}</div>
                        </td>
                        <td style={{ padding: '12px', color: '#374151' }}>{formatDate(c.date)}</td>
                        <td style={{ padding: '12px', textAlign: 'center' }}>{cost?.collaboratorsCount ?? '—'}</td>
                        <td style={{ padding: '12px', textAlign: 'center' }}>{cost ? formatNumber(Number(cost.totalHours), 1) + 'h' : '—'}</td>
                        <td style={{ padding: '12px' }}>{cost ? formatCurrency(Number(cost.teamCost)) : '—'}</td>
                        <td style={{ padding: '12px', fontWeight: '700', color: '#0f172a' }}>{cost ? formatCurrency(Number(cost.totalCost)) : '—'}</td>
                        <td style={{ padding: '12px', color: '#64748b' }}>{cost?.costPerPiece ? formatCurrency(Number(cost.costPerPiece)) : '—'}</td>
                        <td style={{ padding: '12px', color: '#64748b' }}>{cost?.costPerSku ? formatCurrency(Number(cost.costPerSku)) : '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )
        )}
      </DataCard>
    </ModulePage>
  )
}
