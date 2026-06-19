'use client'
export const dynamic = 'force-dynamic'

import { useState, useMemo } from 'react'
import { trpc } from '@/lib/trpc'

// ── Constantes ────────────────────────────────────────────────────────────────
const TIPOS = [
  { value: 'scanner', label: 'Scanner', emoji: '📡' },
  { value: 'celular', label: 'Celular', emoji: '📱' },
  { value: 'outro', label: 'Outro', emoji: '🔧' },
]

const STATUS_CONFIG: Record<string, { label: string; bg: string; color: string; emoji: string }> = {
  DISPONIVEL:       { label: 'Disponível',       bg: '#dcfce7', color: '#166534', emoji: '✅' },
  COM_COLABORADOR:  { label: 'Com Colaborador',   bg: '#dbeafe', color: '#1d4ed8', emoji: '👤' },
  NO_ESCRITORIO:    { label: 'No Escritório',     bg: '#f3e8ff', color: '#6b21a8', emoji: '🏢' },
  EM_LOJA:          { label: 'Em Loja',           bg: '#fef9c3', color: '#854d0e', emoji: '🏪' },
  EM_MANUTENCAO:    { label: 'Em Manutenção',     bg: '#ffedd5', color: '#9a3412', emoji: '🔧' },
  EXTRAVIADO:       { label: 'Extraviado',        bg: '#fee2e2', color: '#991b1b', emoji: '⚠️' },
  INATIVO:          { label: 'Inativo',           bg: '#f3f4f6', color: '#4b5563', emoji: '❌' },
  EM_VERIFICACAO:   { label: 'Em Verificação',    bg: '#fef3c7', color: '#92400e', emoji: '🔍' },
}

const CONDICOES = [
  { value: 'bom', label: 'Bom' },
  { value: 'ruim', label: 'Ruim' },
  { value: 'apagado', label: 'Apagado' },
  { value: 'sem_identificacao', label: 'Sem Identificação' },
  { value: 'verificar', label: 'Verificar' },
]

const TIPO_MOV_LABELS: Record<string, string> = {
  CADASTRO: 'Cadastro',
  TRANSFERENCIA: 'Transferência',
  ENVIO_MANUTENCAO: 'Envio para Manutenção',
  RETORNO_MANUTENCAO: 'Retorno da Manutenção',
  ENTREGA_LOJA: 'Entrega em Loja',
  RETIRADA_LOJA: 'Retirada de Loja',
  DISPONIBILIZACAO: 'Disponibilização',
  EXTRAVIO: 'Extravio Registrado',
  INATIVACAO: 'Inativação',
  ATUALIZACAO: 'Atualização de Dados',
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, bg: '#f3f4f6', color: '#374151', emoji: '•' }
  return (
    <span style={{ fontSize: '11px', fontWeight: '700', padding: '3px 8px', borderRadius: '20px', background: cfg.bg, color: cfg.color, whiteSpace: 'nowrap' }}>
      {cfg.emoji} {cfg.label}
    </span>
  )
}

function TipoBadge({ tipo }: { tipo: string }) {
  const t = TIPOS.find(x => x.value === tipo)
  return (
    <span style={{ fontSize: '11px', fontWeight: '600', color: '#374151' }}>
      {t?.emoji} {t?.label ?? tipo}
    </span>
  )
}

function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 9000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '24px 16px', overflowY: 'auto' }}>
      <div style={{ background: 'white', borderRadius: '16px', width: '100%', maxWidth: wide ? '800px' : '540px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)', marginTop: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', borderBottom: '1px solid #f1f5f9' }}>
          <div style={{ fontWeight: '700', fontSize: '16px', color: '#0f172a' }}>{title}</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px', color: '#94a3b8', lineHeight: 1 }}>✕</button>
        </div>
        <div style={{ padding: '24px' }}>{children}</div>
      </div>
    </div>
  )
}

const inp: React.CSSProperties = { width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1.5px solid #e2e8f0', fontSize: '14px', boxSizing: 'border-box', outline: 'none', fontFamily: 'inherit' }
const lbl: React.CSSProperties = { fontSize: '12px', fontWeight: '700', color: '#374151', marginBottom: '4px', display: 'block', textTransform: 'uppercase', letterSpacing: '0.04em' }
const row2: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label style={lbl}>{label}</label>{children}</div>
}

