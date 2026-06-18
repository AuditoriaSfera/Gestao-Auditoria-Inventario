'use client'

export const dynamic = 'force-dynamic'

import { useState, useRef } from 'react'
import { trpc } from '@/lib/trpc'
import { ModulePage, DataCard, StatusBadge, EmptyState, LoadingState, Btn } from '@/components/shared/module-page'

const STATUS_LABELS: Record<string, string> = { ACTIVE: 'Ativa', INACTIVE: 'Inativa', CLOSED: 'Fechada' }

// Colunas do modelo de importação
const TEMPLATE_COLS = ['CODIGO', 'EMPRESA', 'CNPJ', 'FANTASIA', 'ENDERECOS', 'CIDADE', 'ESTADO', 'GERENTE', 'GESTAO']

type StoreForm = { code: string; name: string; tradeName: string; city: string; state: string; managerName: string; gestao: string }
const emptyForm = (): StoreForm => ({ code: '', name: '', tradeName: '', city: '', state: '', managerName: '', gestao: '' })

type ImportRow = { code: string; name: string; cnpj: string; tradeName: string; address: string; city: string; state: string; managerName: string; gestao: string; _error?: string }

function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ background: 'white', borderRadius: '16px', width: '100%', maxWidth: wide ? '860px' : '560px', maxHeight: '90vh', overflow: 'auto', boxShadow: '0 25px 50px rgba(0,0,0,0.25)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', borderBottom: '1px solid #f1f5f9', position: 'sticky', top: 0, background: 'white', zIndex: 1 }}>
          <h2 style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: '#0f172a' }}>{title}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#94a3b8', lineHeight: 1 }}>×</button>
        </div>
        <div style={{ padding: '24px' }}>{children}</div>
      </div>
    </div>
  )
}

const inputStyle = { width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '14px', boxSizing: 'border-box' as const }
function Field({ label, children, half }: { label: string; children: React.ReactNode; half?: boolean }) {
  return (
    <div style={{ marginBottom: '14px', width: half ? 'calc(50% - 6px)' : '100%' }}>
      <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: '#374151', marginBottom: '5px' }}>{label}</label>
      {children}
    </div>
  )
}

// Faz parse de uma linha CSV respeitando aspas
function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { cur += '"'; i++ }
      else { inQuotes = !inQuotes }
    } else if ((ch === ',' || ch === ';') && !inQuotes) {
      result.push(cur.trim())
      cur = ''
    } else {
      cur += ch
    }
  }
  result.push(cur.trim())
  return result
}

function parseCSV(text: string): ImportRow[] {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(l => l.trim())
  if (lines.length < 2) return []
  const headers = parseCSVLine(lines[0]).map(h => h.toUpperCase().replace(/[^A-Z]/g, ''))

  const colIdx = (keys: string[]) => {
    for (const k of keys) {
      const i = headers.findIndex(h => h === k || h.includes(k))
      if (i >= 0) return i
    }
    return -1
  }

  const iCodigo   = colIdx(['CODIGO', 'COD'])
  const iEmpresa  = colIdx(['EMPRESA', 'RAZAOSOCIAL', 'NOME'])
  const iCnpj     = colIdx(['CNPJ'])
  const iFantasia = colIdx(['FANTASIA', 'NOMEFANTASIA'])
  const iEndereco = colIdx(['ENDERECOS', 'ENDERECO', 'ENDEREÇO', 'ENDERECOS'])
  const iCidade   = colIdx(['CIDADE', 'CITY'])
  const iEstado   = colIdx(['ESTADO', 'UF', 'STATE'])
  const iGerente  = colIdx(['GERENTE', 'MANAGER', 'RESPONSAVEL'])
  const iGestao   = colIdx(['GESTAO', 'GESTÃO', 'GESTÃOO', 'REGIONAL', 'FRANQUEADO'])

  return lines.slice(1).map(line => {
    const cols = parseCSVLine(line)
    const get = (i: number) => (i >= 0 ? cols[i] ?? '' : '').trim()
    const code = get(iCodigo)
    const name = get(iEmpresa)
    const row: ImportRow = {
      code,
      name,
      cnpj:        get(iCnpj),
      tradeName:   get(iFantasia),
      address:     get(iEndereco),
      city:        get(iCidade),
      state:       get(iEstado).toUpperCase().slice(0, 2),
      managerName: get(iGerente),
      gestao:      get(iGestao),
    }
    if (!code) row._error = 'Código obrigatório'
    else if (!name) row._error = 'Empresa obrigatória'
    return row
  }).filter(r => r.code || r.name)
}

