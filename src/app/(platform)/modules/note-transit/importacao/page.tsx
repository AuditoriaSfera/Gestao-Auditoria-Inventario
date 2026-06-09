'use client'

export const dynamic = 'force-dynamic'

import { useRef, useState } from 'react'
import { formatDate, formatCurrency } from '@/lib/utils'

interface NoteRow {
  codigoLoja: string
  codigoFornecedor: string
  nomeFornecedor: string
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

function diasAtrasoColor(dias: number) {
  if (dias > 0) return { bg: '#fee2e2', text: '#dc2626', border: '#fecaca' }
  if (dias === 0) return { bg: '#fef3c7', text: '#b45309', border: '#fde68a' }
  return { bg: '#f0fdf4', text: '#15803d', border: '#bbf7d0' }
}

function diasAtrasoLabel(dias: number) {
  if (dias > 0) return `+${dias}d atrasado`
  if (dias === 0) return 'Hoje'
  return `${Math.abs(dias)}d restantes`
}

function situacaoStyle(s: string) {
  if (s === 'INCONSISTENTE') return { bg: '#fee2e2', text: '#dc2626' }
  if (s === 'PENDENTE_ENTREGA') return { bg: '#dbeafe', text: '#1d4ed8' }
  return { bg: '#fef3c7', text: '#92400e' }
}

function tipoStyle(t: string) {
  if (t === 'INDUSTRIA') return { bg: '#ede9fe', text: '#6d28d9' }
  return { bg: '#e0f2fe', text: '#0369a1' }
}

function KpiCard({ label, value, sub, color, icon }: { label: string; value: string | number; sub?: string; color: string; icon: string }) {
  return (
    <div style={{
      background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px',
      padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
    }}>
      <div style={{ fontSize: '22px', marginBottom: '8px' }}>{icon}</div>
      <div style={{ fontSize: '13px', color: '#64748b', marginBottom: '4px' }}>{label}</div>
      <div style={{ fontSize: '28px', fontWeight: '700', color }}>{value}</div>
      {sub && <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>{sub}</div>}
    </div>
  )
}

function Badge({ label, bg, text }: { label: string; bg: string; text: string }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '2px 10px', borderRadius: '99px',
      fontSize: '12px', fontWeight: '600', background: bg, color: text,
    }}>
      {label}
    </span>
  )
}

