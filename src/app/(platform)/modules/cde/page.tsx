'use client'

export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { trpc } from '@/lib/trpc'
import { ModulePage, DataCard, StatusBadge, EmptyState, LoadingState, Btn } from '@/components/shared/module-page'
import { formatDate, formatNumber } from '@/lib/utils'

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Aguardando', VIEWED: 'Visualizado', ACCEPTED: 'Aceito',
  CONTESTED: 'Contestado', NO_RESPONSE: 'Sem retorno',
}

export default function CdePage() {
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState('')

  const end = new Date()
  const start = new Date(); start.setDate(start.getDate() - 7)

  const { data, isLoading } = trpc.cde.list.useQuery({ page, pageSize: 15, status: status || undefined })
  const { data: kpi } = trpc.cde.kpiSummary.useQuery({ startDate: start, endDate: end })

  return (
    <ModulePage
      title="CDE — Controle Diário de Estoque"
      description="Acompanhe as importações diárias e validações de estoque por loja"
      stats={[
        { label: 'Total (7 dias)', value: kpi?.total ?? '—', icon: '📋' },
        { label: 'Aceitos', value: kpi?.accepted ?? '—', color: '#16a34a', icon: '✅' },
        { label: 'Contestados', value: kpi?.contested ?? '—', color: '#dc2626', icon: '❌' },
        { label: 'Sem retorno', value: kpi?.noResponse ?? '—', color: '#d97706', icon: '⏳' },
      ]}
    >
      <DataCard
        title="Registros diários"
        action={
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <select
              value={status}
              onChange={e => { setStatus(e.target.value); setPage(1) }}
              style={{ padding: '6px 10px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '13px', color: '#374151' }}
            >
              <option value="">Todos os status</option>
              {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
        }
      >
        {isLoading ? <LoadingState /> : (
          <>
            {!data?.records.length ? (
              <EmptyState icon="📦" title="Nenhum registro encontrado" description="Os registros CDE aparecerão aqui após a importação diária." />
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #f1f5f9' }}>
                      {['Loja', 'Data', 'Est. Inicial', 'Entradas', 'Saídas', 'Vendas', 'Est. Final', 'Status'].map(h => (
                        <th key={h} style={{ textAlign: 'left', padding: '10px 12px', fontSize: '12px', fontWeight: '600', color: '#64748b', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.records.map((r: any) => (
                      <tr key={r.id} style={{ borderBottom: '1px solid #f8fafc' }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#f8fafc')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                        <td style={{ padding: '12px' }}><div style={{ fontWeight: '500' }}>{r.store?.name}</div><div style={{ fontSize: '12px', color: '#94a3b8' }}>{r.store?.code}</div></td>
                        <td style={{ padding: '12px', color: '#374151' }}>{formatDate(r.date)}</td>
                        <td style={{ padding: '12px', color: '#374151' }}>{formatNumber(Number(r.initialStock), 0)}</td>
                        <td style={{ padding: '12px', color: '#16a34a' }}>+{formatNumber(Number(r.entries), 0)}</td>
                        <td style={{ padding: '12px', color: '#dc2626' }}>-{formatNumber(Number(r.exits), 0)}</td>
                        <td style={{ padding: '12px', color: '#dc2626' }}>-{formatNumber(Number(r.sales), 0)}</td>
                        <td style={{ padding: '12px', fontWeight: '600', color: '#0f172a' }}>{formatNumber(Number(r.finalStock), 0)}</td>
                        <td style={{ padding: '12px' }}><StatusBadge status={r.status} label={STATUS_LABELS[r.status] || r.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {(data.meta?.totalPages ?? 0) > 1 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #f1f5f9' }}>
                    <span style={{ fontSize: '13px', color: '#64748b' }}>Página {data.meta.page} de {data.meta.totalPages}</span>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <Btn variant="outline" small disabled={!data.meta.hasPrev} onClick={() => setPage(p => p - 1)}>← Anterior</Btn>
                      <Btn variant="outline" small disabled={!data.meta.hasNext} onClick={() => setPage(p => p + 1)}>Próxima →</Btn>
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </DataCard>
    </ModulePage>
  )
}