// ── Modal: Cadastrar / Editar ─────────────────────────────────────────────────
function ModalCadastrar({ initial, colaboradores, lojas, onClose, onSave }: {
  initial?: any; colaboradores: any[]; lojas: any[]; onClose: () => void; onSave: () => void
}) {
  const isEdit = !!initial
  const [form, setForm] = useState({
    codigo: initial?.codigo ?? '',
    tipo: initial?.tipo ?? 'scanner',
    serialNumber: initial?.serialNumber ?? '',
    descricao: initial?.descricao ?? '',
    observacoes: initial?.observacoes ?? '',
    condicao: initial?.condicao ?? 'bom',
    status: initial?.status ?? 'DISPONIVEL',
    colaboradorId: initial?.colaboradorId ?? '',
    lojaId: initial?.lojaId ?? '',
    localNota: initial?.localNota ?? '',
  })
  const [error, setError] = useState('')

  const createMut = trpc.patrimonio.create.useMutation({ onSuccess: onSave, onError: e => setError(e.message) })
  const updateMut = trpc.patrimonio.update.useMutation({ onSuccess: onSave, onError: e => setError(e.message) })

  function handleSave() {
    if (!form.codigo.trim()) return setError('Código obrigatório.')
    if (!form.tipo) return setError('Tipo obrigatório.')
    if (isEdit) {
      updateMut.mutate({ id: initial.id, serialNumber: form.serialNumber || undefined, descricao: form.descricao || undefined, observacoes: form.observacoes || undefined, condicao: form.condicao || undefined, localNota: form.localNota || undefined })
    } else {
      const colaborador = colaboradores.find(c => c.id === form.colaboradorId)
      const loja = lojas.find(l => l.id === form.lojaId)
      createMut.mutate({
        codigo: form.codigo.trim(),
        tipo: form.tipo,
        serialNumber: form.serialNumber || undefined,
        descricao: form.descricao || undefined,
        observacoes: form.observacoes || undefined,
        condicao: form.condicao || undefined,
        status: form.status,
        colaboradorId: form.colaboradorId || undefined,
        colaboradorNome: colaborador?.name,
        lojaId: form.lojaId || undefined,
        lojaNome: loja ? (loja.tradeName || loja.name) : undefined,
        localNota: form.localNota || undefined,
      })
    }
  }

  const s = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))
  const isPending = createMut.isPending || updateMut.isPending

  return (
    <Modal title={isEdit ? `Editar — ${initial.codigo}` : 'Novo Patrimônio'} onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {!isEdit && (
          <div style={row2}>
            <Field label="Código *"><input style={inp} value={form.codigo} onChange={e => s('codigo', e.target.value)} placeholder="Ex: LT-0041, 5502, 643" /></Field>
            <Field label="Tipo *">
              <select style={inp} value={form.tipo} onChange={e => s('tipo', e.target.value)}>
                {TIPOS.map(t => <option key={t.value} value={t.value}>{t.emoji} {t.label}</option>)}
              </select>
            </Field>
          </div>
        )}
        <div style={row2}>
          <Field label="Nº de Série"><input style={inp} value={form.serialNumber} onChange={e => s('serialNumber', e.target.value)} placeholder="Opcional" /></Field>
          <Field label="Condição">
            <select style={inp} value={form.condicao} onChange={e => s('condicao', e.target.value)}>
              {CONDICOES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Descrição"><input style={inp} value={form.descricao} onChange={e => s('descricao', e.target.value)} placeholder="Ex: Scanner Honeywell Granit 1910i" /></Field>

        {!isEdit && (
          <>
            <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '12px' }}>
              <div style={{ ...lbl, marginBottom: '10px', color: '#64748b' }}>Posse Inicial</div>
              <Field label="Status">
                <select style={inp} value={form.status} onChange={e => s('status', e.target.value)}>
                  {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.emoji} {v.label}</option>)}
                </select>
              </Field>
            </div>
            {form.status === 'COM_COLABORADOR' && (
              <Field label="Colaborador">
                <select style={inp} value={form.colaboradorId} onChange={e => s('colaboradorId', e.target.value)}>
                  <option value="">— Selecionar —</option>
                  {colaboradores.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </Field>
            )}
            {form.status === 'EM_LOJA' && (
              <Field label="Loja">
                <select style={inp} value={form.lojaId} onChange={e => s('lojaId', e.target.value)}>
                  <option value="">— Selecionar —</option>
                  {lojas.map(l => <option key={l.id} value={l.id}>[{l.code}] {l.tradeName || l.name}</option>)}
                </select>
              </Field>
            )}
          </>
        )}

        <Field label="Observações">
          <textarea style={{ ...inp, minHeight: '70px', resize: 'vertical' }} value={form.observacoes} onChange={e => s('observacoes', e.target.value)} placeholder="Ex: patrimônio apagado, verificar localização..." />
        </Field>

        {error && <div style={{ color: '#dc2626', fontSize: '13px', background: '#fef2f2', padding: '8px 12px', borderRadius: '8px' }}>{error}</div>}
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', borderTop: '1px solid #f1f5f9', paddingTop: '16px' }}>
          <button onClick={onClose} style={{ padding: '10px 20px', borderRadius: '8px', border: '1px solid #e2e8f0', background: 'white', cursor: 'pointer', fontSize: '14px', fontWeight: '600', color: '#374151' }}>Cancelar</button>
          <button onClick={handleSave} disabled={isPending} style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', background: '#2563eb', color: 'white', cursor: isPending ? 'not-allowed' : 'pointer', fontSize: '14px', fontWeight: '600', opacity: isPending ? 0.7 : 1 }}>
            {isPending ? 'Salvando...' : isEdit ? 'Salvar' : 'Cadastrar'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

// ── Modal: Transferir ─────────────────────────────────────────────────────────
function ModalTransferir({ item, colaboradores, lojas, onClose, onSave }: { item: any; colaboradores: any[]; lojas: any[]; onClose: () => void; onSave: () => void }) {
  const [novoStatus, setNovoStatus] = useState(item.status)
  const [colaboradorId, setColaboradorId] = useState('')
  const [lojaId, setLojaId] = useState('')
  const [observacoes, setObservacoes] = useState('')
  const [error, setError] = useState('')

  const mut = trpc.patrimonio.transferir.useMutation({ onSuccess: onSave, onError: e => setError(e.message) })

  function handleSave() {
    const colaborador = colaboradores.find(c => c.id === colaboradorId)
    const loja = lojas.find(l => l.id === lojaId)
    if (novoStatus === 'COM_COLABORADOR' && !colaboradorId) return setError('Selecione o colaborador.')
    if (novoStatus === 'EM_LOJA' && !lojaId) return setError('Selecione a loja.')
    mut.mutate({
      id: item.id,
      novoStatus,
      colaboradorId: colaboradorId || undefined,
      colaboradorNome: colaborador?.name,
      lojaId: lojaId || undefined,
      lojaNome: loja ? (loja.tradeName || loja.name) : undefined,
      observacoes: observacoes || undefined,
    })
  }

  return (
    <Modal title={`Transferir — ${item.codigo}`} onClose={onClose}>
      <div style={{ marginBottom: '16px', padding: '12px', background: '#f8fafc', borderRadius: '10px', display: 'flex', gap: '10px', alignItems: 'center' }}>
        <TipoBadge tipo={item.tipo} />
        <StatusBadge status={item.status} />
        {(item.colaboradorNome || item.lojaNome) && <span style={{ fontSize: '13px', color: '#64748b' }}>→ {item.colaboradorNome ?? item.lojaNome}</span>}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <Field label="Nova situação">
          <select style={inp} value={novoStatus} onChange={e => { setNovoStatus(e.target.value); setColaboradorId(''); setLojaId('') }}>
            {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.emoji} {v.label}</option>)}
          </select>
        </Field>
        {novoStatus === 'COM_COLABORADOR' && (
          <Field label="Colaborador *">
            <select style={inp} value={colaboradorId} onChange={e => setColaboradorId(e.target.value)}>
              <option value="">— Selecionar —</option>
              {colaboradores.map(c => <option key={c.id} value={c.id}>{c.name}{c.role ? ` · ${c.role}` : ''}</option>)}
            </select>
          </Field>
        )}
        {novoStatus === 'EM_LOJA' && (
          <Field label="Loja *">
            <select style={inp} value={lojaId} onChange={e => setLojaId(e.target.value)}>
              <option value="">— Selecionar —</option>
              {lojas.map(l => <option key={l.id} value={l.id}>[{l.code}] {l.tradeName || l.name}</option>)}
            </select>
          </Field>
        )}
        <Field label="Observações">
          <textarea style={{ ...inp, minHeight: '60px', resize: 'vertical' }} value={observacoes} onChange={e => setObservacoes(e.target.value)} placeholder="Opcional" />
        </Field>
        {error && <div style={{ color: '#dc2626', fontSize: '13px' }}>{error}</div>}
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', borderTop: '1px solid #f1f5f9', paddingTop: '16px' }}>
          <button onClick={onClose} style={{ padding: '10px 20px', borderRadius: '8px', border: '1px solid #e2e8f0', background: 'white', cursor: 'pointer', fontSize: '14px', fontWeight: '600', color: '#374151' }}>Cancelar</button>
          <button onClick={handleSave} disabled={mut.isPending} style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', background: '#2563eb', color: 'white', cursor: mut.isPending ? 'not-allowed' : 'pointer', fontSize: '14px', fontWeight: '600', opacity: mut.isPending ? 0.7 : 1 }}>
            {mut.isPending ? 'Transferindo...' : 'Confirmar Transferência'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

// ── Modal: Entrega em Loja ────────────────────────────────────────────────────
function ModalEntregaLoja({ item, lojas, onClose, onSave }: { item: any; lojas: any[]; onClose: () => void; onSave: () => void }) {
  const hoje = new Date().toISOString().slice(0, 16)
  const [form, setForm] = useState({ lojaId: item.lojaId ?? '', dataEntrega: hoje, nomeRecebedor: '', cargoRecebedor: '', observacoes: '', anexoUrl: '' })
  const [error, setError] = useState('')
  const mut = trpc.patrimonio.registrarEntregaLoja.useMutation({ onSuccess: onSave, onError: e => setError(e.message) })
  const s = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  function handleSave() {
    if (!form.nomeRecebedor.trim()) return setError('Nome do recebedor obrigatório.')
    if (!form.dataEntrega) return setError('Data da entrega obrigatória.')
    const loja = lojas.find(l => l.id === form.lojaId)
    mut.mutate({
      equipamentoId: item.id,
      lojaId: form.lojaId || undefined,
      lojaNome: loja ? (loja.tradeName || loja.name) : undefined,
      dataEntrega: new Date(form.dataEntrega).toISOString(),
      nomeRecebedor: form.nomeRecebedor.trim(),
      cargoRecebedor: form.cargoRecebedor || undefined,
      observacoes: form.observacoes || undefined,
      anexoUrl: form.anexoUrl || undefined,
    })
  }

  return (
    <Modal title={`Entrega em Loja — ${item.codigo}`} onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <Field label="Loja">
          <select style={inp} value={form.lojaId} onChange={e => s('lojaId', e.target.value)}>
            <option value="">— Selecionar loja —</option>
            {lojas.map(l => <option key={l.id} value={l.id}>[{l.code}] {l.tradeName || l.name}</option>)}
          </select>
        </Field>
        <div style={row2}>
          <Field label="Data e Hora da Entrega *"><input type="datetime-local" style={inp} value={form.dataEntrega} onChange={e => s('dataEntrega', e.target.value)} /></Field>
          <Field label="Cargo / Função do Recebedor"><input style={inp} value={form.cargoRecebedor} onChange={e => s('cargoRecebedor', e.target.value)} placeholder="Ex: Gerente, Supervisor..." /></Field>
        </div>
        <Field label="Nome de Quem Recebeu *"><input style={inp} value={form.nomeRecebedor} onChange={e => s('nomeRecebedor', e.target.value)} placeholder="Nome completo" /></Field>
        <Field label="Observações"><textarea style={{ ...inp, minHeight: '60px', resize: 'vertical' }} value={form.observacoes} onChange={e => s('observacoes', e.target.value)} /></Field>
        <Field label="URL do Comprovante (PDF/imagem)"><input style={inp} value={form.anexoUrl} onChange={e => s('anexoUrl', e.target.value)} placeholder="https://..." /></Field>
        {error && <div style={{ color: '#dc2626', fontSize: '13px' }}>{error}</div>}
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', borderTop: '1px solid #f1f5f9', paddingTop: '16px' }}>
          <button onClick={onClose} style={{ padding: '10px 20px', borderRadius: '8px', border: '1px solid #e2e8f0', background: 'white', cursor: 'pointer', fontSize: '14px', fontWeight: '600', color: '#374151' }}>Cancelar</button>
          <button onClick={handleSave} disabled={mut.isPending} style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', background: '#2563eb', color: 'white', cursor: mut.isPending ? 'not-allowed' : 'pointer', fontSize: '14px', fontWeight: '600', opacity: mut.isPending ? 0.7 : 1 }}>
            {mut.isPending ? 'Registrando...' : 'Registrar Entrega'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

// ── Modal: Detalhe ────────────────────────────────────────────────────────────
function ModalDetalhe({ itemId, colaboradores, lojas, onClose, onRefresh }: { itemId: string; colaboradores: any[]; lojas: any[]; onClose: () => void; onRefresh: () => void }) {
  const [detailTab, setDetailTab] = useState<'dados' | 'historico' | 'anexos' | 'entregas'>('dados')
  const [showTransferir, setShowTransferir] = useState(false)
  const [showEntrega, setShowEntrega] = useState(false)
  const [showAnexo, setShowAnexo] = useState(false)
  const [anexoForm, setAnexoForm] = useState({ tipo: 'FOTO_EQUIPAMENTO', url: '', nomeArquivo: '', descricao: '' })

  const { data: item, refetch } = trpc.patrimonio.getById.useQuery({ id: itemId })
  const addAnexoMut = trpc.patrimonio.addAnexo.useMutation({ onSuccess: () => { refetch(); setShowAnexo(false) } })

  if (!item) return <Modal title="Carregando..." onClose={onClose}><div style={{ padding: '20px', color: '#64748b', textAlign: 'center' }}>Carregando...</div></Modal>

  const cfg = STATUS_CONFIG[item.status]
  const colNome = item.colaboradorNome ?? (item.colaboradorId ? colaboradores.find(c => c.id === item.colaboradorId)?.name : null)
  const lojaNome = item.lojaNome ?? (item.lojaId ? lojas.find(l => l.id === item.lojaId)?.tradeName ?? lojas.find(l => l.id === item.lojaId)?.name : null)

  return (
    <Modal title="" onClose={onClose} wide>
      {(showTransferir && item) && <ModalTransferir item={item} colaboradores={colaboradores} lojas={lojas} onClose={() => setShowTransferir(false)} onSave={() => { refetch(); onRefresh(); setShowTransferir(false) }} />}
      {(showEntrega && item) && <ModalEntregaLoja item={item} lojas={lojas} onClose={() => setShowEntrega(false)} onSave={() => { refetch(); onRefresh(); setShowEntrega(false) }} />}

      {/* Header do detalhe */}
      <div style={{ margin: '-24px -24px 0', padding: '20px 24px', background: `${cfg?.bg ?? '#f8fafc'}22`, borderBottom: '1px solid #f1f5f9', borderRadius: '16px 16px 0 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '6px' }}>
              <span style={{ fontSize: '22px', fontWeight: '800', color: '#0f172a' }}>{item.codigo}</span>
              <TipoBadge tipo={item.tipo} />
              <StatusBadge status={item.status} />
            </div>
            <div style={{ fontSize: '13px', color: '#64748b' }}>
              {colNome && <span>👤 {colNome} · </span>}
              {lojaNome && <span>🏪 {lojaNome} · </span>}
              {item.condicao && <span>Condição: {CONDICOES.find(c => c.value === item.condicao)?.label ?? item.condicao}</span>}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={() => setShowTransferir(true)} style={{ padding: '8px 14px', borderRadius: '8px', border: '1px solid #2563eb', background: 'white', color: '#2563eb', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}>⇄ Transferir</button>
            <button onClick={() => setShowEntrega(true)} style={{ padding: '8px 14px', borderRadius: '8px', border: '1px solid #e2e8f0', background: 'white', color: '#374151', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}>🏪 Entregar em Loja</button>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px', color: '#94a3b8' }}>✕</button>
          </div>
        </div>
      </div>

      {/* Abas */}
      <div style={{ display: 'flex', gap: '0', borderBottom: '1px solid #f1f5f9', margin: '0 -24px', padding: '0 24px' }}>
        {(['dados', 'historico', 'anexos', 'entregas'] as const).map(tab => {
          const labels = { dados: 'Dados', historico: `Histórico (${item.movimentacoes?.length ?? 0})`, anexos: `Anexos (${item.anexos?.length ?? 0})`, entregas: `Entregas em Loja (${item.entregas?.length ?? 0})` }
          return (
            <button key={tab} onClick={() => setDetailTab(tab)} style={{ padding: '12px 16px', border: 'none', borderBottom: detailTab === tab ? '2px solid #2563eb' : '2px solid transparent', background: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: detailTab === tab ? '700' : '500', color: detailTab === tab ? '#2563eb' : '#64748b', whiteSpace: 'nowrap' }}>
              {labels[tab]}
            </button>
          )
        })}
      </div>

      {/* Conteúdo das abas */}
      <div style={{ marginTop: '16px' }}>
        {detailTab === 'dados' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 24px' }}>
            {[
              { l: 'Código', v: item.codigo },
              { l: 'Tipo', v: TIPOS.find(t => t.value === item.tipo)?.label ?? item.tipo },
              { l: 'Nº de Série', v: item.serialNumber || '—' },
              { l: 'Condição', v: CONDICOES.find(c => c.value === item.condicao)?.label ?? item.condicao ?? '—' },
              { l: 'Status', v: STATUS_CONFIG[item.status]?.label ?? item.status },
              { l: 'Responsável', v: colNome ?? lojaNome ?? STATUS_CONFIG[item.status]?.label ?? '—' },
              { l: 'Última Atualização', v: new Date(item.updatedAt).toLocaleString('pt-BR') },
              { l: 'Cadastro', v: new Date(item.createdAt).toLocaleString('pt-BR') },
            ].map(({ l, v }) => (
              <div key={l}>
                <div style={{ fontSize: '11px', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '2px' }}>{l}</div>
                <div style={{ fontSize: '13px', color: '#0f172a' }}>{v}</div>
              </div>
            ))}
            {item.descricao && <div style={{ gridColumn: '1/-1' }}><div style={{ fontSize: '11px', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '2px' }}>Descrição</div><div style={{ fontSize: '13px', color: '#374151' }}>{item.descricao}</div></div>}
            {item.observacoes && <div style={{ gridColumn: '1/-1' }}><div style={{ fontSize: '11px', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '2px' }}>Observações</div><div style={{ fontSize: '13px', color: '#374151', whiteSpace: 'pre-wrap' }}>{item.observacoes}</div></div>}
          </div>
        )}

        {detailTab === 'historico' && (
          <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
            {(item.movimentacoes ?? []).length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', color: '#94a3b8' }}>Sem histórico</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
                {(item.movimentacoes ?? []).map((m: any, i: number) => (
                  <div key={m.id} style={{ display: 'flex', gap: '12px', padding: '12px 0', borderBottom: i < item.movimentacoes.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                    <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', flexShrink: 0, marginTop: '2px' }}>
                      {m.tipo === 'CADASTRO' ? '📋' : m.tipo === 'TRANSFERENCIA' ? '⇄' : m.tipo.includes('MANUT') ? '🔧' : m.tipo.includes('LOJA') ? '🏪' : m.tipo === 'EXTRAVIO' ? '⚠️' : '•'}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '2px' }}>
                        <span style={{ fontSize: '13px', fontWeight: '700', color: '#0f172a' }}>{TIPO_MOV_LABELS[m.tipo] ?? m.tipo}</span>
                        {m.origemDesc && m.destinoDesc && <span style={{ fontSize: '12px', color: '#64748b' }}>{m.origemDesc} → {m.destinoDesc}</span>}
                      </div>
                      {m.observacoes && <div style={{ fontSize: '12px', color: '#374151' }}>{m.observacoes}</div>}
                      <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
                        {new Date(m.createdAt).toLocaleString('pt-BR')} · {m.userName ?? 'Sistema'}
                      </div>
                    </div>
                    {m.statusNovo && <StatusBadge status={m.statusNovo} />}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {detailTab === 'anexos' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '12px' }}>
              <button onClick={() => setShowAnexo(!showAnexo)} style={{ padding: '7px 14px', borderRadius: '8px', border: '1px solid #2563eb', background: 'white', color: '#2563eb', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}>+ Adicionar Anexo</button>
            </div>
            {showAnexo && (
              <div style={{ background: '#f8fafc', borderRadius: '10px', padding: '16px', marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={row2}>
                  <Field label="Tipo">
                    <select style={inp} value={anexoForm.tipo} onChange={e => setAnexoForm(f => ({ ...f, tipo: e.target.value }))}>
                      {[['COMPROVANTE_ENTREGA','Comprovante de Entrega'],['FOTO_EQUIPAMENTO','Foto do Equipamento'],['FOTO_NUMERO','Foto do Número'],['LAUDO_MANUTENCAO','Laudo de Manutenção'],['DOCUMENTO','Documento'],['OUTRO','Outro']].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  </Field>
                  <Field label="Nome do Arquivo"><input style={inp} value={anexoForm.nomeArquivo} onChange={e => setAnexoForm(f => ({ ...f, nomeArquivo: e.target.value }))} placeholder="Opcional" /></Field>
                </div>
                <Field label="URL do Arquivo *"><input style={inp} value={anexoForm.url} onChange={e => setAnexoForm(f => ({ ...f, url: e.target.value }))} placeholder="https://..." /></Field>
                <Field label="Descrição"><input style={inp} value={anexoForm.descricao} onChange={e => setAnexoForm(f => ({ ...f, descricao: e.target.value }))} placeholder="Opcional" /></Field>
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                  <button onClick={() => setShowAnexo(false)} style={{ padding: '7px 14px', borderRadius: '8px', border: '1px solid #e2e8f0', background: 'white', cursor: 'pointer', fontSize: '13px', color: '#374151' }}>Cancelar</button>
                  <button onClick={() => addAnexoMut.mutate({ equipamentoId: item.id, ...anexoForm })} disabled={!anexoForm.url || addAnexoMut.isPending} style={{ padding: '7px 14px', borderRadius: '8px', border: 'none', background: '#2563eb', color: 'white', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}>Salvar</button>
                </div>
              </div>
            )}
            {(item.anexos ?? []).length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', color: '#94a3b8' }}>Nenhum anexo</div>
            ) : (item.anexos ?? []).map((a: any) => (
              <div key={a.id} style={{ display: 'flex', gap: '10px', padding: '10px 0', borderBottom: '1px solid #f1f5f9', alignItems: 'center' }}>
                <span style={{ fontSize: '20px' }}>📎</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '13px', fontWeight: '600', color: '#0f172a' }}>{a.nomeArquivo || a.tipo}</div>
                  {a.descricao && <div style={{ fontSize: '12px', color: '#64748b' }}>{a.descricao}</div>}
                  <div style={{ fontSize: '11px', color: '#94a3b8' }}>{new Date(a.createdAt).toLocaleString('pt-BR')} · {a.userName}</div>
                </div>
                <a href={a.url} target="_blank" rel="noopener noreferrer" style={{ padding: '5px 10px', borderRadius: '6px', border: '1px solid #e2e8f0', background: 'white', color: '#2563eb', fontSize: '12px', textDecoration: 'none', fontWeight: '600' }}>Ver</a>
              </div>
            ))}
          </div>
        )}

        {detailTab === 'entregas' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '12px' }}>
              <button onClick={() => setShowEntrega(true)} style={{ padding: '7px 14px', borderRadius: '8px', border: '1px solid #2563eb', background: 'white', color: '#2563eb', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}>+ Registrar Entrega</button>
            </div>
            {(item.entregas ?? []).length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', color: '#94a3b8' }}>Nenhuma entrega em loja registrada</div>
            ) : (item.entregas ?? []).map((e: any) => (
              <div key={e.id} style={{ padding: '14px', background: '#f8fafc', borderRadius: '10px', marginBottom: '10px' }}>
                <div style={{ display: 'flex', gap: '10px', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <div style={{ fontWeight: '600', fontSize: '14px', color: '#0f172a' }}>🏪 {e.lojaNome ?? 'Loja não identificada'}</div>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>{new Date(e.dataEntrega).toLocaleString('pt-BR')}</div>
                </div>
                <div style={{ fontSize: '13px', color: '#374151' }}>Recebido por: <strong>{e.nomeRecebedor}</strong>{e.cargoRecebedor ? ` (${e.cargoRecebedor})` : ''}</div>
                {e.observacoes && <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>{e.observacoes}</div>}
                {e.anexoUrl && <a href={e.anexoUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-block', marginTop: '6px', fontSize: '12px', color: '#2563eb', fontWeight: '600' }}>📎 Ver comprovante</a>}
                <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>Registrado por {e.userName}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  )
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function PatrimonioPage() {
  const [tab, setTab] = useState<'dashboard' | 'lista' | 'colaboradores'>('dashboard')
  const [search, setSearch] = useState('')
  const [filterTipo, setFilterTipo] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [editItem, setEditItem] = useState<any>(null)
  const [transferItem, setTransferItem] = useState<any>(null)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [entregaItem, setEntregaItem] = useState<any>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const utils = trpc.useUtils()
  function refetchAll() { utils.patrimonio.list.invalidate(); utils.patrimonio.dashboard.invalidate() }

  const { data: dash } = trpc.patrimonio.dashboard.useQuery()
  const { data: listData, isLoading } = trpc.patrimonio.list.useQuery({ pageSize: 500, search: search || undefined, tipo: filterTipo || undefined, status: filterStatus || undefined })
  const { data: colaboradores = [] } = trpc.patrimonio.listColaboradores.useQuery()
  const { data: lojas = [] } = trpc.patrimonio.listLojas.useQuery()
  const deleteMut = trpc.patrimonio.softDelete.useMutation({ onSuccess: () => { refetchAll(); setDeleteId(null) } })

  const items: any[] = listData?.items ?? []

  // Agrupamento por colaborador
  const byColaborador = useMemo(() => {
    const map = new Map<string, { nome: string; scanners: any[]; celulares: any[]; outros: any[] }>()
    for (const item of items) {
      if (item.status !== 'COM_COLABORADOR' || !item.colaboradorId) continue
      const key = item.colaboradorId
      const nome = item.colaboradorNome ?? colaboradores.find((c: any) => c.id === key)?.name ?? key.slice(0, 8)
      const prev = map.get(key) ?? { nome, scanners: [], celulares: [], outros: [] }
      if (item.tipo === 'scanner') prev.scanners.push(item)
      else if (item.tipo === 'celular') prev.celulares.push(item)
      else prev.outros.push(item)
      map.set(key, prev)
    }
    // Escritório
    const escritorio = items.filter(i => i.status === 'NO_ESCRITORIO')
    if (escritorio.length > 0) {
      map.set('__escritorio__', {
        nome: '🏢 Escritório',
        scanners: escritorio.filter(i => i.tipo === 'scanner'),
        celulares: escritorio.filter(i => i.tipo === 'celular'),
        outros: escritorio.filter(i => i.tipo !== 'scanner' && i.tipo !== 'celular'),
      })
    }
    const manut = items.filter(i => i.status === 'EM_MANUTENCAO')
    if (manut.length > 0) {
      map.set('__manutencao__', {
        nome: '🔧 Manutenção',
        scanners: manut.filter(i => i.tipo === 'scanner'),
        celulares: manut.filter(i => i.tipo === 'celular'),
        outros: manut.filter(i => i.tipo !== 'scanner' && i.tipo !== 'celular'),
      })
    }
    return Array.from(map.entries()).sort((a, b) => a[1].nome.localeCompare(b[1].nome))
  }, [items, colaboradores])

  const tdSt: React.CSSProperties = { padding: '10px 14px', borderBottom: '1px solid #f8fafc', fontSize: '13px', color: '#374151', verticalAlign: 'middle' }

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc' }}>
      {/* Modais */}
      {showCreate && <ModalCadastrar colaboradores={colaboradores} lojas={lojas} onClose={() => setShowCreate(false)} onSave={() => { refetchAll(); setShowCreate(false) }} />}
      {editItem && <ModalCadastrar initial={editItem} colaboradores={colaboradores} lojas={lojas} onClose={() => setEditItem(null)} onSave={() => { refetchAll(); setEditItem(null) }} />}
      {transferItem && <ModalTransferir item={transferItem} colaboradores={colaboradores} lojas={lojas} onClose={() => setTransferItem(null)} onSave={() => { refetchAll(); setTransferItem(null) }} />}
      {entregaItem && <ModalEntregaLoja item={entregaItem} lojas={lojas} onClose={() => setEntregaItem(null)} onSave={() => { refetchAll(); setEntregaItem(null) }} />}
      {detailId && <ModalDetalhe itemId={detailId} colaboradores={colaboradores} lojas={lojas} onClose={() => setDetailId(null)} onRefresh={refetchAll} />}
      {deleteId && (
        <Modal title="Confirmar Exclusão" onClose={() => setDeleteId(null)}>
          <p style={{ fontSize: '14px', color: '#374151', marginBottom: '20px' }}>Tem certeza que deseja excluir este patrimônio? Esta ação pode ser revertida pelo administrador.</p>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <button onClick={() => setDeleteId(null)} style={{ padding: '10px 20px', borderRadius: '8px', border: '1px solid #e2e8f0', background: 'white', cursor: 'pointer', fontSize: '14px', fontWeight: '600' }}>Cancelar</button>
            <button onClick={() => deleteMut.mutate({ id: deleteId })} disabled={deleteMut.isPending} style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', background: '#dc2626', color: 'white', cursor: 'pointer', fontSize: '14px', fontWeight: '600' }}>Excluir</button>
          </div>
        </Modal>
      )}

      {/* Header */}
      <div style={{ background: 'white', borderBottom: '1px solid #f1f5f9', padding: '20px 28px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: '800', color: '#0f172a', margin: 0 }}>📦 Patrimônio</h1>
          <div style={{ fontSize: '13px', color: '#64748b', marginTop: '2px' }}>Gestão de scanners, celulares e equipamentos da equipe</div>
        </div>
        <button onClick={() => setShowCreate(true)} style={{ padding: '10px 20px', borderRadius: '10px', border: 'none', background: '#2563eb', color: 'white', cursor: 'pointer', fontSize: '14px', fontWeight: '700' }}>+ Novo Patrimônio</button>
      </div>

      {/* Abas de navegação */}
      <div style={{ background: 'white', borderBottom: '1px solid #f1f5f9', padding: '0 28px', display: 'flex', gap: '0' }}>
        {([['dashboard','🏠 Resumo'],['lista','📋 Lista Geral'],['colaboradores','👥 Por Responsável']] as const).map(([t, l]) => (
          <button key={t} onClick={() => setTab(t)} style={{ padding: '14px 18px', border: 'none', borderBottom: tab === t ? '2px solid #2563eb' : '2px solid transparent', background: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: tab === t ? '700' : '500', color: tab === t ? '#2563eb' : '#64748b' }}>
            {l}
          </button>
        ))}
      </div>

      <div style={{ padding: '24px 28px' }}>

        {/* ── TAB: DASHBOARD ─────────────────────────────────────────────────── */}
        {tab === 'dashboard' && dash && (
          <div>
            {/* KPI Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '12px', marginBottom: '24px' }}>
              {[
                { label: 'Total', value: dash.counts.total, bg: '#f8fafc', color: '#0f172a', emoji: '📦' },
                { label: 'Scanners', value: dash.counts.scanner, bg: '#eff6ff', color: '#1d4ed8', emoji: '📡' },
                { label: 'Celulares', value: dash.counts.celular, bg: '#f0fdf4', color: '#15803d', emoji: '📱' },
                { label: 'Com Colaborador', value: dash.counts.comColaborador, bg: '#dbeafe', color: '#1d4ed8', emoji: '👤' },
                { label: 'No Escritório', value: dash.counts.noEscritorio, bg: '#f3e8ff', color: '#6b21a8', emoji: '🏢' },
                { label: 'Em Loja', value: dash.counts.emLoja, bg: '#fef9c3', color: '#854d0e', emoji: '🏪' },
                { label: 'Manutenção', value: dash.counts.emManutencao, bg: '#ffedd5', color: '#9a3412', emoji: '🔧' },
                { label: 'Verificar', value: dash.counts.emVerificacao + dash.counts.disponivel, bg: '#fef3c7', color: '#92400e', emoji: '🔍' },
              ].map(c => (
                <div key={c.label} style={{ background: c.bg, borderRadius: '12px', padding: '16px', border: '1px solid #f1f5f9' }}>
                  <div style={{ fontSize: '24px', marginBottom: '6px' }}>{c.emoji}</div>
                  <div style={{ fontSize: '28px', fontWeight: '800', color: c.color }}>{c.value}</div>
                  <div style={{ fontSize: '11px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', marginTop: '2px' }}>{c.label}</div>
                </div>
              ))}
            </div>

            {/* Listas rápidas */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
              {[
                { title: '🔍 Sem Posse / Verificar', items: dash.semPosse, emptyMsg: 'Nenhum item pendente' },
                { title: '🔧 Em Manutenção', items: dash.emManutencao, emptyMsg: 'Nenhum item em manutenção' },
                { title: '⏱️ Recentemente Atualizados', items: dash.recentes, emptyMsg: 'Sem movimentações' },
              ].map(({ title, items: qItems, emptyMsg }) => (
                <div key={title} style={{ background: 'white', borderRadius: '12px', border: '1px solid #f1f5f9', overflow: 'hidden' }}>
                  <div style={{ padding: '14px 16px', borderBottom: '1px solid #f1f5f9', fontWeight: '700', fontSize: '13px', color: '#0f172a' }}>{title}</div>
                  {qItems.length === 0 ? (
                    <div style={{ padding: '20px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>{emptyMsg}</div>
                  ) : qItems.map((eq: any) => (
                    <div key={eq.id} onClick={() => setDetailId(eq.id)} style={{ padding: '10px 16px', borderBottom: '1px solid #f8fafc', display: 'flex', gap: '8px', alignItems: 'center', cursor: 'pointer' }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#f8fafc')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'white')}>
                      <span style={{ fontSize: '14px' }}>{TIPOS.find(t => t.value === eq.tipo)?.emoji ?? '•'}</span>
                      <span style={{ fontWeight: '700', fontSize: '13px', color: '#0f172a', minWidth: '60px' }}>{eq.codigo}</span>
                      <StatusBadge status={eq.status} />
                      {eq.colaboradorNome && <span style={{ fontSize: '12px', color: '#64748b' }}>{eq.colaboradorNome}</span>}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── TAB: LISTA ─────────────────────────────────────────────────────── */}
        {tab === 'lista' && (
          <div>
            {/* Barra de busca e filtros */}
            <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
              <input
                placeholder="🔍 Buscar por código, colaborador, loja..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ ...inp, maxWidth: '340px', flex: '1' }}
              />
              <select style={{ ...inp, width: 'auto' }} value={filterTipo} onChange={e => setFilterTipo(e.target.value)}>
                <option value="">Todos os tipos</option>
                {TIPOS.map(t => <option key={t.value} value={t.value}>{t.emoji} {t.label}</option>)}
              </select>
              <select style={{ ...inp, width: 'auto' }} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                <option value="">Todos os status</option>
                {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.emoji} {v.label}</option>)}
              </select>
              {(search || filterTipo || filterStatus) && (
                <button onClick={() => { setSearch(''); setFilterTipo(''); setFilterStatus('') }} style={{ padding: '9px 14px', borderRadius: '8px', border: '1px solid #e2e8f0', background: 'white', cursor: 'pointer', fontSize: '13px', color: '#64748b' }}>✕ Limpar</button>
              )}
              <span style={{ fontSize: '13px', color: '#64748b', marginLeft: 'auto' }}>{items.length} item(ns)</span>
            </div>

            {/* Tabela */}
            <div style={{ background: 'white', borderRadius: '14px', border: '1px solid #f1f5f9', overflow: 'hidden' }}>
              {isLoading ? (
                <div style={{ padding: '48px', textAlign: 'center', color: '#94a3b8' }}>Carregando...</div>
              ) : items.length === 0 ? (
                <div style={{ padding: '48px', textAlign: 'center', color: '#94a3b8' }}>
                  <div style={{ fontSize: '32px', marginBottom: '8px' }}>📦</div>
                  <div style={{ fontWeight: '600' }}>Nenhum patrimônio encontrado</div>
                  <div style={{ fontSize: '13px', marginTop: '4px' }}>Cadastre o primeiro equipamento.</div>
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc' }}>
                      {['Código', 'Tipo', 'Status', 'Responsável', 'Condição', 'Última Atualização', 'Ações'].map(h => (
                        <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: '11px', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap', borderBottom: '1px solid #f1f5f9' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item: any, idx: number) => {
                      const responsavel = item.colaboradorNome ?? item.lojaNome ?? STATUS_CONFIG[item.status]?.label ?? '—'
                      return (
                        <tr key={item.id} style={{ background: idx % 2 === 0 ? 'white' : '#fafafa' }}
                          onMouseEnter={e => (e.currentTarget.style.background = '#f0f7ff')}
                          onMouseLeave={e => (e.currentTarget.style.background = idx % 2 === 0 ? 'white' : '#fafafa')}>
                          <td style={tdSt}>
                            <button onClick={() => setDetailId(item.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: '700', fontSize: '14px', color: '#2563eb', padding: 0 }}>{item.codigo}</button>
                            {item.descricao && <div style={{ fontSize: '11px', color: '#94a3b8' }}>{item.descricao}</div>}
                          </td>
                          <td style={tdSt}><TipoBadge tipo={item.tipo} /></td>
                          <td style={tdSt}><StatusBadge status={item.status} /></td>
                          <td style={tdSt}><span style={{ fontSize: '13px' }}>{responsavel}</span></td>
                          <td style={tdSt}><span style={{ fontSize: '12px', color: '#64748b' }}>{CONDICOES.find(c => c.value === item.condicao)?.label ?? '—'}</span></td>
                          <td style={tdSt}><span style={{ fontSize: '12px', color: '#64748b' }}>{new Date(item.updatedAt).toLocaleDateString('pt-BR')}</span></td>
                          <td style={tdSt}>
                            <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                              <button onClick={() => setDetailId(item.id)} style={{ padding: '4px 8px', borderRadius: '6px', border: '1px solid #e2e8f0', background: 'white', cursor: 'pointer', fontSize: '11px', fontWeight: '600', color: '#374151' }}>Ver</button>
                              <button onClick={() => setTransferItem(item)} style={{ padding: '4px 8px', borderRadius: '6px', border: '1px solid #bfdbfe', background: '#eff6ff', cursor: 'pointer', fontSize: '11px', fontWeight: '600', color: '#1d4ed8' }}>⇄</button>
                              <button onClick={() => setEditItem(item)} style={{ padding: '4px 8px', borderRadius: '6px', border: '1px solid #e2e8f0', background: 'white', cursor: 'pointer', fontSize: '11px', fontWeight: '600', color: '#374151' }}>✏️</button>
                              <button onClick={() => setEntregaItem(item)} style={{ padding: '4px 8px', borderRadius: '6px', border: '1px solid #fde68a', background: '#fffbeb', cursor: 'pointer', fontSize: '11px', fontWeight: '600', color: '#92400e' }}>🏪</button>
                              <button onClick={() => setDeleteId(item.id)} style={{ padding: '4px 8px', borderRadius: '6px', border: '1px solid #fecaca', background: '#fef2f2', cursor: 'pointer', fontSize: '11px', fontWeight: '600', color: '#dc2626' }}>✕</button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* ── TAB: POR RESPONSÁVEL ───────────────────────────────────────────── */}
        {tab === 'colaboradores' && (
          <div>
            {byColaborador.length === 0 ? (
              <div style={{ padding: '48px', textAlign: 'center', color: '#94a3b8', background: 'white', borderRadius: '12px' }}>Nenhum patrimônio atribuído ainda.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {byColaborador.map(([key, grupo]) => {
                  const total = grupo.scanners.length + grupo.celulares.length + grupo.outros.length
                  return (
                    <div key={key} style={{ background: 'white', borderRadius: '14px', border: '1px solid #f1f5f9', overflow: 'hidden' }}>
                      <div style={{ padding: '14px 20px', background: '#f8fafc', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ fontWeight: '700', fontSize: '15px', color: '#0f172a' }}>{grupo.nome}</div>
                        <div style={{ display: 'flex', gap: '10px', fontSize: '13px', color: '#64748b' }}>
                          {grupo.scanners.length > 0 && <span>📡 {grupo.scanners.length} scanner(s)</span>}
                          {grupo.celulares.length > 0 && <span>📱 {grupo.celulares.length} celular(es)</span>}
                          {grupo.outros.length > 0 && <span>🔧 {grupo.outros.length} outro(s)</span>}
                          <span style={{ fontWeight: '700', color: '#0f172a' }}>{total} total</span>
                        </div>
                      </div>
                      <div style={{ padding: '14px 20px', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                        {[...grupo.scanners, ...grupo.celulares, ...grupo.outros].map((eq: any) => (
                          <button key={eq.id} onClick={() => setDetailId(eq.id)} title={eq.descricao ?? ''}
                            style={{ padding: '6px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', background: 'white', cursor: 'pointer', fontSize: '13px', fontWeight: '600', color: '#374151', display: 'flex', gap: '5px', alignItems: 'center' }}>
                            <span>{TIPOS.find(t => t.value === eq.tipo)?.emoji}</span>
                            <span>{eq.codigo}</span>
                            {eq.condicao && eq.condicao !== 'bom' && <span style={{ fontSize: '10px', background: '#fef3c7', color: '#92400e', padding: '1px 5px', borderRadius: '10px' }}>{CONDICOES.find(c => c.value === eq.condicao)?.label}</span>}
                          </button>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
