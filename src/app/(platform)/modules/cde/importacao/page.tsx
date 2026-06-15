'use client'

export const dynamic = 'force-dynamic'

import { useRef, useState } from 'react'
import { trpc } from '@/lib/trpc'
import { formatNumber } from '@/lib/utils'
import { CdeTabs, Card, Kpi, CategoryBadge, NatureBadge, selectStyle } from '../_components'

interface PreviewRow {
  rowNumber: number
  loja: string | null
  movimentacao: string | null
  documento: string
  descricao: string | null
  qtdMovimento: number
  nature: string
  category: string
}

interface PreviewData {
  fileName: string
  fileSize: number
  fileHash: string
  rows: PreviewRow[]
  summary: {
    total: number
    blankRows: number
    byNature: { ENTRADA: number; SAIDA: number; NEUTRA: number }
    pendingParam: number
    documents: number
    stores: number
  }
}

function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function CdeImportacaoPage() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<PreviewData | null>(null)
  const [refDate, setRefDate] = useState(todayStr())
  const [result, setResult] = useState<any>(null)
  const [natureFilter, setNatureFilter] = useState('ALL')

  const caps = trpc.cde.myCapabilities.useQuery()
  const commit = trpc.cde.importCommit.useMutation()
  const utils = trpc.useUtils()

  async function processFile(file: File) {
    if (!file.name.match(/\.(xlsx|xls)$/i)) { setError('Apenas arquivos .xlsx ou .xls são aceitos.'); return }
    setLoading(true); setError(null); setResult(null)
    try {
      const fd = new FormData(); fd.append('file', file)
      const res = await fetch('/api/cde-import', { method: 'POST', body: fd })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Erro ao processar planilha.')
      setPreview(json)
    } catch (e: any) { setError(e.message); setPreview(null) } finally { setLoading(false) }
  }

  async function confirmImport(force = false) {
    if (!preview) return
    setError(null)
    try {
      const r = await commit.mutateAsync({
        fileName: preview.fileName,
        fileSize: preview.fileSize,
        fileHash: preview.fileHash,
        referenceDate: new Date(refDate + 'T12:00:00'),
        force,
        rows: preview.rows.map((row) => ({
          loja: row.loja, movimentacao: row.movimentacao, documento: row.documento,
          descricao: row.descricao, qtdMovimento: row.qtdMovimento,
          // demais campos brutos preservados
          ...(row as any),
        })),
      })
      setResult(r)
      if (!r.duplicate) {
        utils.cde.dashboard.invalidate()
        utils.cde.importHistory.invalidate()
      }
    } catch (e: any) { setError(e.message) }
  }

  function reset() { setPreview(null); setResult(null); setError(null) }

  const filtered = (preview?.rows ?? []).filter((r) => natureFilter === 'ALL' || r.nature === natureFilter)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div>
        <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#0f172a', margin: '0 0 4px' }}>Importação — CDE</h1>
        <p style={{ fontSize: '14px', color: '#64748b', margin: 0 }}>
          Importe a planilha de movimentações. A natureza é definida pela coluna <b>Qtd. movimento</b> e a categoria
          gerencial é atribuída automaticamente.
        </p>
      </div>
      <CdeTabs />

      {caps.data && !caps.data.canImport && (
        <Card style={{ padding: '16px', background: '#fff7ed', border: '1px solid #fed7aa', color: '#9a3412' }}>
          Seu perfil não tem permissão para importar planilhas. Apenas Auditor e Administrador podem importar.
        </Card>
      )}

      {/* Resultado da confirmação */}
      {result && !result.duplicate && (
        <Card style={{ padding: '20px', background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
          <h3 style={{ margin: '0 0 8px', color: '#15803d', fontSize: '16px' }}>✅ Importação concluída</h3>
          <p style={{ margin: 0, color: '#166534', fontSize: '14px' }}>
            {result.published} linha(s) publicada(s){result.invalid > 0 ? `, ${result.invalid} com erro` : ''}
            {result.pendingParam > 0 ? ` — ${result.pendingParam} pendente(s) de parametrização.` : '.'}
          </p>
          {result.errors?.length > 0 && (
            <ul style={{ margin: '10px 0 0', paddingLeft: 18, color: '#b91c1c', fontSize: '13px' }}>
              {result.errors.slice(0, 10).map((e: any, i: number) => <li key={i}>Linha {e.rowNumber}: {e.message}</li>)}
            </ul>
          )}
          <button onClick={reset} style={btnOutline}>Nova importação</button>
        </Card>
      )}

      {result?.duplicate && (
        <Card style={{ padding: '20px', background: '#fffbeb', border: '1px solid #fde68a' }}>
          <h3 style={{ margin: '0 0 8px', color: '#b45309', fontSize: '16px' }}>⚠️ Arquivo já importado</h3>
          <p style={{ margin: '0 0 12px', color: '#92400e', fontSize: '14px' }}>{result.message}</p>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={() => confirmImport(true)} disabled={commit.isLoading} style={btnDanger}>Importar mesmo assim</button>
            <button onClick={reset} style={btnOutline}>Cancelar</button>
          </div>
        </Card>
      )}

      {error && (
        <Card style={{ padding: '14px 18px', background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', fontSize: '14px' }}>
          ⚠️ {error}
        </Card>
      )}

      {/* Upload */}
      {!preview && !result && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); if (e.dataTransfer.files[0]) processFile(e.dataTransfer.files[0]) }}
          onClick={() => inputRef.current?.click()}
          style={{
            border: `2px dashed ${dragging ? '#3b82f6' : '#cbd5e1'}`, borderRadius: '16px',
            background: dragging ? '#eff6ff' : '#f8fafc', padding: '56px 24px', textAlign: 'center', cursor: 'pointer',
          }}
        >
          <input ref={inputRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }}
            onChange={(e) => e.target.files?.[0] && processFile(e.target.files[0])} />
          <div style={{ fontSize: '48px', marginBottom: '12px' }}>{loading ? '⏳' : '📥'}</div>
          <p style={{ fontSize: '17px', fontWeight: 600, color: '#1e293b', margin: '0 0 8px' }}>
            {loading ? 'Processando planilha…' : 'Arraste a planilha ou clique para selecionar'}
          </p>
          <p style={{ fontSize: '14px', color: '#64748b', margin: 0 }}>
            Colunas esperadas: Loja, Movimentação, Local, Lançamento, Movimento, Cod., Descrição, Documento, Complemento, Saldo anterior, Qtd. movimento, Saldo atual
          </p>
        </div>
      )}

      {/* Pré-visualização */}
      {preview && !result && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '14px' }}>
            <Kpi label="Linhas" value={formatNumber(preview.summary.total, 0)} icon="📋" sub={preview.fileName.slice(0, 24)} />
            <Kpi label="Documentos" value={formatNumber(preview.summary.documents, 0)} icon="🧾" />
            <Kpi label="Entradas" value={formatNumber(preview.summary.byNature.ENTRADA, 0)} color="#16a34a" icon="⬆️" />
            <Kpi label="Saídas" value={formatNumber(preview.summary.byNature.SAIDA, 0)} color="#dc2626" icon="⬇️" />
            <Kpi label="Neutras" value={formatNumber(preview.summary.byNature.NEUTRA, 0)} color="#64748b" icon="➖" />
            <Kpi label="Pend. parametr." value={formatNumber(preview.summary.pendingParam, 0)} color="#b91c1c" icon="🚧" />
          </div>

          <Card style={{ padding: '16px 20px', display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
            <label style={{ fontSize: '13px', color: '#374151', display: 'flex', alignItems: 'center', gap: '8px' }}>
              Data de referência
              <input type="date" value={refDate} onChange={(e) => setRefDate(e.target.value)} style={selectStyle()} />
            </label>
            <select value={natureFilter} onChange={(e) => setNatureFilter(e.target.value)} style={selectStyle()}>
              <option value="ALL">Todas as naturezas</option>
              <option value="ENTRADA">Entradas</option>
              <option value="SAIDA">Saídas</option>
              <option value="NEUTRA">Neutras</option>
            </select>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
              <button onClick={reset} style={btnOutline}>Cancelar</button>
              <button onClick={() => confirmImport(false)} disabled={commit.isLoading || !caps.data?.canImport} style={btnPrimary}>
                {commit.isLoading ? 'Importando…' : `Confirmar importação (${preview.summary.total})`}
              </button>
            </div>
          </Card>

          <Card style={{ overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto', maxHeight: 520 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead style={{ position: 'sticky', top: 0 }}>
                  <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                    {['#', 'Loja', 'Movimentação', 'Documento', 'Descrição', 'Qtd. mov.', 'Natureza', 'Categoria'].map((h) => (
                      <th key={h} style={thS}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.slice(0, 500).map((r) => (
                    <tr key={r.rowNumber} style={{ borderBottom: '1px solid #f1f5f9', background: r.category === 'PENDENTE_PARAM' ? '#fff7f7' : 'white' }}>
                      <td style={tdS}>{r.rowNumber}</td>
                      <td style={tdS}>{r.loja ?? '—'}</td>
                      <td style={tdS}>{r.movimentacao ?? '—'}</td>
                      <td style={{ ...tdS, fontWeight: 600, color: '#0f172a' }}>{r.documento}</td>
                      <td style={{ ...tdS, maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.descricao ?? '—'}</td>
                      <td style={{ ...tdS, textAlign: 'right', color: r.qtdMovimento >= 0 ? '#16a34a' : '#dc2626', fontWeight: 600 }}>{formatNumber(r.qtdMovimento, 2)}</td>
                      <td style={tdS}><NatureBadge nature={r.nature} /></td>
                      <td style={tdS}><CategoryBadge category={r.category} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {filtered.length > 500 && (
              <div style={{ padding: '10px 16px', fontSize: '12px', color: '#94a3b8', borderTop: '1px solid #f1f5f9' }}>
                Exibindo as primeiras 500 de {filtered.length} linhas. Todas serão importadas.
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  )
}

const thS: React.CSSProperties = { textAlign: 'left', padding: '9px 12px', fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', whiteSpace: 'nowrap' }
const tdS: React.CSSProperties = { padding: '9px 12px', color: '#374151', whiteSpace: 'nowrap' }
const btnPrimary: React.CSSProperties = { padding: '9px 16px', borderRadius: '8px', fontSize: '14px', fontWeight: 600, background: '#2563eb', color: 'white', border: 'none', cursor: 'pointer' }
const btnOutline: React.CSSProperties = { padding: '9px 16px', borderRadius: '8px', fontSize: '14px', fontWeight: 500, background: 'white', color: '#374151', border: '1px solid #d1d5db', cursor: 'pointer', marginTop: 12 }
const btnDanger: React.CSSProperties = { padding: '9px 16px', borderRadius: '8px', fontSize: '14px', fontWeight: 600, background: '#dc2626', color: 'white', border: 'none', cursor: 'pointer' }
