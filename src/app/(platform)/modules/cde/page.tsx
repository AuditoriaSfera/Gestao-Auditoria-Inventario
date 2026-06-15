'use client'

export const dynamic = 'force-dynamic'

import { useMemo, useState } from 'react'
import { trpc } from '@/lib/trpc'
import { formatNumber } from '@/lib/utils'
import { CDE_CATEGORY_LABELS } from '@/modules/cde/constants'
import { CdeTabs, Card, Kpi, SlaDot, selectStyle } from './_components'

function daysAgo(n: number) {
  const d = new Date(); d.setDate(d.getDate() - n); d.setHours(0, 0, 0, 0); return d
}

export default function CdePainelPage() {
  const [days, setDays] = useState(7)
  const [storeId, setStoreId] = useState('')

  const range = useMemo(() => {
    const endDate = new Date(); endDate.setHours(23, 59, 59, 999)
    return { startDate: daysAgo(days), endDate }
  }, [days])

  const { data: stores } = trpc.cde.accessibleStores.useQuery()
  const { data, isLoading } = trpc.cde.dashboard.useQuery({
    startDate: range.startDate, endDate: range.endDate, storeId: storeId || undefined,
  })

  const v = data?.volume
  const sla = data?.slaSummary
  const q = data?.quality

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div>
        <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#0f172a', margin: '0 0 4px' }}>
          CDE — Confronto Diário de Estoque
        </h1>
        <p style={{ fontSize: '14px', color: '#64748b', margin: 0 }}>
          Painel de acompanhamento de importações, validações e divergências por loja.
        </p>
      </div>

      <CdeTabs />

      {/* Filtros */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <select value={days} onChange={(e) => setDays(Number(e.target.value))} style={selectStyle()}>
          <option value={1}>Hoje</option>
          <option value={7}>Últimos 7 dias</option>
          <option value={30}>Últimos 30 dias</option>
          <option value={90}>Últimos 90 dias</option>
        </select>
        <select value={storeId} onChange={(e) => setStoreId(e.target.value)} style={selectStyle()}>
          <option value="">Todas as lojas</option>
          {stores?.map((s) => <option key={s.id} value={s.id}>{s.code} — {s.name}</option>)}
        </select>
      </div>

      {isLoading ? (
        <Card style={{ padding: '48px', textAlign: 'center', color: '#94a3b8' }}>Carregando indicadores…</Card>
      ) : (
        <>
          {/* Volume */}
          <section>
            <h2 style={sectionTitle}>Volume de movimentações</h2>
            <div style={grid(6)}>
              <Kpi label="Total importado" value={fmt(v?.total)} icon="📋" />
              <Kpi label="Pendente de validação" value={fmt(v?.pending)} color="#b45309" icon="⏳" />
              <Kpi label="Correto" value={fmt(v?.correct)} color="#16a34a" icon="✅" />
              <Kpi label="Incorreto" value={fmt(v?.incorrect)} color="#dc2626" icon="❌" />
              <Kpi label="Regularizado" value={fmt(v?.regularized)} color="#1d4ed8" icon="🔁" />
              <Kpi label="Pend. parametrização" value={fmt(v?.pendingParam)} color="#b91c1c" icon="🚧" />
            </div>
          </section>

          {/* SLA 24h */}
          <section>
            <h2 style={sectionTitle}>SLA de validação (24h)</h2>
            <div style={grid(5)}>
              <Kpi label="Validaram no prazo" value={fmt(sla?.validatedWithinDeadline)} color="#16a34a" icon="🟢" />
              <Kpi label="Ainda no prazo" value={fmt(sla?.stillInTime)} color="#0369a1" icon="🔵" />
              <Kpi label="Próximas do venc." value={fmt(sla?.nearDeadline)} color="#d97706" icon="🟡" />
              <Kpi label="Em atraso" value={fmt(sla?.overdue)} color="#dc2626" icon="🔴" />
              <Kpi
                label="Tempo médio validação"
                value={sla?.avgValidationHours != null ? `${formatNumber(sla.avgValidationHours, 1)}h` : '—'}
                icon="⏱️"
              />
            </div>
          </section>

          {/* Semáforo por loja */}
          <Card style={{ padding: '20px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#0f172a', margin: '0 0 14px' }}>
              Semáforo de SLA por loja
            </h3>
            {!data?.storesSla.length ? (
              <p style={{ color: '#94a3b8', fontSize: '14px', margin: 0 }}>Nenhuma movimentação no período.</p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={table}>
                  <thead>
                    <tr style={theadRow}>
                      {['', 'Loja', 'Validadas', 'Pendentes', 'Progresso', 'Prazo', 'Situação'].map((h) => (
                        <th key={h} style={th}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.storesSla.map((s) => (
                      <tr key={s.storeId} style={tr}>
                        <td style={td}><SlaDot state={s.state} /></td>
                        <td style={td}>
                          <div style={{ fontWeight: 500 }}>{s.storeName}</div>
                          <div style={{ fontSize: '12px', color: '#94a3b8' }}>{s.storeCode}</div>
                        </td>
                        <td style={td}>{s.validatedCount}/{s.total}</td>
                        <td style={{ ...td, color: s.pendingCount > 0 ? '#b45309' : '#16a34a' }}>{s.pendingCount}</td>
                        <td style={td}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ width: 80, height: 6, background: '#f1f5f9', borderRadius: 99 }}>
                              <div style={{ width: `${s.progress}%`, height: '100%', background: s.done ? '#16a34a' : '#2563eb', borderRadius: 99 }} />
                            </div>
                            <span style={{ fontSize: '12px', color: '#64748b' }}>{s.progress}%</span>
                          </div>
                        </td>
                        <td style={{ ...td, fontSize: '13px', color: s.overdue ? '#dc2626' : '#64748b' }}>
                          {s.done ? '—' : s.overdue ? `${formatNumber(Math.abs(s.hoursLeft), 1)}h em atraso` : `${formatNumber(s.hoursLeft, 1)}h restantes`}
                        </td>
                        <td style={td}>
                          {s.done ? <span style={{ color: '#16a34a', fontWeight: 600, fontSize: '13px' }}>Concluída</span>
                            : s.overdue ? <span style={{ color: '#dc2626', fontWeight: 600, fontSize: '13px' }}>Em atraso</span>
                            : s.nearDeadline ? <span style={{ color: '#d97706', fontWeight: 600, fontSize: '13px' }}>Atenção</span>
                            : <span style={{ color: '#0369a1', fontWeight: 600, fontSize: '13px' }}>No prazo</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {/* Qualidade */}
          <section>
            <h2 style={sectionTitle}>Indicadores de qualidade</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
              <Card style={{ padding: '20px' }}>
                <h3 style={cardTitle}>Incorretos por loja</h3>
                <RankList
                  items={(q?.incorrectByStore ?? []).slice(0, 8).map((i) => ({ label: `${i.code} — ${i.name}`, value: i.count }))}
                  empty="Nenhuma divergência."
                  highlight={q?.topDivergenceStore ? `${q.topDivergenceStore.code}` : undefined}
                />
              </Card>
              <Card style={{ padding: '20px' }}>
                <h3 style={cardTitle}>Incorretos por categoria gerencial</h3>
                <RankList
                  items={(q?.incorrectByCategory ?? []).map((i) => ({ label: CDE_CATEGORY_LABELS[i.category] ?? i.category, value: i.count }))}
                  empty="Nenhuma divergência."
                />
              </Card>
              <Card style={{ padding: '20px' }}>
                <h3 style={cardTitle}>Evolução diária (correto × incorreto)</h3>
                {!q?.dailyEvolution.length ? (
                  <p style={{ color: '#94a3b8', fontSize: '14px', margin: 0 }}>Sem dados.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {q.dailyEvolution.slice(-10).map((d) => {
                      const max = Math.max(1, ...q.dailyEvolution.map((x) => x.correct + x.incorrect))
                      return (
                        <div key={d.date} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '12px', color: '#64748b', width: 70 }}>{d.date.slice(5)}</span>
                          <div style={{ flex: 1, display: 'flex', height: 14, borderRadius: 4, overflow: 'hidden', background: '#f1f5f9' }}>
                            <div style={{ width: `${(d.correct / max) * 100}%`, background: '#16a34a' }} />
                            <div style={{ width: `${(d.incorrect / max) * 100}%`, background: '#dc2626' }} />
                          </div>
                          <span style={{ fontSize: '12px', color: '#16a34a', width: 28, textAlign: 'right' }}>{d.correct}</span>
                          <span style={{ fontSize: '12px', color: '#dc2626', width: 28, textAlign: 'right' }}>{d.incorrect}</span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </Card>
            </div>
          </section>
        </>
      )}
    </div>
  )
}

function RankList({ items, empty, highlight }: { items: { label: string; value: number }[]; empty: string; highlight?: string }) {
  if (!items.length) return <p style={{ color: '#94a3b8', fontSize: '14px', margin: 0 }}>{empty}</p>
  const max = Math.max(...items.map((i) => i.value), 1)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {items.map((i, idx) => (
        <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '13px', color: '#374151', width: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{i.label}</span>
          <div style={{ flex: 1, height: 8, background: '#f1f5f9', borderRadius: 99 }}>
            <div style={{ width: `${(i.value / max) * 100}%`, height: '100%', background: '#dc2626', borderRadius: 99 }} />
          </div>
          <span style={{ fontSize: '13px', fontWeight: 600, color: '#0f172a', width: 30, textAlign: 'right' }}>{i.value}</span>
        </div>
      ))}
    </div>
  )
}

const fmt = (n?: number) => (n == null ? '—' : formatNumber(n, 0))
const grid = (n: number): React.CSSProperties => ({ display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(150px, 1fr))`, gap: '14px' })
const sectionTitle: React.CSSProperties = { fontSize: '13px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', margin: '0 0 12px' }
const cardTitle: React.CSSProperties = { fontSize: '14px', fontWeight: 600, color: '#0f172a', margin: '0 0 14px' }
const table: React.CSSProperties = { width: '100%', borderCollapse: 'collapse', fontSize: '14px' }
const theadRow: React.CSSProperties = { background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }
const th: React.CSSProperties = { textAlign: 'left', padding: '10px 12px', fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }
const tr: React.CSSProperties = { borderBottom: '1px solid #f1f5f9' }
const td: React.CSSProperties = { padding: '12px', color: '#374151' }
