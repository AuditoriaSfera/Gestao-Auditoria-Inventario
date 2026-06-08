'use client'

export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { trpc } from '@/lib/trpc'
import { ModulePage, DataCard, EmptyState, LoadingState, Btn } from '@/components/shared/module-page'
import { formatDate, formatCurrency, formatNumber } from '@/lib/utils'
import { subDays } from 'date-fns'

export default function WriteOffsPage() {
  const [page, setPage] = useState(1)
  const end = new Date()
  const start = subDays(end, 30)

  const { data, isLoading } = trpc.writeOffs.list.useQuery({ page, pageSize: 15, startDate: start, endDate: end })
  const { data: topOffenders } = trpc.writeOffs.topOffenders.useQuery({ startDate: start, endDate: end, limit: 5 })

  return (
    <ModulePage
      title="Baixas e Perdas"
      description="Controle de avarias, vencidos, brindes e demais baixas operacionais"
    >
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '16px' }}>
        <DataCard title={`Baixas — últimos 30 dias (${data?.meta?.total ?? 0} registros)`}>
          {isLoading ? <LoadingState /> : (
            !data?.writeOffs.length ? (
              <EmptyState icon="📉" title="Nenhuma baixa registrada" description="As baixas importadas aparecerão aqui." />
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #f1f5f9' }}>
                      {['Loja', 'Data', 'Qtd Total', 'Custo Total', 'Status'].map(h => (
                        <th key={h} style={{ textAlign: 'left', padding: '10px 12px', fontSize: '12px', fontWeight: '600', color: '#64748b' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.writeOffs.map((w: any) => (
                      <tr key={w.id} style={{ borderBottom: '1px solid #f8fafc' }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#f8fafc')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                        <td style={{ padding: '12px' }}><div style={{ fontWeight: '500' }}>{w.store?.name}</div><div style={{ fontSize: '12px', color: '#94a3b8' }}>{w.store?.code}</div></td>
                        <td style={{ padding: '12px', color: '#374151' }}>{formatDate(w.date)}</td>
                        <td style={{ padding: '12px', color: '#374151' }}>{formatNumber(Number(w.totalQuantity), 0)}</td>
                        <td style={{ padding: '12px', fontWeight: '600', color: '#dc2626' }}>{formatCurrency(Number(w.totalCost))}</td>
                        <td style={{ padding: '12px' }}>
                          <span style={{ padding: '2px 10px', borderRadius: '99px', fontSize: '12px', fontWeight: '600', background: '#f1f5f9', color: '#64748b' }}>{w.status}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {(data.meta?.totalPages ?? 0) > 1 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #f1f5f9' }}>
                    <span style={{ fontSize: '13px', color: '#64748b' }}>Página {data.meta.page} de {data.meta.totalPages}</span>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <Btn variant="outline" small disabled={!data.meta.hasPrev} onClick={() => setPage(p => p - 1)}>← Anterior</Btn>
                      <Btn variant="outline" small disabled={!data.meta.hasNext} onClick={() => setPage(p => p + 1)}>Próxima →</Btn>
                    </div>
                  </div>
                )}
              </div>
            )
          )}
        </DataCard>

        <DataCard title="Top Ofensores (SKU)">
          {!topOffenders?.length ? (
            <EmptyState icon="📊" title="Sem dados" description="Importe baixas para ver os top ofensores." />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {topOffenders.map((item: any, i: number) => (
                <div key={item.sku} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: i < 3 ? '#fee2e2' : '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: '700', color: i < 3 ? '#dc2626' : '#64748b', flexShrink: 0 }}>{i + 1}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '13px', fontWeight: '600', color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.description}</div>
                    <div style={{ fontSize: '12px', color: '#94a3b8' }}>SKU: {item.sku} · {formatNumber(item.qty, 0)} un</div>
                  </div>
                  <div style={{ fontSize: '13px', fontWeight: '700', color: '#dc2626', flexShrink: 0 }}>{formatCurrency(item.totalLoss)}</div>
                </div>
              ))}
            </div>
          )}
        </DataCard>
      </div>
    </ModulePage>
  )
}