export default function NoteTransitImportPage() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notes, setNotes] = useState<NoteRow[] | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [filterTipo, setFilterTipo] = useState<'ALL' | 'INDUSTRIA' | 'TRANSFERENCIA'>('ALL')
  const [filterSituacao, setFilterSituacao] = useState('ALL')
  const [sortBy, setSortBy] = useState<'diasAtraso' | 'dataEmissao' | 'valorTotal'>('diasAtraso')

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

  const filtered = (notes ?? [])
    .filter(n => filterTipo === 'ALL' || n.tipo === filterTipo)
    .filter(n => filterSituacao === 'ALL' || n.situacao === filterSituacao)
    .sort((a, b) => {
      if (sortBy === 'diasAtraso') return b.diasAtraso - a.diasAtraso
      if (sortBy === 'dataEmissao') return (a.dataEmissao ?? '').localeCompare(b.dataEmissao ?? '')
      return b.valorTotal - a.valorTotal
    })

  const totalAtrasadas = (notes ?? []).filter(n => n.diasAtraso > 0).length
  const totalIndustria = (notes ?? []).filter(n => n.tipo === 'INDUSTRIA').length
  const totalTransferencia = (notes ?? []).filter(n => n.tipo === 'TRANSFERENCIA').length
  const valorTotal = (notes ?? []).reduce((s, n) => s + n.valorTotal, 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: '700', color: '#0f172a', margin: '0 0 4px' }}>
            Importação de Dados — Trânsito de Notas
          </h1>
          <p style={{ fontSize: '14px', color: '#64748b', margin: 0 }}>
            Importe a planilha de notas fiscais. Indústria (7 dias) e Transferências (4 dias) são filtrados automaticamente.
          </p>
        </div>
        {notes && (
          <button
            onClick={() => { setNotes(null); setFileName(null); setError(null) }}
            style={{
              padding: '8px 14px', borderRadius: '8px', fontSize: '13px', fontWeight: '500',
              border: '1px solid #d1d5db', background: 'white', color: '#374151', cursor: 'pointer',
            }}
          >
            ↩ Nova Importação
          </button>
        )}
      </div>

      {/* Upload area */}
      {!notes && (
        <div
          onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={e => { e.preventDefault(); setIsDragging(false); handleFile(e.dataTransfer.files) }}
          onClick={() => inputRef.current?.click()}
          style={{
            border: `2px dashed ${isDragging ? '#3b82f6' : '#cbd5e1'}`,
            borderRadius: '16px',
            background: isDragging ? '#eff6ff' : '#f8fafc',
            padding: '56px 24px',
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
              <p style={{ fontSize: '14px', color: '#94a3b8', margin: 0 }}>Aguarde enquanto os dados são filtrados</p>
            </>
          ) : (
            <>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>📊</div>
              <p style={{ fontSize: '17px', fontWeight: '600', color: '#1e293b', margin: '0 0 8px' }}>
                Arraste a planilha aqui ou clique para selecionar
              </p>
              <p style={{ fontSize: '14px', color: '#64748b', margin: '0 0 20px' }}>
                Arquivo Excel (.xlsx) exportado do sistema de notas fiscais
              </p>
              <span style={{
                display: 'inline-block', padding: '10px 24px', borderRadius: '8px',
                background: '#2563eb', color: 'white', fontSize: '14px', fontWeight: '600',
              }}>
                Selecionar Arquivo
              </span>
              <p style={{ fontSize: '12px', color: '#94a3b8', margin: '16px 0 0' }}>
                Filtros automáticos: Compras Cálamo · Transferências · Pendente · Pendente de Entrega · Inconsistente
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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '16px' }}>
            <KpiCard label="Total de Notas" value={notes.length} color="#0f172a" icon="📋"
              sub={fileName ? fileName.slice(0, 30) : undefined} />
            <KpiCard label="Indústria" value={totalIndustria} color="#6d28d9" icon="🏭"
              sub="Lead time 7 dias" />
            <KpiCard label="Transferências" value={totalTransferencia} color="#0369a1" icon="🔄"
              sub="Lead time 4 dias" />
            <KpiCard label="Notas Atrasadas" value={totalAtrasadas} color="#dc2626" icon="🚨"
              sub={totalAtrasadas > 0 ? `${Math.round(totalAtrasadas / notes.length * 100)}% do total` : 'Nenhuma'} />
            <KpiCard label="Valor Total" value={formatCurrency(valorTotal)} color="#059669" icon="💰" />
          </div>

          {/* Filters + table */}
          <div style={{
            background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)', overflow: 'hidden',
          }}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap',
              gap: '12px', padding: '16px 20px', borderBottom: '1px solid #f1f5f9',
            }}>
              <h3 style={{ fontSize: '15px', fontWeight: '600', color: '#0f172a', margin: 0 }}>
                Notas em Trânsito ({filtered.length})
              </h3>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
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
                <select value={sortBy} onChange={e => setSortBy(e.target.value as any)}
                  style={{ padding: '6px 10px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '13px', color: '#374151' }}>
                  <option value="diasAtraso">Ordenar: Dias em atraso</option>
                  <option value="dataEmissao">Ordenar: Data de emissão</option>
                  <option value="valorTotal">Ordenar: Valor total</option>
                </select>
              </div>
            </div>

            <div style={{ overflowX: 'auto' }}>
              {filtered.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '48px 24px' }}>
                  <div style={{ fontSize: '36px', marginBottom: '12px' }}>🔍</div>
                  <p style={{ fontSize: '15px', color: '#374151', fontWeight: '600', margin: '0 0 6px' }}>Nenhuma nota encontrada</p>
                  <p style={{ fontSize: '13px', color: '#9ca3af', margin: 0 }}>Tente ajustar os filtros acima</p>
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                      {['Atraso', 'Prev. Entrega', 'Lead', 'Tipo', 'Cód. Loja', 'Cód. Fornecedor', 'Nome do Fornecedor', 'Data Emissão', 'Valor Total', 'Situação'].map(h => (
                        <th key={h} style={{
                          textAlign: 'left', padding: '10px 14px',
                          fontSize: '11px', fontWeight: '700', color: '#64748b',
                          whiteSpace: 'nowrap', textTransform: 'uppercase', letterSpacing: '0.04em',
                        }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((n, i) => {
                      const atrasoCor = diasAtrasoColor(n.diasAtraso)
                      return (
                        <tr key={i}
                          style={{ borderBottom: '1px solid #f1f5f9', background: n.diasAtraso > 0 ? '#fff9f9' : 'white' }}
                          onMouseEnter={e => (e.currentTarget.style.background = '#f8fafc')}
                          onMouseLeave={e => (e.currentTarget.style.background = n.diasAtraso > 0 ? '#fff9f9' : 'white')}
                        >
                          <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                            <span style={{
                              display: 'inline-flex', alignItems: 'center',
                              padding: '3px 10px', borderRadius: '99px', fontSize: '12px', fontWeight: '700',
                              background: atrasoCor.bg, color: atrasoCor.text, border: `1px solid ${atrasoCor.border}`,
                            }}>
                              {diasAtrasoLabel(n.diasAtraso)}
                            </span>
                          </td>
                          <td style={{ padding: '12px 14px', color: n.diasAtraso > 0 ? '#dc2626' : '#374151', fontWeight: n.diasAtraso > 0 ? '600' : 'normal', whiteSpace: 'nowrap' }}>
                            {formatDate(n.dataEntrega)}
                          </td>
                          <td style={{ padding: '12px 14px', color: '#64748b', whiteSpace: 'nowrap' }}>{n.leadTime}d</td>
                          <td style={{ padding: '12px 14px' }}>
                            <Badge label={n.tipoLabel} {...tipoStyle(n.tipo)} />
                          </td>
                          <td style={{ padding: '12px 14px', color: '#374151', fontWeight: '500' }}>{n.codigoLoja}</td>
                          <td style={{ padding: '12px 14px', color: '#64748b' }}>{n.codigoFornecedor}</td>
                          <td style={{ padding: '12px 14px', color: '#0f172a', maxWidth: '260px' }}>
                            <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.nomeFornecedor}</div>
                          </td>
                          <td style={{ padding: '12px 14px', color: '#374151', whiteSpace: 'nowrap' }}>{formatDate(n.dataEmissao)}</td>
                          <td style={{ padding: '12px 14px', color: '#0f172a', fontWeight: '600', whiteSpace: 'nowrap' }}>{formatCurrency(n.valorTotal)}</td>
                          <td style={{ padding: '12px 14px' }}>
                            <Badge label={n.situacaoLabel} {...situacaoStyle(n.situacao)} />
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {filtered.length > 0 && (
              <div style={{
                display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px',
                padding: '12px 20px', borderTop: '1px solid #f1f5f9',
                background: '#f8fafc', fontSize: '13px', color: '#64748b',
              }}>
                <span>{filtered.length} nota{filtered.length !== 1 ? 's' : ''} exibida{filtered.length !== 1 ? 's' : ''}</span>
                <span style={{ fontWeight: '600', color: '#0f172a' }}>
                  Total filtrado: {formatCurrency(filtered.reduce((s, n) => s + n.valorTotal, 0))}
                </span>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
