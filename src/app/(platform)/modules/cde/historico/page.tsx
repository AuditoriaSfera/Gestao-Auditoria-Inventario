'use client'

export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { trpc } from '@/lib/trpc'
import { formatNumber, formatDateTime } from '@/lib/utils'
import { IMPORT_STATUS_LABELS } from '@/lib/constants'
import { CdeTabs, Card, Pill } from '../_components'

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  PUBLISHED: { bg: '#dcfce7', text: '#15803d' },
  PARTIALLY_PUBLISHED: { bg: '#fef3c7', text: '#b45309' },
  FAILED: { bg: '#fee2e2', text: '#dc2626' },
  VALIDATING: { bg: '#e0f2fe', text: '#0369a1' },
}

export default function CdeHistoricoPage() {
  const [page, setPage] = useState(1)
  const { data, isLoading } = trpc.cde.importHistory.useQuery({ page, pageSize: 20 })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div>
        <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#0f172a', margin: '0 0 4px' }}>Histórico — CDE</h1>
        <p style={{ fontSize: '14px', color: '#64748b', margin: 0 }}>
          Registro de todas as importações: usuário, data/hora, arquivo e quantidade de linhas.
        </p>
      </div>
      <CdeTabs />

      {isLoading ? (
        <Card style={{ padding: 48, textAlign: 'center', color: '#94a3b8' }}>Carregando…</Card>
      ) : !data?.batches.length ? (
        <Card style={{ padding: 48, textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>🗂️</div>
          <p style={{ color: '#374151', fontWeight: 600, margin: 0 }}>Nenhuma importação registrada ainda.</p>
        </Card>
      ) : (
        <Card style={{ overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                  {['Data/hora', 'Arquivo', 'Usuário', 'Linhas', 'Publicadas', 'Inválidas', 'Status'].map((h) => <th key={h} style={thS}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {data.batches.map((b: any) => {
                  const c = STATUS_COLORS[b.status] ?? { bg: '#f1f5f9', text: '#64748b' }
                  return (
                    <tr key={b.id} style={{ borderBottom: '1px solid #f8fafc' }}>
                      <td style={tdS}>{formatDateTime(b.createdAt)}</td>
                      <td style={{ ...tdS, maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.originalName}</td>
                      <td style={tdS}>{b.uploadedBy?.name ?? '—'}</td>
                      <td style={tdS}>{formatNumber(b.totalRows, 0)}</td>
                      <td style={{ ...tdS, color: '#16a34a', fontWeight: 600 }}>{formatNumber(b.publishedRows, 0)}</td>
                      <td style={{ ...tdS, color: b.invalidRows > 0 ? '#dc2626' : '#94a3b8' }}>{formatNumber(b.invalidRows, 0)}</td>
                      <td style={tdS}><Pill bg={c.bg} text={c.text}>{IMPORT_STATUS_LABELS[b.status] ?? b.status}</Pill></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {(data.meta?.totalPages ?? 0) > 1 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderTop: '1px solid #f1f5f9' }}>
              <span style={{ fontSize: 13, color: '#64748b' }}>Página {data.meta.page} de {data.meta.totalPages}</span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button disabled={!data.meta.hasPrev} onClick={() => setPage((p) => p - 1)} style={pageBtn(!data.meta.hasPrev)}>← Anterior</button>
                <button disabled={!data.meta.hasNext} onClick={() => setPage((p) => p + 1)} style={pageBtn(!data.meta.hasNext)}>Próxima →</button>
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  )
}

const thS: React.CSSProperties = { textAlign: 'left', padding: '10px 12px', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', whiteSpace: 'nowrap' }
const tdS: React.CSSProperties = { padding: '11px 12px', color: '#374151' }
const pageBtn = (disabled: boolean): React.CSSProperties => ({ padding: '6px 12px', borderRadius: 8, fontSize: 13, border: '1px solid #d1d5db', background: 'white', color: '#374151', cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1 })