function downloadTemplate() {
  const BOM = '﻿'
  const header = TEMPLATE_COLS.join(';')
  const example = [
    '23452;Boticário Carangola;57.189.430/0004-63;Boticário Carangola;Rua Pedro de Oliveira, 154, Centro;Carangola;MG;Mariana Gomes;Mafortes',
    '21478;Boticário Carrefour (JF);14.477.305/0010-94;Boticário Carrefour (JF);Avenida Presidente João Goulart, nº 5.001;Juiz de Fora;MG;Daniele Santos;Cantieri',
  ].join('\n')
  const csv = BOM + header + '\n' + example
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'modelo_importacao_lojas.csv'
  a.click()
  URL.revokeObjectURL(url)
}

// ── Componente de importação ──────────────────────────────────────────────────
function ImportModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [rows, setRows] = useState<ImportRow[] | null>(null)
  const [fileName, setFileName] = useState('')
  const [result, setResult] = useState<{ created: number; skipped: string[] } | null>(null)
  const [parseError, setParseError] = useState('')

  const bulkCreate = trpc.stores.bulkCreate.useMutation({
    onSuccess: r => { setResult(r); onSuccess() },
  })

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    setParseError('')
    setResult(null)
    const reader = new FileReader()
    reader.onload = ev => {
      try {
        const text = ev.target?.result as string
        const parsed = parseCSV(text)
        if (parsed.length === 0) { setParseError('Nenhuma linha encontrada. Verifique o arquivo.'); return }
        setRows(parsed)
      } catch {
        setParseError('Erro ao ler o arquivo. Use o modelo CSV fornecido.')
      }
    }
    reader.readAsText(file, 'UTF-8')
  }

  const validRows = rows?.filter(r => !r._error) ?? []
  const errorRows = rows?.filter(r => r._error) ?? []

  if (result) return (
    <div style={{ textAlign: 'center', padding: '16px 0' }}>
      <div style={{ fontSize: '40px', marginBottom: '12px' }}>✅</div>
      <div style={{ fontSize: '18px', fontWeight: '700', color: '#0f172a', marginBottom: '8px' }}>Importação concluída!</div>
      <div style={{ fontSize: '14px', color: '#64748b', marginBottom: '4px' }}><strong style={{ color: '#16a34a' }}>{result.created}</strong> loja{result.created !== 1 ? 's' : ''} criada{result.created !== 1 ? 's' : ''} com sucesso</div>
      {result.skipped.length > 0 && <div style={{ fontSize: '13px', color: '#d97706', marginBottom: '16px' }}>{result.skipped.length} ignorada{result.skipped.length !== 1 ? 's' : ''} (código já existe): {result.skipped.join(', ')}</div>}
      <Btn onClick={onClose}>Fechar</Btn>
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Instrução + download modelo */}
      <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '10px', padding: '14px 16px' }}>
        <div style={{ fontWeight: '700', color: '#1d4ed8', fontSize: '13px', marginBottom: '6px' }}>📋 Como importar</div>
        <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '13px', color: '#475569', lineHeight: '1.7' }}>
          <li>Baixe o modelo CSV abaixo e preencha os dados das lojas</li>
          <li>Colunas: <strong>CODIGO, EMPRESA, CNPJ, FANTASIA, ENDERECOS, CIDADE, ESTADO, GERENTE, GESTAO</strong></li>
          <li>Use <strong>ponto e vírgula (;)</strong> como separador</li>
          <li>Lojas com código já existente serão ignoradas automaticamente</li>
        </ul>
        <button
          onClick={downloadTemplate}
          style={{ marginTop: '10px', padding: '7px 14px', borderRadius: '8px', border: '1.5px solid #2563eb', background: 'white', cursor: 'pointer', fontSize: '12px', fontWeight: '700', color: '#2563eb', display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          ⬇ Baixar Modelo CSV
        </button>
      </div>

      {/* Upload */}
      <div>
        <div style={{ fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>Selecionar arquivo (.csv)</div>
        <div
          onClick={() => fileRef.current?.click()}
          style={{ border: '2px dashed #d1d5db', borderRadius: '10px', padding: '24px', textAlign: 'center', cursor: 'pointer', background: '#f8fafc', transition: 'border-color 0.15s' }}
          onMouseEnter={e => (e.currentTarget.style.borderColor = '#2563eb')}
          onMouseLeave={e => (e.currentTarget.style.borderColor = '#d1d5db')}
        >
          {fileName ? (
            <div>
              <div style={{ fontSize: '22px', marginBottom: '4px' }}>📄</div>
              <div style={{ fontWeight: '600', color: '#0f172a', fontSize: '14px' }}>{fileName}</div>
              <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>Clique para trocar o arquivo</div>
            </div>
          ) : (
            <div>
              <div style={{ fontSize: '32px', marginBottom: '8px' }}>📂</div>
              <div style={{ fontWeight: '600', color: '#0f172a', fontSize: '14px' }}>Clique para selecionar o arquivo CSV</div>
              <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>Arquivos .csv com separador vírgula ou ponto e vírgula</div>
            </div>
          )}
        </div>
        <input ref={fileRef} type="file" accept=".csv,.txt" onChange={onFile} style={{ display: 'none' }} />
        {parseError && <div style={{ marginTop: '8px', fontSize: '13px', color: '#dc2626' }}>⚠ {parseError}</div>}
      </div>

      {/* Preview */}
      {rows && rows.length > 0 && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <div style={{ fontSize: '13px', fontWeight: '700', color: '#0f172a' }}>
              Prévia — {rows.length} linha{rows.length !== 1 ? 's' : ''}
              {errorRows.length > 0 && <span style={{ marginLeft: '8px', color: '#dc2626', fontWeight: '600' }}>({errorRows.length} com erro)</span>}
            </div>
            <div style={{ fontSize: '12px', color: '#94a3b8' }}>{validRows.length} válida{validRows.length !== 1 ? 's' : ''} para importar</div>
          </div>
          <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden', maxHeight: '280px', overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr style={{ background: '#f8fafc', position: 'sticky', top: 0 }}>
                  {['Código', 'Empresa', 'CNPJ', 'Fantasia', 'Cidade', 'UF', 'Gerente', 'Gestão', 'Status'].map(h => (
                    <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontWeight: '700', color: '#64748b', whiteSpace: 'nowrap', borderBottom: '2px solid #e2e8f0' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #f1f5f9', background: r._error ? '#fef2f2' : 'white' }}>
                    <td style={{ padding: '7px 10px', fontWeight: '600', color: '#2563eb', fontFamily: 'monospace' }}>{r.code || '—'}</td>
                    <td style={{ padding: '7px 10px' }}>{r.name || '—'}</td>
                    <td style={{ padding: '7px 10px', color: '#64748b' }}>{r.cnpj || '—'}</td>
                    <td style={{ padding: '7px 10px', color: '#64748b' }}>{r.tradeName || '—'}</td>
                    <td style={{ padding: '7px 10px', color: '#64748b' }}>{r.city || '—'}</td>
                    <td style={{ padding: '7px 10px', color: '#64748b' }}>{r.state || '—'}</td>
                    <td style={{ padding: '7px 10px', color: '#64748b' }}>{r.managerName || '—'}</td>
                    <td style={{ padding: '7px 10px', color: '#64748b' }}>{r.gestao || '—'}</td>
                    <td style={{ padding: '7px 10px' }}>
                      {r._error
                        ? <span style={{ color: '#dc2626', fontSize: '11px', fontWeight: '600' }}>⚠ {r._error}</span>
                        : <span style={{ color: '#16a34a', fontSize: '11px', fontWeight: '600' }}>✓ OK</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Ações */}
      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
        <Btn variant="outline" onClick={onClose}>Cancelar</Btn>
        <button
          disabled={validRows.length === 0 || bulkCreate.isPending}
          onClick={() => bulkCreate.mutate({ stores: validRows.map(({ _error, ...r }) => r) })}
          style={{ padding: '9px 20px', borderRadius: '8px', border: 'none', background: validRows.length === 0 ? '#e2e8f0' : '#2563eb', cursor: validRows.length === 0 ? 'not-allowed' : 'pointer', fontSize: '14px', fontWeight: '700', color: validRows.length === 0 ? '#94a3b8' : 'white' }}
        >
          {bulkCreate.isPending ? 'Importando...' : `⬆ Importar ${validRows.length} Loja${validRows.length !== 1 ? 's' : ''}`}
        </button>
      </div>
      {bulkCreate.error && <div style={{ fontSize: '13px', color: '#dc2626', textAlign: 'center' }}>Erro: {bulkCreate.error.message}</div>}
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function StoresPage() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [editStore, setEditStore] = useState<any | null>(null)
  const [deleteStoreId, setDeleteStoreId] = useState<string | null>(null)
  const [form, setForm] = useState<StoreForm>(emptyForm())
  const [error, setError] = useState('')

  const utils = trpc.useUtils()
  const { data, isLoading } = trpc.stores.list.useQuery({ page, pageSize: 20, search: search || undefined })

  const createMut = trpc.stores.create.useMutation({
    onSuccess: () => { utils.stores.list.invalidate(); setShowCreate(false); setForm(emptyForm()); setError('') },
    onError: e => setError(e.message),
  })
  const updateMut = trpc.stores.update.useMutation({
    onSuccess: () => { utils.stores.list.invalidate(); setEditStore(null); setError('') },
    onError: e => setError(e.message),
  })
  const deleteMut = trpc.stores.delete.useMutation({
    onSuccess: () => { utils.stores.list.invalidate(); setDeleteStoreId(null) },
  })

  function openEdit(s: any) {
    setForm({ code: s.code, name: s.name, tradeName: s.tradeName ?? '', city: s.city ?? '', state: s.state ?? '', managerName: s.managerName ?? '', gestao: s.gestao ?? '' })
    setEditStore(s)
    setError('')
  }

  function set(k: keyof StoreForm, v: string) { setForm(f => ({ ...f, [k]: v })) }

  const FormContent = (isEdit: boolean) => (
    <>
      {error && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '10px 14px', marginBottom: '16px', fontSize: '13px', color: '#dc2626' }}>{error}</div>}
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        <Field label="Código *" half><input style={inputStyle} value={form.code} onChange={e => set('code', e.target.value)} placeholder="Ex: 001" disabled={isEdit} /></Field>
        <Field label="Razão Social *" half><input style={inputStyle} value={form.name} onChange={e => set('name', e.target.value)} placeholder="Nome legal da loja" /></Field>
        <Field label="Nome Fantasia" half><input style={inputStyle} value={form.tradeName} onChange={e => set('tradeName', e.target.value)} placeholder="Nome comercial" /></Field>
        <Field label="Cidade" half><input style={inputStyle} value={form.city} onChange={e => set('city', e.target.value)} placeholder="Ex: São Paulo" /></Field>
        <Field label="Estado" half><input style={inputStyle} value={form.state} onChange={e => set('state', e.target.value.toUpperCase())} maxLength={2} placeholder="SP" /></Field>
        <Field label="Gerente" half><input style={inputStyle} value={form.managerName} onChange={e => set('managerName', e.target.value)} placeholder="Nome do gerente" /></Field>
        <Field label="Gestão" half><input style={inputStyle} value={form.gestao} onChange={e => set('gestao', e.target.value)} placeholder="Ex: Cantieri, Mafortes" /></Field>
      </div>
      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '8px' }}>
        <Btn variant="outline" onClick={() => { isEdit ? setEditStore(null) : setShowCreate(false); setError('') }}>Cancelar</Btn>
        <Btn onClick={() => {
          if (!form.code || !form.name) { setError('Código e razão social são obrigatórios.'); return }
          if (isEdit) updateMut.mutate({ id: editStore.id, name: form.name, tradeName: form.tradeName || undefined, city: form.city || undefined, state: form.state || undefined, managerName: form.managerName || undefined, gestao: form.gestao || undefined })
          else createMut.mutate({ code: form.code, name: form.name, tradeName: form.tradeName || undefined, city: form.city || undefined, state: form.state || undefined, managerName: form.managerName || undefined, gestao: form.gestao || undefined })
        }} disabled={createMut.isPending || updateMut.isPending}>
          {createMut.isPending || updateMut.isPending ? 'Salvando...' : isEdit ? 'Salvar' : 'Criar Loja'}
        </Btn>
      </div>
    </>
  )

  return (
    <ModulePage
      title="Lojas"
      description="Cadastro e gestão das lojas da rede Sfera Multifranquias"
      actions={
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={downloadTemplate}
            style={{ padding: '8px 14px', borderRadius: '8px', border: '1.5px solid #d1d5db', background: 'white', cursor: 'pointer', fontSize: '13px', fontWeight: '600', color: '#475569', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            ⬇ Modelo CSV
          </button>
          <button
            onClick={() => setShowImport(true)}
            style={{ padding: '8px 14px', borderRadius: '8px', border: '1.5px solid #22c55e', background: '#f0fdf4', cursor: 'pointer', fontSize: '13px', fontWeight: '600', color: '#16a34a', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            ⬆ Importar Planilha
          </button>
          <Btn onClick={() => { setShowCreate(true); setForm(emptyForm()); setError('') }}>+ Nova Loja</Btn>
        </div>
      }
    >
      {showCreate && <Modal title="Nova Loja" onClose={() => { setShowCreate(false); setError('') }}>{FormContent(false)}</Modal>}
      {editStore && <Modal title={`Editar: ${editStore.name}`} onClose={() => { setEditStore(null); setError('') }}>{FormContent(true)}</Modal>}
      {showImport && (
        <Modal title="Importar Lojas em Massa" wide onClose={() => setShowImport(false)}>
          <ImportModal onClose={() => setShowImport(false)} onSuccess={() => utils.stores.list.invalidate()} />
        </Modal>
      )}
      {deleteStoreId && (
        <Modal title="Confirmar Exclusão" onClose={() => setDeleteStoreId(null)}>
          <div style={{ padding: '8px 0 24px', fontSize: '15px', color: '#374151' }}>
            Tem certeza que deseja excluir esta loja? Esta ação não pode ser desfeita.
          </div>
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <Btn variant="outline" onClick={() => setDeleteStoreId(null)}>Cancelar</Btn>
            <Btn variant="danger" onClick={() => deleteMut.mutate({ id: deleteStoreId })} disabled={deleteMut.isPending}>
              {deleteMut.isPending ? 'Excluindo...' : 'Excluir'}
            </Btn>
          </div>
        </Modal>
      )}

      <DataCard
        title={`Lojas (${data?.meta?.total ?? 0})`}
        action={
          <input placeholder="Buscar por código ou nome..." value={search} onChange={e => { setSearch(e.target.value); setPage(1) }}
            style={{ padding: '6px 12px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '13px', width: '220px' }} />
        }
      >
        {isLoading ? <LoadingState /> : !data?.stores.length ? (
          <EmptyState icon="🏪" title="Nenhuma loja cadastrada" description="Cadastre a primeira loja da rede ou importe uma planilha." />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #f1f5f9' }}>
                  {['Código', 'Nome', 'Gestão', 'Gerente', 'Cidade/UF', 'Status', 'Ações'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '10px 12px', fontSize: '12px', fontWeight: '600', color: '#64748b', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.stores.map((s: any) => (
                  <tr key={s.id} style={{ borderBottom: '1px solid #f8fafc' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#f8fafc')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <td style={{ padding: '12px', fontWeight: '600', color: '#2563eb', fontFamily: 'monospace' }}>{s.code}</td>
                    <td style={{ padding: '12px' }}>
                      <div style={{ fontWeight: '500', color: '#0f172a' }}>{s.name}</div>
                      {s.tradeName && <div style={{ fontSize: '12px', color: '#94a3b8' }}>{s.tradeName}</div>}
                    </td>
                    <td style={{ padding: '12px', color: '#64748b' }}>{s.gestao ?? '—'}</td>
                    <td style={{ padding: '12px', color: '#64748b' }}>{s.managerName ?? '—'}</td>
                    <td style={{ padding: '12px', color: '#64748b' }}>{s.city ? `${s.city}/${s.state}` : '—'}</td>
                    <td style={{ padding: '12px' }}><StatusBadge status={s.status} label={STATUS_LABELS[s.status] || s.status} /></td>
                    <td style={{ padding: '12px' }}>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button onClick={() => openEdit(s)} style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid #d1d5db', background: 'white', fontSize: '12px', cursor: 'pointer', color: '#374151' }}>Editar</button>
                        {s.status === 'ACTIVE' ? (
                          <button onClick={() => updateMut.mutate({ id: s.id, status: 'INACTIVE' })} style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid #fcd34d', background: '#fefce8', fontSize: '12px', cursor: 'pointer', color: '#92400e' }}>Inativar</button>
                        ) : (
                          <button onClick={() => updateMut.mutate({ id: s.id, status: 'ACTIVE' })} style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid #86efac', background: '#f0fdf4', fontSize: '12px', cursor: 'pointer', color: '#166534' }}>Ativar</button>
                        )}
                        <button onClick={() => setDeleteStoreId(s.id)} style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid #fecaca', background: '#fef2f2', fontSize: '12px', cursor: 'pointer', color: '#dc2626' }}>Excluir</button>
                      </div>
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
    </ModulePage>
  )
}
