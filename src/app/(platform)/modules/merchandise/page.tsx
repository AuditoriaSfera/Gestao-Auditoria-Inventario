'use client'

export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { trpc } from '@/lib/trpc'
import { ModulePage, DataCard, EmptyState, LoadingState, Btn } from '@/components/shared/module-page'
import { formatDate, formatCurrency, formatNumber } from '@/lib/utils'
import { subDays } from 'date-fns'

export default function MerchandisePage() {
  const [page, setPage] = useState(1)
  const end = new Date()
  const start = subDays(end, 30)

  const { data, isLoading } = trpc.merchandise.list.useQuery({ page, pageSize: 15 })
  const { data: kpi } = trpc.merchandise.kpiSummary.useQuery({ startDate: start, endDate: end })

  return (
    <ModulePage
      title="Conferência de Mercadoria"
      description="Controle de recebimento, conferência e reconciliação de notas"
      stats={[
        { label: 'Total (30 dias)', value: kpi?.total ?? '—', icon: '📦' },
        { label: 'Com Divergência', value: kpi?.withDivergence ?? '—', color: '#dc2626', icon: '⚠️' },
        { label: 'Valor Divergente', value: kpi?.totalDivergenceValue ? formatCurrency(kpi.totalDivergenceValue) : '—', color: '#dc2626', icon: '💰' },
        { label: 'Tempo Médio (min)', value: kpi?.avgConferenceTime ? formatNumber(kpi.avgConferenceTime, 0) : '—', icon: '⏱️' },
      ]}
    >
      <DataCard title="Conferências">
        {isLoading ? <LoadingState /> : (
          !data?.conferences.length ? (
            <EmptyState icon="📋" title="Nenhuma conferência registrada" description="As conferências de mercadoria aparecerão aqui após importação." />
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #f1f5f9' }}>
                    {['Nota', 'Loja', 'Tipo', 'Qtd Esperada', 'Qtd Conferida', 'Divergência', 'Recebimento', 'Status'].map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '10px 12px', fontSize: '12px', fontWeight: '600', color: '#64748b', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.conferences.map((c: any) => (
                    <tr key={c.id} style={{ borderBottom: '1px solid #f8fafc' }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#f8fafc')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      <td style={{ padding: '12px', fontWeight: '600' }}>{c.noteNumber}</td>
                      <td style={{ padding: '12px' }}>{c.store?.name}</td>
                      <td style={{ padding: '12px', color: '#64748b' }}>{c.operationType}</td>
                      <td style={{ padding: '12px' }}>{c.expectedQty ? formatNumber(Number(c.expectedQty), 0) : '—'}</td>
                      <td style={{ padding: '12px' }}>{c.conferencedQty ? formatNumber(Number(c.conferencedQty), 0) : '—'}</td>
                      <td style={{ padding: '12px', fontWeight: '600', color: Number(c.divergenceQty) !== 0 ? '#dc2626' : '#16a34a' }}>
                        {c.divergenceQty ? (Number(c.divergenceQty) > 0 ? '+' : '') + formatNumber(Number(c.divergenceQty), 0) : '0'}
                      </td>
                      <td style={{ padding: '12px', color: '#374151' }}>{c.receivedAt ? formatDate(c.receivedAt) : '—'}</td>
                      <td style={{ padding: '12px' }}>
                        <span style={{ padding: '2px 10px', borderRadius: '99px', fontSize: '12px', fontWeight: '600', background: c.status === 'PENDING' ? '#fef3c7' : '#dcfce7', color: c.status === 'PENDING' ? '#d97706' : '#16a34a' }}>{c.status}</span>
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
    </ModulePage>
  )
}
