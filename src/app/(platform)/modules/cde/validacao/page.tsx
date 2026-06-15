'use client'

export const dynamic = 'force-dynamic'

import { useMemo, useState } from 'react'
import { trpc } from '@/lib/trpc'
import { formatNumber, formatDate } from '@/lib/utils'
import { CDE_STATUS_LABELS } from '@/modules/cde/constants'
import { CdeTabs, Card, CategoryBadge, StatusBadge, NatureBadge, selectStyle } from '../_components'

type Action = 'CORRECT' | 'INCORRECT' | 'FORWARDED_AUDIT'

interface PendingTarget {
  scope: 'line' | 'document'
  action: Action
  lineId?: string
  documento?: string
  storeId?: string
  date?: Date
  label: string
}

export default function CdeValidacaoPage() {
  const [storeId, setStoreId] = useState('')
  const [status, setStatus] = useState('PENDING_VALIDATION')
  const [page, setPage] = useState(1)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [target, setTarget] = useState<PendingTarget | null>(null)

  const { data: stores } = trpc.cde.accessibleStores.useQuery()
  const { data, isLoading, refetch } = trpc.cde.listDocuments.useQuery({
    page, pageSize: 15, storeId: storeId || undefined, status: status || undefined,
  })
  const utils = trpc.useUtils()

  const validateLine = trpc.cde.validateLine.useMutation()
  const validateDocument = trpc.cde.validateDocument.useMutation()

  function quickAction(scope: 'line' | 'document', action: Action, ctx: Partial<PendingTarget>) {
    if (action === 'CORRECT') {
      // Correto não exige campos adicionais — executa direto.
      runAction({ scope, action, ...ctx, label: '' } as PendingTarget, '', '')
    } else {
      setTarget({ scope, action, label: ctx.label ?? '', ...ctx } as PendingTarget)
    }
  }

  async function runAction(t: PendingTarget, reason: string, attachmentRef: string) {
    try {
      if (t.scope === 'line') {
        await validateLine.mutateAsync({ id: t.lineId!, action: t.action, reason: reason || undefined, attachmentRef: attachmentRef || undefined })
      } else {
        await validateDocument.mutateAsync({
          documento: t.documento!, storeId: t.storeId!, date: t.date!,
          action: t.action, reason: reason || undefined, attachmentRef: attachmentRef || undefined,
        })
      }
      setTarget(null)
      await refetch()
      utils.cde.dashboard.invalidate()
    } catch (e: any) {
      alert(e.message)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div>
        <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#0f172a', margin: '0 0 4px' }}>Validação — CDE</h1>
        <p style={{ fontSize: '14px', color: '#64748b', margin: 0 }}>
          Movimentações agrupadas por documento. Valide o documento inteiro em bloco ou abra para validar linha a linha.
        </p>
      </div>
      <CdeTabs />

      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <select value={storeId} onChange={(e) => { setStoreId(e.target.value); setPage(1) }} style={selectStyle()}>
          <option value="">Todas as lojas acessíveis</option>
          {stores?.map((s) => <option key={s.id} value={s.id}>{s.code} — {s.name}</option>)}
        </select>
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1) }} style={selectStyle()}>
          <option value="">Todos os status</option>
          {Object.entries(CDE_STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      {isLoading ? (
        <Card style={{ padding: '48px', textAlign: 'center', color: '#94a3b8' }}>Carregando…</Card>
      ) : !data?.documents.length ? (
        <Card style={{ padding: '48px', textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>📭</div>
          <p style={{ color: '#374151', fontWeight: 600, margin: '0 0 4px' }}>Nenhum documento para validar</p>
          <p style={{ color: '#94a3b8', fontSize: 14, margin: 0 }}>Ajuste os filtros ou importe novas movimentações.</p>
        </Card>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {data.documents.map((doc) => {
            const isOpen = expanded === doc.key
            const blocked = doc.hasPendingParam
            return (
              <Card key={doc.key} style={{ overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 18px', flexWrap: 'wrap' }}>
                  <button onClick={() => setExpanded(isOpen ? null : doc.key)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16 }}>
                    {isOpen ? '▾' : '▸'}
                  </button>
                  <div style={{ minWidth: 160 }}>
                    <div style={{ fontWeight: 700, color: '#0f172a' }}>Doc. {doc.documento}</div>
                    <div style={{ fontSize: 12, color: '#94a3b8' }}>{doc.store?.code} — {doc.store?.name} · {formatDate(doc.date)}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{ fontSize: 13, color: '#64748b' }}>{doc.lineCount} linha(s)</span>
                    <StatusBadge status={doc.groupStatus} />
                    {blocked && <span style={{ fontSize: 12, color: '#b91c1c' }}>🚧 contém itens pendentes de parametrização</span>}
                  </div>
                  <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                    <ActionBtn color="#16a34a" onClick={() => quickAction('document', 'CORRECT', { documento: doc.documento, storeId: doc.store!.id, date: new Date(doc.date), label: `Documento ${doc.documento}` })}>Correto</ActionBtn>
                    <ActionBtn color="#dc2626" onClick={() => quickAction('document', 'INCORRECT', { documento: doc.documento, storeId: doc.store!.id, date: new Date(doc.date), label: `Documento ${doc.documento}` })}>Incorreto</ActionBtn>
                    <ActionBtn color="#7c3aed" onClick={() => quickAction('document', 'FORWARDED_AUDIT', { documento: doc.documento, storeId: doc.store!.id, date: new Date(doc.date), label: `Documento ${doc.documento}` })}>Auditoria</ActionBtn>
                  </div>
                </div>

                {isOpen && (
                  <div style={{ overflowX: 'auto', borderTop: '1px solid #f1f5f9' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                      <thead>
                        <tr style={{ background: '#f8fafc' }}>
                          {['Movimentação', 'Descrição', 'Qtd.', 'Natureza', 'Categoria', 'Status', 'Ações'].map((h) => <th key={h} style={thS}>{h}</th>)}
                        </tr>
                      </thead>
                      <tbody>
                        {doc.lines.map((l: any) => (
                          <tr key={l.id} style={{ borderBottom: '1px solid #f8fafc', background: l.status === 'PENDING_PARAM' ? '#fff7f7' : 'white' }}>
                            <td style={tdS}>{l.movimentacao ?? '—'}</td>
                            <td style={{ ...tdS, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.descricao ?? '—'}</td>
                            <td style={{ ...tdS, textAlign: 'right', color: Number(l.qtdMovimento) >= 0 ? '#16a34a' : '#dc2626', fontWeight: 600 }}>{formatNumber(Number(l.qtdMovimento), 2)}</td>
                            <td style={tdS}><NatureBadge nature={l.nature} /></td>
                            <td style={tdS}><CategoryBadge category={l.category} /></td>
                            <td style={tdS}><StatusBadge status={l.status} /></td>
                            <td style={tdS}>
                              {l.status === 'PENDING_PARAM' ? (
                                <span style={{ fontSize: 12, color: '#b91c1c' }}>Bloqueado</span>
                              ) : (
                                <div style={{ display: 'flex', gap: 4 }}>
                                  <MiniBtn color="#16a34a" onClick={() => quickAction('line', 'CORRECT', { lineId: l.id, label: `Linha ${l.documento}` })}>✓</MiniBtn>
                                  <MiniBtn color="#dc2626" onClick={() => quickAction('line', 'INCORRECT', { lineId: l.id, label: `Linha ${l.documento}` })}>✗</MiniBtn>
                                  <MiniBtn color="#7c3aed" onClick={() => quickAction('line', 'FORWARDED_AUDIT', { lineId: l.id, label: `Linha ${l.documento}` })}>⚑</MiniBtn>
                                </div>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            )
          })}

          {(data.meta?.totalPages ?? 0) > 1 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8 }}>
              <span style={{ fontSize: 13, color: '#64748b' }}>Página {data.meta.page} de {data.meta.totalPages}</span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button disabled={!data.meta.hasPrev} onClick={() => setPage((p) => p - 1)} style={pageBtn(!data.meta.hasPrev)}>← Anterior</button>
                <button disabled={!data.meta.hasNext} onClick={() => setPage((p) => p + 1)} style={pageBtn(!data.meta.hasNext)}>Próxima →</button>
              </div>
            </div>
          )}
        </div>
      )}

      {target && (
        <ActionModal
          target={target}
          onCancel={() => setTarget(null)}
          onConfirm={(reason, att) => runAction(target, reason, att)}
          loading={validateLine.isLoading || validateDocument.isLoading}
        />
      )}
    </div>
  )
}

function ActionModal({ target, onCancel, onConfirm, loading }: {
  target: PendingTarget; onCancel: () => void; onConfirm: (reason: string, att: string) => void; loading: boolean
}) {
  const [reason, setReason] = useState('')
  const [att, setAtt] = useState('')
  const isForward = target.action === 'FORWARDED_AUDIT'
  const reasonRequired = target.action === 'INCORRECT' || isForward
  const valid = (!reasonRequired || reason.trim().length >= 3) && (!isForward || att.trim().length > 0)

  return (
    <div style={overlay} onClick={onCancel}>
      <div style={modal} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ margin: '0 0 4px', fontSize: 17, color: '#0f172a' }}>
          {target.action === 'INCORRECT' ? 'Marcar como Incorreto' : 'Encaminhar para auditoria'}
        </h3>
        <p style={{ margin: '0 0 16px', fontSize: 13, color: '#64748b' }}>{target.label}</p>

        <label style={lbl}>Justificativa {reasonRequired && <span style={{ color: '#dc2626' }}>*</span>}</label>
        <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} style={textarea} placeholder="Descreva o motivo…" />

        {isForward && (
          <>
            <label style={lbl}>Anexo / evidência (link ou descrição) <span style={{ color: '#dc2626' }}>*</span></label>
            <input value={att} onChange={(e) => setAtt(e.target.value)} style={input} placeholder="URL do anexo ou descrição da evidência" />
          </>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18 }}>
          <button onClick={onCancel} style={btnOutline}>Cancelar</button>
          <button onClick={() => onConfirm(reason, att)} disabled={!valid || loading} style={{ ...btnPrimary, opacity: !valid || loading ? 0.5 : 1 }}>
            {loading ? 'Salvando…' : 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  )
}

function ActionBtn({ color, children, onClick }: { color: string; children: React.ReactNode; onClick: () => void }) {
  return <button onClick={onClick} style={{ padding: '6px 12px', borderRadius: 8, fontSize: 13, fontWeight: 600, color: 'white', background: color, border: 'none', cursor: 'pointer' }}>{children}</button>
}
function MiniBtn({ color, children, onClick }: { color: string; children: React.ReactNode; onClick: () => void }) {
  return <button onClick={onClick} style={{ width: 26, height: 26, borderRadius: 6, fontSize: 13, color: 'white', background: color, border: 'none', cursor: 'pointer' }}>{children}</button>
}

const thS: React.CSSProperties = { textAlign: 'left', padding: '8px 12px', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', whiteSpace: 'nowrap' }
const tdS: React.CSSProperties = { padding: '8px 12px', color: '#374151' }
const pageBtn = (disabled: boolean): React.CSSProperties => ({ padding: '6px 12px', borderRadius: 8, fontSize: 13, border: '1px solid #d1d5db', background: 'white', color: '#374151', cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1 })
const overlay: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16 }
const modal: React.CSSProperties = { background: 'white', borderRadius: 14, padding: 24, width: '100%', maxWidth: 460, boxShadow: '0 10px 40px rgba(0,0,0,0.2)' }
const lbl: React.CSSProperties = { display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', margin: '0 0 6px' }
const textarea: React.CSSProperties = { width: '100%', padding: 10, borderRadius: 8, border: '1px solid #d1d5db', fontSize: 14, marginBottom: 14, resize: 'vertical', boxSizing: 'border-box' }
const input: React.CSSProperties = { width: '100%', padding: 10, borderRadius: 8, border: '1px solid #d1d5db', fontSize: 14, marginBottom: 14, boxSizing: 'border-box' }
const btnPrimary: React.CSSProperties = { padding: '9px 16px', borderRadius: 8, fontSize: 14, fontWeight: 600, background: '#2563eb', color: 'white', border: 'none', cursor: 'pointer' }
const btnOutline: React.CSSProperties = { padding: '9px 16px', borderRadius: 8, fontSize: 14, fontWeight: 500, background: 'white', color: '#374151', border: '1px solid #d1d5db', cursor: 'pointer' }
