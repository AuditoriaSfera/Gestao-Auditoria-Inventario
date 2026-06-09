'use client'

export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { trpc } from '@/lib/trpc'
import { ModulePage, DataCard, StatusBadge, EmptyState, LoadingState, Btn } from '@/components/shared/module-page'
import { formatDate, formatCurrency } from '@/lib/utils'

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pendente', IN_TRANSIT: 'Em Trânsito', RECEIVED: 'Recebido',
  LATE: 'Atrasado', CANCELLED: 'Cancelado', DIVERGENT: 'Divergente',
}

export default function NoteTransitPage() {
  const [page, setPage] = useState(1)
  const [lateOnly, setLateOnly] = useState(false)

  const { data: kpi } = trpc.noteTransit.kpiSummary.useQuery({})
  const { data, isLoading } = trpc.noteTransit.list.useQuery({ page, pageSize: 15, lateOnly: lateOnly || undefined })

  return (
    <ModulePage
      title="Trânsito de Notas"
      description="Controle de mercadorias emitidas e ainda não recebidas"
      stats={[
        { label: 'Pendentes', value: kpi?.pending ?? '—', color: '#d97706', icon: '📋' },
        { label: 'Atrasadas', value: kpi?.late ?? '—', color: '#dc2626', icon: '🚨' },
        { label: 'Recebidas', value: kpi?.received ?? '—', color: '#16a34a', icon: '✅' },
      ]}
    >
      <DataCard
        title="Notas em trânsito"
        action={
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#374151', cursor: 'pointer' }}>
            <input type="checkbox" checked={lateOnly} onChange={e => { setLateOnly(e.target.checked); setPage(1) }} />
            Apenas atrasadas
          </label>
        }
      >
        {isLoading ? <LoadingState /> : (
          !data?.transits.length ? (
            <EmptyState icon="🚚" title="Nenhuma nota em trânsito" description="As notas fiscais emitidas aparecerão aqui após importação." />
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #f1f5f9' }}>
                    {['Nº Nota', 'Tipo', 'Destino', 'Emissão', 'Previsão', 'Valor', 'Status'].map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '10px 12px', fontSize: '12px', fontWeight: '600', color: '#64748b', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.transits.map((t: any) => (
                    <tr key={t.id} style={{ borderBottom: '1px solid #f8fafc' }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#f8fafc')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      <td style={{ padding: '12px', fontWeight: '600', color: '#0f172a' }}>{t.noteNumber}</td>
                      <td style={{ padding: '12px', color: '#64748b' }}>{t.noteType}</td>
                      <td style={{ padding: '12px' }}><div style={{ fontWeight: '500' }}>{t.destinationStore?.name}</div><div style={{ fontSize: '12px', color: '#94a3b8' }}>{t.destinationStore?.code}</div></td>
                      <td style={{ padding: '12px', color: '#374151' }}>{formatDate(t.issuedAt)}</td>
                      <td style={{ padding: '12px', color: t.status === 'LATE' ? '#dc2626' : '#374151' }}>{t.expectedAt ? formatDate(t.expectedAt) : '—'}</td>
                      <td style={{ padding: '12px', color: '#374151' }}>{t.totalValue ? formatCurrency(Number(t.totalValue)) : '—'}</td>
                      <td style={{ padding: '12px' }}><StatusBadge status={t.status} label={STATUS_LABELS[t.status] || t.status} /></td>
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
