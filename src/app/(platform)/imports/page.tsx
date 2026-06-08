'use client'

export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { trpc } from '@/lib/trpc'
import { ModulePage, DataCard, StatusBadge, EmptyState, LoadingState, Btn } from '@/components/shared/module-page'
import { formatDateTime, formatNumber } from '@/lib/utils'
import { MODULE_LABELS, IMPORT_STATUS_LABELS } from '@/lib/constants'

export default function ImportsPage() {
  const [page, setPage] = useState(1)
  const [module, setModule] = useState('')
  const [selectedBatch, setSelectedBatch] = useState<string | null>(null)

  const { data, isLoading, refetch } = trpc.imports.listBatches.useQuery({ page, pageSize: 15, module: module || undefined })
  const { data: batchDetail } = trpc.imports.getBatchDetails.useQuery({ id: selectedBatch! }, { enabled: !!selectedBatch })
  const { data: layouts } = trpc.imports.listLayouts.useQuery({ module: module || undefined })

  const statusColors: Record<string, { bg: string; text: string }> = {
    PUBLISHED: { bg: '#dcfce7', text: '#16a34a' },
    PARTIALLY_PUBLISHED: { bg: '#fef3c7', text: '#d97706' },
    FAILED: { bg: '#fee2e2', text: '#dc2626' },
    VALIDATING: { bg: '#dbeafe', text: '#2563eb' },
    STAGING: { bg: '#ede9fe', text: '#7c3aed' },
    UPLOADING: { bg: '#f0f9ff', text: '#0369a1' },
    CANCELLED: { bg: '#f1f5f9', text: '#64748b' },
  }

  return (
    <ModulePage
      title="Central de Importações"
      description="Gerencie todos os lotes de importação de dados da plataforma. Staging → Validação → Publicação."
    >
      <div style={{ display: 'grid', gridTemplateColumns: selectedBatch ? '1fr 400px' : '1fr', gap: '16px' }}>
        <DataCard
          title={`Lotes de Importação (${data?.meta?.total ?? 0})`}
          action={
            <div style={{ display: 'flex', gap: '8px' }}>
              <select value={module} onChange={e => { setModule(e.target.value); setPage(1) }}
                style={{ padding: '6px 10px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '13px' }}>
                <option value="">Todos os módulos</option>
                {Object.entries(MODULE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <Btn variant="outline" small onClick={() => refetch()}>↻ Atualizar</Btn>
            </div>
          }
        >
          {isLoading ? <LoadingState /> : !data?.batches.length ? (
            <EmptyState icon="📤" title="Nenhum lote importado" description="Os lotes de importação aparecerão aqui após o upload de arquivos Excel." />
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #f1f5f9' }}>
                    {['Arquivo', 'Módulo', 'Layout', 'Data/Hora', 'Linhas', 'Válidas', 'Inválidas', 'Status', ''].map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '10px 12px', fontSize: '12px', fontWeight: '600', color: '#64748b', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.batches.map((b: any) => (
                    <tr key={b.id}
                      style={{ borderBottom: '1px solid #f8fafc', background: selectedBatch === b.id ? '#eff6ff' : 'transparent', cursor: 'pointer' }}
                      onMouseEnter={e => { if (selectedBatch !== b.id) e.currentTarget.style.background = '#f8fafc' }}
                      onMouseLeave={e => { if (selectedBatch !== b.id) e.currentTarget.style.background = 'transparent' }}
                      onClick={() => setSelectedBatch(b.id === selectedBatch ? null : b.id)}>
                      <td style={{ padding: '12px' }}>
                        <div style={{ fontWeight: '500', color: '#0f172a', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.originalName}</div>
                        <div style={{ fontSize: '12px', color: '#94a3b8' }}>por {b.uploadedBy?.name}</div>
                      </td>
                      <td style={{ padding: '12px' }}><span style={{ padding: '2px 8px', borderRadius: '6px', fontSize: '12px', background: '#dbeafe', color: '#1d4ed8' }}>{MODULE_LABELS[b.module] || b.module}</span></td>
                      <td style={{ padding: '12px', color: '#64748b', fontSize: '13px' }}>{b.layout?.name || '—'}</td>
                      <td style={{ padding: '12px', color: '#374151', fontSize: '13px', whiteSpace: 'nowrap' }}>{formatDateTime(b.createdAt)}</td>
                      <td style={{ padding: '12px', textAlign: 'center' }}>{formatNumber(b.totalRows, 0)}</td>
                      <td style={{ padding: '12px', textAlign: 'center', color: '#16a34a', fontWeight: '600' }}>{formatNumber(b.validRows, 0)}</td>
                      <td style={{ padding: '12px', textAlign: 'center', color: b.invalidRows > 0 ? '#dc2626' : '#94a3b8', fontWeight: b.invalidRows > 0 ? '600' : 'normal' }}>{formatNumber(b.invalidRows, 0)}</td>
                      <td style={{ padding: '12px' }}>
                        <StatusBadge status={b.status} label={IMPORT_STATUS_LABELS[b.status] || b.status} colorMap={statusColors} />
                      </td>
                      <td style={{ padding: '12px' }}>
                        <button style={{ fontSize: '12px', color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer', padding: '0' }}>
                          {selectedBatch === b.id ? 'Fechar ×' : 'Detalhes →'}
                        </button>
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
          )}
        </DataCard>

        {/* Detalhe do lote */}
        {selectedBatch && batchDetail && (
          <DataCard title="Detalhes do Lote">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '14px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                {[
                  { label: 'Total de Linhas', value: batchDetail.totalRows },
                  { label: 'Linhas Válidas', value: batchDetail.validRows },
                  { label: 'Linhas Inválidas', value: batchDetail.invalidRows },
                  { label: 'Publicadas', value: batchDetail.publishedRows },
                ].map(s => (
                  <div key={s.label} style={{ padding: '12px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '12px', color: '#64748b' }}>{s.label}</div>
                    <div style={{ fontSize: '20px', fontWeight: '700', color: '#0f172a' }}>{s.value}</div>
                  </div>
                ))}
              </div>

              {batchDetail.errorSummary && (
                <div style={{ padding: '12px', background: '#fef2f2', borderRadius: '8px', border: '1px solid #fecaca' }}>
                  <div style={{ fontSize: '12px', fontWeight: '600', color: '#dc2626', marginBottom: '4px' }}>Resumo de Erros</div>
                  <div style={{ fontSize: '13px', color: '#7f1d1d' }}>{batchDetail.errorSummary}</div>
                </div>
              )}

              {batchDetail.errors?.length > 0 && (
                <div>
                  <div style={{ fontSize: '12px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>Erros por Linha</div>
                  <div style={{ maxHeight: '200px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {batchDetail.errors.slice(0, 20).map((err: any) => (
                      <div key={err.id} style={{ padding: '8px 10px', background: '#fef2f2', borderRadius: '6px', fontSize: '12px' }}>
                        <span style={{ fontWeight: '600', color: '#dc2626' }}>Linha {err.rowNumber}: </span>
                        <span style={{ color: '#7f1d1d' }}>{err.message}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </DataCard>
        )}
      </div>

      {/* Layouts disponíveis */}
      {layouts && layouts.length > 0 && (
        <DataCard title="Layouts de Importação Cadastrados">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '12px' }}>
            {layouts.map((l: any) => (
              <div key={l.id} style={{ padding: '14px', background: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontWeight: '600', color: '#0f172a', fontSize: '14px', marginBottom: '4px' }}>{l.name}</div>
                <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '8px' }}>{MODULE_LABELS[l.module] || l.module}</div>
                {l.description && <div style={{ fontSize: '12px', color: '#64748b' }}>{l.description}</div>}
                {l.versions?.[0] && (
                  <div style={{ marginTop: '8px', fontSize: '11px', color: '#a5b4fc', fontWeight: '500' }}>v{l.versions[0].version} · ativa</div>
                )}
              </div>
            ))}
          </div>
        </DataCard>
      )}
    </ModulePage>
  )
}
