'use client'

export const dynamic = 'force-dynamic'

import { useRef, useState, useMemo } from 'react'
import { formatCurrency } from '@/lib/utils'

interface NoteRow {
  codigoLoja: string
  codigoFornecedor: string
  nomeFornecedor: string
  nomeLoja: string
  empresa: string
  numeroDocumento: string
  dataEmissao: string | null
  valorTotal: number
  leadTime: number
  tipo: 'INDUSTRIA' | 'TRANSFERENCIA'
  tipoLabel: string
  situacao: string
  situacaoLabel: string
  dataEntrega: string
  diasAtraso: number
}

type SortField = 'diasAtraso' | 'dataEmissao' | 'valorTotal' | 'dataEntrega'
type SortDir = 'asc' | 'desc'

function formatDateBR(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function diasAtrasoDisplay(dias: number) {
  if (dias < 0) return { label: String(dias), bg: '#fee2e2', color: '#b91c1c', fontWeight: '700' }
  if (dias === 0) return { label: '0', bg: '#fef3c7', color: '#b45309', fontWeight: '700' }
  return { label: `+${dias}`, bg: '#f0fdf4', color: '#15803d', fontWeight: '600' }
}

function situacaoBadge(s: string) {
  if (s === 'INCONSISTENTE') return { bg: '#fee2e2', color: '#b91c1c' }
  if (s === 'PENDENTE_ENTREGA') return { bg: '#dbeafe', color: '#1d4ed8' }
  return { bg: '#fef3c7', color: '#92400e' }
}

function tipoBadge(t: string) {
  return t === 'INDUSTRIA'
    ? { bg: '#ede9fe', color: '#6d28d9' }
    : { bg: '#e0f2fe', color: '#0369a1' }
}

function KpiCard({ label, value, sub, color, icon }: {
  label: string; value: string | number; sub?: string; color: string; icon: string
}) {
  return (
    <div style={{
      background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px',
      padding: '18px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
    }}>
      <div style={{ fontSize: '20px', marginBottom: '6px' }}>{icon}</div>
      <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '2px' }}>{label}</div>
      <div style={{ fontSize: '26px', fontWeight: '700', color, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>{sub}</div>}
    </div>
  )
}

function SortIcon({ field, sortField, sortDir }: { field: SortField; sortField: SortField; sortDir: SortDir }) {
  if (field !== sortField) return <span style={{ color: '#ffffff60', marginLeft: '4px' }}>⇅</span>
  return <span style={{ color: 'white', marginLeft: '4px' }}>{sortDir === 'asc' ? '↑' : '↓'}</span>
}

const HEADER_BG = '#15803d'
const HEADER_TEXT = '#ffffff'

