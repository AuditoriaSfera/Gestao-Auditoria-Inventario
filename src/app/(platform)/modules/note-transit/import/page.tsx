'use client'

export const dynamic = 'force-dynamic'

import { useState, useRef } from 'react'
import { trpc } from '@/lib/trpc'
import { ModulePage, DataCard, EmptyState, Btn } from '@/components/shared/module-page'

type ParsedRow = Record<string, any>

// Colunas esperadas na planilha (o cabeçalho aceita variações/acentos)
const EXPECTED_COLUMNS = [
  { header: 'Nº Nota', required: true, example: '000123456', note: 'Número da nota fiscal' },
  { header: 'Tipo', required: false, example: 'NF-e', note: 'Tipo da nota (padrão NF-e)' },
  { header: 'Loja Destino', required: true, example: '001', note: 'Código da loja de destino' },
  { header: 'Emissão', required: true, example: '01/06/2026', note: 'Data de emissão (dd/mm/aaaa)' },
  { header: 'Previsão', required: false, example: '05/06/2026', note: 'Previsão de recebimento' },
  { header: 'Valor', required: false, example: '1.234,56', note: 'Valor total da nota' },
]

function formatCellValue(v: any): string {
  if (v == null) return ''
  if (v instanceof Date) return v.toLocaleDateString('pt-BR')
  if (typeof v === 'object') return String(v.result ?? v.text ?? '')
  return String(v)
}

