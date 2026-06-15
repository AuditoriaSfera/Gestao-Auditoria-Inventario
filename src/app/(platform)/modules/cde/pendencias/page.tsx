'use client'

export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { trpc } from '@/lib/trpc'
import { formatNumber, formatDate } from '@/lib/utils'
import { CDE_OFFICIAL_CATEGORIES, CDE_CATEGORY_LABELS } from '@/modules/cde/constants'
import { CdeTabs, Card, CategoryBadge, StatusBadge, NatureBadge, selectStyle } from '../_components'

const TABS = [
  { key: 'INCORRECT', label: 'Incorretos / Auditoria' },
  { key: 'PENDING_PARAM', label: 'Pendentes de parametrização' },
] as const

export default function CdePendenciasPage() {
  const [tab, setTab] = useState<'INCORRECT' | 'PENDING_PARAM'>('INCORRECT')
  const [storeId, setStoreId] = useState('')
  const [page, setPage] = useState(1)
  const [regularizing, setRegularizing] = useState<any>(null)
  const [note, setNote] = useState('')

  const caps = trpc.cde.myCapabilities.useQuery()
  const { data: stores } = trpc.cde.accessibleStores.useQuery()
  const { data, isLoading, refetch } = trpc.cde.listLines.useQuery({
    page, pageSize: 25, status: tab, storeId: storeId || undefined,
  })
  const utils = trpc.useUtils()
  const regularize = trpc.cde.regularizeLine.useMutation()
  const reclassify = trpc.cde.reclassifyLine.useMutation()
  const applyRules = trpc.cde.applyRulesToPending.useMutation()

  async function doRegularize() {
    if (!regularizing) return
    try {
      await regularize.mutateAsync({ id: regularizing.id, note })
      setRegularizing(null); setNote('')
      await refetch(); utils.cde.dashboard.invalidate()
    } catch (e: any) { alert(e.message) }
  }

  async function doReclassify(id: string, category: string) {
    try {
      await reclassify.mutateAsync({ id, category: category as any })
      await refetch(); utils.cde.dashboard.invalidate()
    } catch (e: any) { alert(e.message) }
  }

  async function doApplyRules() {
    try {
      const r = await applyRules.mutateAsync()
      alert(`${r.reclassified} linha(s) reclassificada(s). ${r.remaining} ainda pendente(s).`)
      await refetch(); utils.cde.dashboard.invalidate()
    } catch (e: any) { alert(e.message) }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div>
        <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#0f172a', margin: '0 0 4px' }}>Pendências — CDE</h1>
        <p style={{ fontSize: '14px', color: '#64748b', margin: 0 }}>
          Tratativa de divergências e classificação de movimentações não mapeadas.
        </p>
      </div>
      <CdeTabs />

      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 4, background: '#f1f5f9', padding: 4, borderRadius: 10 }}>
          {TABS.map((t) => (
            <button key={t.key} onClick={() => { setTab(t.key); setPage(1) }}
              style={{ padding: '6px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer',
                background: tab === t.key ? 'white' : 'transparent', color: tab === t.key ? '#1d4ed8' : '#64748b' }}>
              {t.label}
            </button>
          ))}
        </div>
        <select value={storeId} onChange={(e) => { setStoreId(e.target.value); setPage(1) }} style={selectStyle()}>
          <option value="">Todas as lojas</option>
          {stores?.map((s) => <option key={s.id} value={s.id}>{s.code} — {s.name}</option>)}
        </select>
        {tab === 'PENDING_PARAM' && caps.data?.canReclassify && (
          <button onClick={doApplyRules} disabled={applyRules.isLoading} style={btnPrimary}>
            {applyRules.isLoading ? 'Aplicando…' : '⚙️ Reaplicar regras'}
          </button>
        )}
      </div>

      {isLoading ? (
        <Card style={{ padding: 48, textAlign: 'center', color: '#94a3b8' }}>Carregando…</Card>
      ) : !data?.lines.length ? (
        <Card style={{ padding: 48, textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>🎉</div>
          <p style={{ color: '#374151', fontWeight: 600, margin: 0 }}>Nenhuma pendência aqui.</p>
        </Card>
      ) : (
        <Card style={{ overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                  {['Loja', 'Documento', 'Movimentação', 'Qtd.', 'Natureza', 'Categoria', 'Status', 'Detalhe / Ação'].map((h) => <th key={h} style={thS}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {data.lines.map((l: any) => (
                  <tr key={l.id} style={{ borderBottom: '1px solid #f8fafc' }}>
                    <td style={tdS}><div style={{ fontWeight: 500 }}>{l.store?.code}</div><div style={{ fontSize: 11, color: '#94a3b8' }}>{formatDate(l.date)}</div></td>
                    <td style={{ ...tdS, fontWeight: 600 }}>{l.documento}</td>
                    <td style={tdS}>{l.movimentacao ?? '—'}</td>
                    <td style={{ ...tdS, textAlign: 'right', color: Number(l.qtdMovimento) >= 0 ? '#16a34a' : '#dc2626', fontWeight: 600 }}>{formatNumber(Number(l.qtdMovimento), 2)}</td>
                    <td style={tdS}><NatureBadge nature={l.nature} /></td>
                    <td style={tdS}><CategoryBadge category={l.category} /></td>
                    <td style={tdS}><StatusBadge status={l.status} />{l.forwardedToAudit && <div style={{ fontSize: 11, color: '#7c3aed', marginTop: 2 }}>⚑ auditoria</div>}</td>
                    <td style={tdS}>
                      {tab === 'INCORRECT' ? (
                        <div>
                          {l.validationReason && <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4, maxWidth: 240 }}>“{l.validationReason}”</div>}
                          <button onClick={() => { setRegularizing(l); setNote('') }} style={btnSmall}>Regularizar</button>
                        </div>
                      ) : caps.data?.canReclassify ? (
                        <select defaultValue="" onChange={(e) => e.target.value && doReclassify(l.id, e.target.value)} style={{ ...selectStyle(), fontSize: 12 }}>
                          <option value="">Classificar como…</option>
                          {CDE_OFFICIAL_CATEGORIES.map((c) => <option key={c} value={c}>{CDE_CATEGORY_LABELS[c]}</option>)}
                        </select>
                      ) : (
                        <span style={{ fontSize: 12, color: '#94a3b8' }}>Aguardando administrador</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {(data.meta?.totalPages ?? 0) > 1 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderTop: '1px solid #f1f5f9' }}>
              <span style={{ fontSize: 13, color: '#64748b' }}>Página {data.meta.page} de {data.meta.totalPages} · {data.meta.total} item(ns)</span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button disabled={!data.meta.hasPrev} onClick={() => setPage((p) => p - 1)} style={pageBtn(!data.meta.hasPrev)}>← Anterior</button>
                <button disabled={!data.meta.hasNext} onClick={() => setPage((p) => p + 1)} style={pageBtn(!data.meta.hasNext)}>Próxima →</button>
              </div>
            </div>
          )}
        </Card>
      )}

      {regularizing && (
        <div style={overlay} onClick={() => setRegularizing(null)}>
          <div style={modal} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 4px', fontSize: 17, color: '#0f172a' }}>Regularizar item incorreto</h3>
            <p style={{ margin: '0 0 16px', fontSize: 13, color: '#64748b' }}>Doc. {regularizing.documento} — {regularizing.store?.code}</p>
            <label style={lbl}>Tratativa registrada <span style={{ color: '#dc2626' }}>*</span></label>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} style={textarea} placeholder="Descreva como a divergência foi tratada…" />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button onClick={() => setRegularizing(null)} style={btnOutline}>Cancelar</button>
              <button onClick={doRegularize} disabled={note.trim().length < 3 || regularize.isLoading} style={{ ...btnPrimary, opacity: note.trim().length < 3 ? 0.5 : 1 }}>
                {regularize.isLoading ? 'Salvando…' : 'Confirmar regularização'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const thS: React.CSSProperties = { textAlign: 'left', padding: '9px 12px', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', whiteSpace: 'nowrap' }
const tdS: React.CSSProperties = { padding: '10px 12px', color: '#374151', verticalAlign: 'top' }
const btnPrimary: React.CSSProperties = { padding: '8px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600, background: '#2563eb', color: 'white', border: 'none', cursor: 'pointer' }
const btnOutline: React.CSSProperties = { padding: '9px 16px', borderRadius: 8, fontSize: 14, fontWeight: 500, background: 'white', color: '#374151', border: '1px solid #d1d5db', cursor: 'pointer' }
const btnSmall: React.CSSProperties = { padding: '5px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600, background: '#dbeafe', color: '#1d4ed8', border: 'none', cursor: 'pointer' }
const pageBtn = (disabled: boolean): React.CSSProperties => ({ padding: '6px 12px', borderRadius: 8, fontSize: 13, border: '1px solid #d1d5db', background: 'white', color: '#374151', cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1 })
const overlay: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16 }
const modal: React.CSSProperties = { background: 'white', borderRadius: 14, padding: 24, width: '100%', maxWidth: 460, boxShadow: '0 10px 40px rgba(0,0,0,0.2)' }
const lbl: React.CSSProperties = { display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', margin: '0 0 6px' }
const textarea: React.CSSProperties = { width: '100%', padding: 10, borderRadius: 8, border: '1px solid #d1d5db', fontSize: 14, marginBottom: 14, resize: 'vertical', boxSizing: 'border-box' }