export default function NoteTransitPage() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notes, setNotes] = useState<NoteRow[] | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)

  const [filterTipo, setFilterTipo] = useState<'ALL' | 'INDUSTRIA' | 'TRANSFERENCIA'>('ALL')
  const [filterSituacao, setFilterSituacao] = useState('ALL')
  const [filterEmpresa, setFilterEmpresa] = useState('ALL')
  const [sortField, setSortField] = useState<SortField>('diasAtraso')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [search, setSearch] = useState('')

  async function processFile(file: File) {
    if (!file.name.match(/\.(xlsx|xls)$/i)) {
      setError('Apenas arquivos .xlsx ou .xls são aceitos.')
      return
    }
    setLoading(true)
    setError(null)
    setFileName(file.name)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/note-transit-import', { method: 'POST', body: fd })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Erro desconhecido')
      setNotes(json.notes)
    } catch (e: any) {
      setError(e.message)
      setNotes(null)
    } finally {
      setLoading(false)
    }
  }

  function handleFile(files: FileList | null) {
    if (files?.[0]) processFile(files[0])
  }

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDir('asc')
    }
  }

  const empresas = useMemo(() => {
    if (!notes) return []
    return Array.from(new Set(notes.map(n => n.empresa).filter(Boolean))).sort()
  }, [notes])

  const filtered = useMemo(() => {
    if (!notes) return []
    return notes
      .filter(n => filterTipo === 'ALL' || n.tipo === filterTipo)
      .filter(n => filterSituacao === 'ALL' || n.situacao === filterSituacao)
      .filter(n => filterEmpresa === 'ALL' || n.empresa === filterEmpresa)
      .filter(n => {
        if (!search) return true
        const q = search.toLowerCase()
        return (
          n.nomeLoja.toLowerCase().includes(q) ||
          n.nomeFornecedor.toLowerCase().includes(q) ||
          n.codigoLoja.includes(q) ||
          n.empresa.toLowerCase().includes(q) ||
          n.numeroDocumento.includes(q)
        )
      })
      .sort((a, b) => {
        let cmp = 0
        if (sortField === 'diasAtraso') cmp = a.diasAtraso - b.diasAtraso
        else if (sortField === 'dataEmissao') cmp = (a.dataEmissao ?? '').localeCompare(b.dataEmissao ?? '')
        else if (sortField === 'dataEntrega') cmp = a.dataEntrega.localeCompare(b.dataEntrega)
        else if (sortField === 'valorTotal') cmp = a.valorTotal - b.valorTotal
        return sortDir === 'asc' ? cmp : -cmp
      })
  }, [notes, filterTipo, filterSituacao, filterEmpresa, search, sortField, sortDir])

  const kpis = useMemo(() => {
    const all = notes ?? []
    return {
      total: all.length,
      atrasadas: all.filter(n => n.diasAtraso < 0).length,
      industria: all.filter(n => n.tipo === 'INDUSTRIA').length,
      transferencia: all.filter(n => n.tipo === 'TRANSFERENCIA').length,
      valorTotal: all.reduce((s, n) => s + n.valorTotal, 0),
    }
  }, [notes])

  const thStyle = (field?: SortField): React.CSSProperties => ({
    padding: '11px 14px',
    textAlign: 'left',
    fontSize: '11px',
    fontWeight: '700',
    color: HEADER_TEXT,
    background: HEADER_BG,
    whiteSpace: 'nowrap',
    userSelect: 'none',
    cursor: field ? 'pointer' : 'default',
    borderRight: '1px solid #166534',
    letterSpacing: '0.03em',
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: '700', color: '#0f172a', margin: '0 0 4px' }}>
            Trânsito de Notas
          </h1>
          <p style={{ fontSize: '14px', color: '#64748b', margin: 0 }}>
            Importe a planilha para visualizar notas em trânsito. Indústria: 7 dias · Transferência: 4 dias.
          </p>
        </div>
        {notes && (
          <button
            onClick={() => { setNotes(null); setFileName(null); setError(null); setSearch('') }}
            style={{
              padding: '8px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: '600',
              border: '1px solid #d1d5db', background: 'white', color: '#374151', cursor: 'pointer',
            }}
          >
            ↩ Nova Importação
          </button>
        )}
      </div>

      {/* Upload */}
      {!notes && (
        <div
          onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={e => { e.preventDefault(); setIsDragging(false); handleFile(e.dataTransfer.files) }}
          onClick={() => !loading && inputRef.current?.click()}
          style={{
            border: `2px dashed ${isDragging ? '#15803d' : '#cbd5e1'}`,
            borderRadius: '16px',
            background: isDragging ? '#f0fdf4' : '#f8fafc',
            padding: '60px 24px',
            textAlign: 'center',
            cursor: loading ? 'wait' : 'pointer',
            transition: 'all 0.2s',
          }}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls"
            style={{ display: 'none' }}
            onChange={e => handleFile(e.target.files)}
          />
          {loading ? (
            <>
              <div style={{ fontSize: '40px', marginBottom: '12px' }}>⏳</div>
              <p style={{ fontSize: '16px', fontWeight: '600', color: '#374151', margin: '0 0 6px' }}>
                Processando planilha...
              </p>
              <p style={{ fontSize: '13px', color: '#94a3b8', margin: 0 }}>
                Aplicando filtros: Compras Cálamo · Transferências · Situações pendentes
              </p>
            </>
          ) : (
            <>
              <div style={{ fontSize: '52px', marginBottom: '16px' }}>📊</div>
              <p style={{ fontSize: '18px', fontWeight: '700', color: '#1e293b', margin: '0 0 8px' }}>
                Arraste a planilha aqui ou clique para selecionar
              </p>
              <p style={{ fontSize: '14px', color: '#64748b', margin: '0 0 20px' }}>
                Arquivo Excel (.xlsx) exportado do sistema de notas fiscais
              </p>
              <span style={{
                display: 'inline-block', padding: '10px 28px', borderRadius: '8px',
                background: HEADER_BG, color: 'white', fontSize: '14px', fontWeight: '700',
              }}>
                Selecionar Arquivo
              </span>
              <p style={{ fontSize: '12px', color: '#94a3b8', margin: '16px 0 0' }}>
                Filtros automáticos: col F = Operação · col G = Situação · Pendente / Pendente de Entrega / Inconsistente
              </p>
            </>
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{
          background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px',
          padding: '14px 18px', display: 'flex', alignItems: 'center', gap: '10px',
        }}>
          <span style={{ fontSize: '18px' }}>⚠️</span>
          <span style={{ fontSize: '14px', color: '#dc2626', fontWeight: '500' }}>{error}</span>
        </div>
      )}

      {/* Dashboard */}
      {notes && (
        <>
          {/* KPIs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '14px' }}>
            <KpiCard label="Total de Notas" value={kpis.total} color="#0f172a" icon="📋"
              sub={fileName ? fileName.slice(0, 28) : undefined} />
            <KpiCard label="Notas Atrasadas" value={kpis.atrasadas} color="#b91c1c" icon="🚨"
              sub={kpis.total > 0 ? `${Math.round(kpis.atrasadas / kpis.total * 100)}% do total` : undefined} />
            <KpiCard label="Indústria" value={kpis.industria} color="#6d28d9" icon="🏭" sub="Lead time 7 dias" />
            <KpiCard label="Transferência" value={kpis.transferencia} color="#0369a1" icon="🔄" sub="Lead time 4 dias" />
            <KpiCard label="Valor Total" value={formatCurrency(kpis.valorTotal)} color="#15803d" icon="💰" />
          </div>

          {/* Filters */}
          <div style={{
            background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)', overflow: 'hidden',
          }}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              flexWrap: 'wrap', gap: '12px', padding: '14px 18px',
              borderBottom: `3px solid ${HEADER_BG}`,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '16px' }}>🔍</span>
                <input
                  placeholder="Buscar loja, fornecedor, documento..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  style={{
                    padding: '6px 12px', borderRadius: '8px', border: '1px solid #d1d5db',
                    fontSize: '13px', color: '#374151', width: '240px', outline: 'none',
                  }}
                />
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <select value={filterEmpresa} onChange={e => setFilterEmpresa(e.target.value)}
                  style={{ padding: '6px 10px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '13px', color: '#374151' }}>
                  <option value="ALL">Todas as empresas</option>
                  {empresas.map(e => <option key={e} value={e}>{e}</option>)}
                </select>
                <select value={filterTipo} onChange={e => setFilterTipo(e.target.value as any)}
                  style={{ padding: '6px 10px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '13px', color: '#374151' }}>
                  <option value="ALL">Todos os tipos</option>
                  <option value="INDUSTRIA">Indústria</option>
                  <option value="TRANSFERENCIA">Transferência</option>
                </select>
                <select value={filterSituacao} onChange={e => setFilterSituacao(e.target.value)}
                  style={{ padding: '6px 10px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '13px', color: '#374151' }}>
                  <option value="ALL">Todas as situações</option>
                  <option value="PENDENTE">Pendente</option>
                  <option value="PENDENTE_ENTREGA">Pendente de Entrega</option>
                  <option value="INCONSISTENTE">Inconsistente</option>
                </select>
              </div>
            </div>

            {/* Table */}
            <div style={{ overflowX: 'auto' }}>
              {filtered.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '48px 24px' }}>
                  <div style={{ fontSize: '36px', marginBottom: '10px' }}>🔍</div>
                  <p style={{ fontSize: '15px', color: '#374151', fontWeight: '600', margin: '0 0 4px' }}>
                    Nenhuma nota encontrada
                  </p>
                  <p style={{ fontSize: '13px', color: '#9ca3af', margin: 0 }}>
                    Ajuste os filtros ou a busca acima
                  </p>
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr>
                      <th style={thStyle('diasAtraso')} onClick={() => handleSort('diasAtraso')}>
                        DIAS EM ATRASO <SortIcon field="diasAtraso" sortField={sortField} sortDir={sortDir} />
                      </th>
                      <th style={thStyle('dataEntrega')} onClick={() => handleSort('dataEntrega')}>
                        DIA DE ENTREGA <SortIcon field="dataEntrega" sortField={sortField} sortDir={sortDir} />
                      </th>
                      <th style={thStyle()}>LEAD TIME</th>
                      <th style={thStyle()}>EMPRESA</th>
                      <th style={thStyle()}>LOJA</th>
                      <th style={thStyle()}>CÓD. LOJA</th>
                      <th style={thStyle()}>CÓD. FORN.</th>
                      <th style={{ ...thStyle(), minWidth: '220px' }}>NOME DO FORNECEDOR</th>
                      <th style={thStyle()}>Nº DOCUMENTO</th>
                      <th style={thStyle('dataEmissao')} onClick={() => handleSort('dataEmissao')}>
                        DATA EMISSÃO <SortIcon field="dataEmissao" sortField={sortField} sortDir={sortDir} />
                      </th>
                      <th style={thStyle('valorTotal')} onClick={() => handleSort('valorTotal')}>
                        VALOR TOTAL <SortIcon field="valorTotal" sortField={sortField} sortDir={sortDir} />
                      </th>
                      <th style={thStyle()}>TIPO</th>
                      <th style={{ ...thStyle(), borderRight: 'none' }}>SITUAÇÃO</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((n, i) => {
                      const atraso = diasAtrasoDisplay(n.diasAtraso)
                      const rowBg = n.diasAtraso < 0 ? '#fff9f9' : 'white'
                      return (
                        <tr
                          key={i}
                          style={{ borderBottom: '1px solid #f1f5f9', background: rowBg }}
                          onMouseEnter={e => (e.currentTarget.style.background = '#f8fafc')}
                          onMouseLeave={e => (e.currentTarget.style.background = rowBg)}
                        >
                          <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                            <span style={{
                              display: 'inline-block', minWidth: '52px', textAlign: 'center',
                              padding: '3px 10px', borderRadius: '6px', fontSize: '13px',
                              fontWeight: atraso.fontWeight, background: atraso.bg, color: atraso.color,
                            }}>
                              {atraso.label}
                            </span>
                          </td>
                          <td style={{
                            padding: '10px 14px', whiteSpace: 'nowrap',
                            color: n.diasAtraso < 0 ? '#b91c1c' : '#374151',
                            fontWeight: n.diasAtraso < 0 ? '600' : 'normal',
                          }}>
                            {formatDateBR(n.dataEntrega)}
                          </td>
                          <td style={{ padding: '10px 14px', color: '#64748b', whiteSpace: 'nowrap', textAlign: 'center' }}>
                            {n.leadTime}d
                          </td>
                          <td style={{ padding: '10px 14px', color: '#374151', fontWeight: '600', whiteSpace: 'nowrap' }}>
                            {n.empresa || '—'}
                          </td>
                          <td style={{ padding: '10px 14px', color: '#0f172a', maxWidth: '200px' }}>
                            <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {n.nomeLoja || '—'}
                            </div>
                          </td>
                          <td style={{ padding: '10px 14px', color: '#374151', whiteSpace: 'nowrap' }}>
                            {n.codigoLoja || '—'}
                          </td>
                          <td style={{ padding: '10px 14px', color: '#374151', whiteSpace: 'nowrap', textAlign: 'center' }}>
                            {n.codigoFornecedor || '—'}
                          </td>
                          <td style={{ padding: '10px 14px', color: '#0f172a', maxWidth: '260px' }}>
                            <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {n.nomeFornecedor || '—'}
                            </div>
                          </td>
                          <td style={{ padding: '10px 14px', color: '#374151', whiteSpace: 'nowrap' }}>
                            {n.numeroDocumento || '—'}
                          </td>
                          <td style={{ padding: '10px 14px', color: '#374151', whiteSpace: 'nowrap' }}>
                            {formatDateBR(n.dataEmissao)}
                          </td>
                          <td style={{ padding: '10px 14px', color: '#0f172a', fontWeight: '600', whiteSpace: 'nowrap' }}>
                            {formatCurrency(n.valorTotal)}
                          </td>
                          <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                            <span style={{
                              display: 'inline-block', padding: '2px 10px', borderRadius: '99px',
                              fontSize: '11px', fontWeight: '600',
                              ...tipoBadge(n.tipo),
                            }}>
                              {n.tipoLabel}
                            </span>
                          </td>
                          <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                            <span style={{
                              display: 'inline-block', padding: '2px 10px', borderRadius: '99px',
                              fontSize: '11px', fontWeight: '600',
                              ...situacaoBadge(n.situacao),
                            }}>
                              {n.situacaoLabel}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* Footer */}
            {filtered.length > 0 && (
              <div style={{
                display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px',
                padding: '10px 18px', borderTop: '1px solid #f1f5f9',
                background: '#f8fafc', fontSize: '13px', color: '#64748b',
              }}>
                <span>
                  {filtered.length} nota{filtered.length !== 1 ? 's' : ''} exibida{filtered.length !== 1 ? 's' : ''}
                  {filtered.length !== notes!.length && ` (de ${notes!.length} importadas)`}
                </span>
                <span style={{ fontWeight: '600', color: '#0f172a' }}>
                  Valor filtrado: {formatCurrency(filtered.reduce((s, n) => s + n.valorTotal, 0))}
                </span>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