export default function NoteTransitImportPage() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState('')
  const [fileSize, setFileSize] = useState(0)
  const [rows, setRows] = useState<ParsedRow[]>([])
  const [headers, setHeaders] = useState<string[]>([])
  const [parsing, setParsing] = useState(false)
  const [parseError, setParseError] = useState<string | null>(null)
  const [result, setResult] = useState<any>(null)

  const utils = trpc.useUtils()
  const importMutation = trpc.noteTransit.importRows.useMutation({
    onSuccess: (data) => {
      setResult(data)
      utils.noteTransit.list.invalidate()
      utils.noteTransit.kpiSummary.invalidate()
    },
  })

  async function handleFile(file: File) {
    setParsing(true)
    setParseError(null)
    setResult(null)
    setRows([])
    setHeaders([])
    try {
      const ExcelJS = (await import('exceljs')).default
      const buffer = await file.arrayBuffer()
      const wb = new ExcelJS.Workbook()
      await wb.xlsx.load(buffer)
      const ws = wb.worksheets[0]
      if (!ws) throw new Error('A planilha não tem nenhuma aba.')

      const hdrs: string[] = []
      ws.getRow(1).eachCell((cell, col) => {
        hdrs[col] = String(cell.value ?? '').trim()
      })
      const cleanHeaders = hdrs.filter(Boolean)
      if (cleanHeaders.length === 0) throw new Error('A primeira linha (cabeçalho) está vazia.')

      const parsed: ParsedRow[] = []
      ws.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return
        const obj: ParsedRow = {}
        let hasValue = false
        row.eachCell((cell, col) => {
          const key = hdrs[col]
          if (!key) return
          const val = cell.value
          obj[key] = val
          if (val != null && String(val).trim() !== '') hasValue = true
        })
        if (hasValue) parsed.push(obj)
      })

      if (parsed.length === 0) throw new Error('Nenhuma linha de dados encontrada após o cabeçalho.')

      setHeaders(cleanHeaders)
      setRows(parsed)
      setFileName(file.name)
      setFileSize(file.size)
    } catch (e) {
      setParseError(e instanceof Error ? e.message : 'Erro ao ler a planilha.')
    } finally {
      setParsing(false)
    }
  }

  async function downloadTemplate() {
    const ExcelJS = (await import('exceljs')).default
    const wb = new ExcelJS.Workbook()
    const ws = wb.addWorksheet('Trânsito de Notas')
    ws.columns = EXPECTED_COLUMNS.map((c) => ({ header: c.header, key: c.header, width: 18 }))
    ws.getRow(1).font = { bold: true }
    ws.addRow(EXPECTED_COLUMNS.map((c) => c.example))
    const buf = await wb.xlsx.writeBuffer()
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'modelo-transito-de-notas.xlsx'
    a.click()
    URL.revokeObjectURL(url)
  }

  function reset() {
    setFileName('')
    setFileSize(0)
    setRows([])
    setHeaders([])
    setParseError(null)
    setResult(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const previewRows = rows.slice(0, 10)

  return (
    <ModulePage
      title="Importar Planilha — Trânsito de Notas"
      description="Envie uma planilha Excel (.xlsx) com as notas em trânsito. Os dados são validados antes de gravar."
      actions={<Btn variant="outline" onClick={downloadTemplate}>⬇ Baixar modelo</Btn>}
    >
      {/* Passo 1: seleção do arquivo */}
      <DataCard title="1. Selecione a planilha">
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls"
          style={{ display: 'none' }}
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) handleFile(f)
          }}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <Btn onClick={() => fileInputRef.current?.click()} disabled={parsing}>
            {parsing ? 'Lendo arquivo…' : '📁 Escolher arquivo .xlsx'}
          </Btn>
          {fileName && (
            <span style={{ fontSize: '14px', color: '#374151' }}>
              <strong>{fileName}</strong> — {rows.length} linha(s) lida(s)
            </span>
          )}
          {(fileName || parseError) && (
            <Btn variant="ghost" small onClick={reset}>Limpar</Btn>
          )}
        </div>
        {parseError && (
          <div style={{ marginTop: '12px', padding: '12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', fontSize: '13px', color: '#b91c1c' }}>
            ⚠️ {parseError}
          </div>
        )}

        {/* Referência de colunas */}
        <div style={{ marginTop: '16px', fontSize: '13px', color: '#64748b' }}>
          <div style={{ fontWeight: 600, marginBottom: 6, color: '#374151' }}>Colunas esperadas:</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {EXPECTED_COLUMNS.map((c) => (
              <span key={c.header} style={{
                padding: '3px 9px', borderRadius: '6px', fontSize: '12px',
                background: c.required ? '#dbeafe' : '#f1f5f9',
                color: c.required ? '#1d4ed8' : '#64748b',
              }} title={c.note}>
                {c.header}{c.required ? ' *' : ''}
              </span>
            ))}
          </div>
          <div style={{ marginTop: 6, fontSize: '12px', color: '#94a3b8' }}>* obrigatório. A ordem das colunas não importa; o cabeçalho aceita acentos e variações.</div>
        </div>
      </DataCard>

      {/* Passo 2: prévia */}
      {rows.length > 0 && !result && (
        <DataCard
          title={`2. Prévia (${rows.length} linha(s))`}
          action={
            <Btn
              onClick={() => importMutation.mutate({ fileName, fileSize, rows })}
              disabled={importMutation.isLoading}
            >
              {importMutation.isLoading ? 'Importando…' : `✓ Importar ${rows.length} nota(s)`}
            </Btn>
          }
        >
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #f1f5f9' }}>
                  {headers.map((h) => (
                    <th key={h} style={{ textAlign: 'left', padding: '8px 10px', fontSize: '12px', fontWeight: 600, color: '#64748b', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {previewRows.map((r, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #f8fafc' }}>
                    {headers.map((h) => (
                      <td key={h} style={{ padding: '8px 10px', color: '#374151', whiteSpace: 'nowrap' }}>{formatCellValue(r[h])}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length > previewRows.length && (
              <div style={{ marginTop: 10, fontSize: 12, color: '#94a3b8' }}>
                …e mais {rows.length - previewRows.length} linha(s). Todas serão importadas.
              </div>
            )}
          </div>
          {importMutation.error && (
            <div style={{ marginTop: '12px', padding: '12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', fontSize: '13px', color: '#b91c1c' }}>
              ⚠️ {importMutation.error.message}
            </div>
          )}
        </DataCard>
      )}

      {/* Passo 3: resultado */}
      {result && (
        <DataCard
          title="3. Resultado da importação"
          action={<Btn variant="outline" small onClick={reset}>Importar outra planilha</Btn>}
        >
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: result.errors?.length ? '16px' : 0 }}>
            {[
              { label: 'Total de linhas', value: result.total, color: '#0f172a' },
              { label: 'Importadas', value: result.published, color: '#16a34a' },
              { label: 'Com erro', value: result.invalid, color: result.invalid > 0 ? '#dc2626' : '#94a3b8' },
            ].map((s) => (
              <div key={s.label} style={{ padding: '14px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '12px', color: '#64748b' }}>{s.label}</div>
                <div style={{ fontSize: '24px', fontWeight: 700, color: s.color }}>{s.value}</div>
              </div>
            ))}
          </div>

          {result.errors?.length > 0 && (
            <div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '8px' }}>
                Linhas com erro (não importadas):
              </div>
              <div style={{ maxHeight: '260px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {result.errors.map((err: any, i: number) => (
                  <div key={i} style={{ padding: '8px 10px', background: '#fef2f2', borderRadius: '6px', fontSize: '12px' }}>
                    <span style={{ fontWeight: 600, color: '#dc2626' }}>Linha {err.rowNumber}: </span>
                    <span style={{ color: '#7f1d1d' }}>{err.message}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {result.published > 0 && (
            <div style={{ marginTop: '16px', padding: '12px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', fontSize: '13px', color: '#15803d' }}>
              ✅ {result.published} nota(s) gravada(s) com sucesso. Veja em <a href="/modules/note-transit" style={{ color: '#15803d', textDecoration: 'underline', fontWeight: 600 }}>Notas em Trânsito</a>.
            </div>
          )}
        </DataCard>
      )}

      {rows.length === 0 && !parseError && !parsing && (
        <EmptyState icon="📄" title="Nenhuma planilha carregada" description="Baixe o modelo, preencha e selecione o arquivo acima para começar." />
      )}
    </ModulePage>
  )
}
