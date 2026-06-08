'use client'

export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { trpc } from '@/lib/trpc'
import { ModulePage, DataCard, EmptyState, LoadingState, Btn } from '@/components/shared/module-page'
import { formatDate } from '@/lib/utils'

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  NOT_SENT:  { label: 'Não enviado',  color: '#92400e', bg: '#fef3c7' },
  SENT:      { label: 'Enviado',      color: '#1d4ed8', bg: '#dbeafe' },
  VIEWED:    { label: 'Visualizado',  color: '#6d28d9', bg: '#ede9fe' },
  ANSWERED:  { label: 'Respondido',   color: '#065f46', bg: '#d1fae5' },
  PENDING:   { label: 'Pendente',     color: '#dc2626', bg: '#fef2f2' },
}

const inp = { width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1.5px solid #e2e8f0', fontSize: '15px', boxSizing: 'border-box' as const }

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{ background: 'white', borderRadius: '16px', width: '100%', maxWidth: '520px', maxHeight: '90vh', overflow: 'auto', boxShadow: '0 25px 50px rgba(0,0,0,0.25)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', borderBottom: '1px solid #f1f5f9', position: 'sticky', top: 0, background: 'white' }}>
          <h2 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: '#0f172a' }}>{title}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#94a3b8', lineHeight: 1 }}>×</button>
        </div>
        <div style={{ padding: '24px' }}>{children}</div>
      </div>
    </div>
  )
}
function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div style={{ marginBottom: '16px' }}>
      <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '5px' }}>{label}</label>
      {children}
      {hint && <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '3px' }}>{hint}</div>}
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_LABELS[status] ?? { label: status, color: '#64748b', bg: '#f1f5f9' }
  return <span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '600', color: s.color, background: s.bg }}>{s.label}</span>
}

export default function FormularioPage() {
  const [showGenerate, setShowGenerate] = useState(false)
  const [showCollaborator, setShowCollaborator] = useState(false)
  const [selectedCollab, setSelectedCollab] = useState('')
  const [selectedTrip, setSelectedTrip] = useState('')
  const [generatedLink, setGeneratedLink] = useState<{ id: string; token: string; collaborator: { name: string; phone?: string | null } } | null>(null)
  const [collabName, setCollabName] = useState('')
  const [collabRole, setCollabRole] = useState('')
  const [collabPhone, setCollabPhone] = useState('')
  const [collabEmail, setCollabEmail] = useState('')
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  const utils = trpc.useUtils()
  const { data: links, isLoading } = trpc.auditForms.listLinks.useQuery()
  const { data: collabs } = trpc.auditCollaborators.list.useQuery()
  const { data: trips } = trpc.auditTrips.list.useQuery({ pageSize: 100 })

  const generateMut = trpc.auditForms.generateLink.useMutation({
    onSuccess: (data: any) => {
      setGeneratedLink(data)
      utils.auditForms.listLinks.invalidate()
    },
    onError: e => setError(e.message),
  })

  const markSentMut = trpc.auditForms.markSent.useMutation({
    onSuccess: () => utils.auditForms.listLinks.invalidate(),
  })

  const deleteMut = trpc.auditForms.delete.useMutation({
    onSuccess: () => utils.auditForms.listLinks.invalidate(),
  })

  const createCollabMut = trpc.auditCollaborators.create.useMutation({
    onSuccess: () => {
      utils.auditCollaborators.list.invalidate()
      setShowCollaborator(false)
      setCollabName(''); setCollabRole(''); setCollabPhone(''); setCollabEmail(''); setError('')
    },
    onError: e => setError(e.message),
  })

  function getFormUrl(token: string) {
    return `${window.location.origin}/formulario/${token}`
  }

  function handleCopy(token: string) {
    navigator.clipboard.writeText(getFormUrl(token))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function handleWhatsApp(link: any) {
    const url = getFormUrl(link.token)
    const phone = link.collaborator?.phone?.replace(/\D/g, '')
    const msg = encodeURIComponent(`Olá ${link.collaborator?.name || ''}! 😊\nSegue o link para lançamento de despesa de auditoria:\n${url}\n\nPreencha assim que possível. Qualquer dúvida, pode chamar! 🙏`)
    const wa = phone ? `https://wa.me/55${phone}?text=${msg}` : `https://wa.me/?text=${msg}`
    window.open(wa, '_blank')
    markSentMut.mutate({ id: link.id })
  }

  function handleGenerate() {
    if (!selectedCollab) { setError('Selecione um colaborador.'); return }
    setError('')
    generateMut.mutate({ collaboratorId: selectedCollab, tripId: selectedTrip || undefined })
  }

  return (
    <ModulePage
      title="Formulário"
      description="Gere e compartilhe links de formulário para colaboradores lançarem despesas pelo celular"
      actions={
        <div style={{ display: 'flex', gap: '8px' }}>
          <Btn variant="outline" onClick={() => setShowCollaborator(true)}>+ Colaborador</Btn>
          <Btn onClick={() => { setShowGenerate(true); setGeneratedLink(null); setError('') }}>Gerar Link</Btn>
        </div>
      }
    >
      {/* Modal Gerar Link */}
      {showGenerate && (
        <Modal title="Gerar Link de Formulário" onClose={() => setShowGenerate(false)}>
          {error && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '10px 14px', marginBottom: '16px', fontSize: '13px', color: '#dc2626' }}>{error}</div>}

          {!generatedLink ? (
            <>
              <Field label="Colaborador *">
                <select style={inp} value={selectedCollab} onChange={e => setSelectedCollab(e.target.value)}>
                  <option value="">Selecione...</option>
                  {(collabs ?? []).map((c: any) => <option key={c.id} value={c.id}>{c.name}{c.role ? ` — ${c.role}` : ''}</option>)}
                </select>
              </Field>
              <Field label="Viagem vinculada (opcional)">
                <select style={inp} value={selectedTrip} onChange={e => setSelectedTrip(e.target.value)}>
                  <option value="">Nenhuma</option>
                  {(trips?.trips ?? []).map((t: any) => <option key={t.id} value={t.id}>{t.collaborator?.name} — {t.reason || t.city || t.id.slice(0, 8)}</option>)}
                </select>
              </Field>
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <Btn variant="outline" onClick={() => setShowGenerate(false)}>Cancelar</Btn>
                <Btn onClick={handleGenerate} disabled={generateMut.isPending}>{generateMut.isPending ? 'Gerando...' : 'Gerar Link'}</Btn>
              </div>
            </>
          ) : (
            <div>
              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '12px', padding: '16px', marginBottom: '20px' }}>
                <div style={{ fontSize: '13px', fontWeight: '700', color: '#065f46', marginBottom: '6px' }}>✅ Link gerado para {generatedLink.collaborator.name}</div>
                <div style={{ fontFamily: 'monospace', fontSize: '12px', color: '#047857', wordBreak: 'break-all', background: 'white', padding: '8px', borderRadius: '6px', border: '1px solid #a7f3d0' }}>
                  {getFormUrl(generatedLink.token)}
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <button
                  onClick={() => handleCopy(generatedLink.token)}
                  style={{ padding: '12px', borderRadius: '10px', border: '1.5px solid #d1d5db', background: copied ? '#f0fdf4' : 'white', fontSize: '14px', cursor: 'pointer', fontWeight: '600', color: copied ? '#065f46' : '#374151' }}
                >
                  {copied ? '✓ Copiado!' : '📋 Copiar Link'}
                </button>
                <button
                  onClick={() => handleWhatsApp(generatedLink)}
                  style={{ padding: '12px', borderRadius: '10px', border: 'none', background: '#25D366', color: 'white', fontSize: '14px', cursor: 'pointer', fontWeight: '700' }}
                >
                  📱 Enviar pelo WhatsApp
                </button>
              </div>
              <button onClick={() => { setShowGenerate(false); setGeneratedLink(null) }} style={{ width: '100%', marginTop: '12px', padding: '10px', background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '13px' }}>Fechar</button>
            </div>
          )}
        </Modal>
      )}

      {/* Modal Novo Colaborador */}
      {showCollaborator && (
        <Modal title="Novo Colaborador" onClose={() => { setShowCollaborator(false); setError('') }}>
          {error && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '10px 14px', marginBottom: '16px', fontSize: '13px', color: '#dc2626' }}>{error}</div>}
          <Field label="Nome *"><input style={inp} value={collabName} onChange={e => setCollabName(e.target.value)} placeholder="Nome completo" /></Field>
          <Field label="Cargo / Função"><input style={inp} value={collabRole} onChange={e => setCollabRole(e.target.value)} placeholder="Ex: Auditor, Supervisor" /></Field>
          <Field label="WhatsApp" hint="Com DDD, sem espaços. Ex: 31999998888"><input style={inp} value={collabPhone} onChange={e => setCollabPhone(e.target.value)} inputMode="tel" placeholder="31999998888" /></Field>
          <Field label="E-mail (opcional)"><input style={inp} type="email" value={collabEmail} onChange={e => setCollabEmail(e.target.value)} /></Field>
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <Btn variant="outline" onClick={() => { setShowCollaborator(false); setError('') }}>Cancelar</Btn>
            <Btn onClick={() => createCollabMut.mutate({ name: collabName, role: collabRole || undefined, phone: collabPhone || undefined, email: collabEmail || undefined })} disabled={createCollabMut.isPending}>
              {createCollabMut.isPending ? 'Salvando...' : 'Salvar'}
            </Btn>
          </div>
        </Modal>
      )}

      {/* Lista de links */}
      <DataCard title={`Links de Formulário (${links?.length ?? 0})`}>
        {isLoading ? <LoadingState /> : !links?.length ? (
          <EmptyState icon="🔗" title="Nenhum link gerado" description='Clique em "Gerar Link" para criar um formulário e compartilhar com o colaborador.' />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {links.map((link: any) => (
              <div key={link.id} style={{ border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px', background: link.status === 'ANSWERED' ? '#f0fdf4' : 'white' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: '160px' }}>
                    <div style={{ fontWeight: '700', fontSize: '15px', color: '#0f172a' }}>{link.collaborator?.name}</div>
                    {link.collaborator?.phone && <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>📱 {link.collaborator.phone}</div>}
                    {link.trip && <div style={{ fontSize: '12px', color: '#2563eb', marginTop: '2px' }}>🗺️ {link.trip.reason || link.trip.city || 'Viagem'}</div>}
                    <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>Gerado em {formatDate(link.createdAt)}</div>
                    {link.sentAt && <div style={{ fontSize: '11px', color: '#94a3b8' }}>Enviado em {formatDate(link.sentAt)}</div>}
                    {link.answeredAt && <div style={{ fontSize: '11px', color: '#065f46' }}>✓ Respondido em {formatDate(link.answeredAt)}</div>}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                    <StatusBadge status={link.status} />
                    {link.status !== 'ANSWERED' && (
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button onClick={() => handleCopy(link.token)} style={{ padding: '6px 12px', borderRadius: '8px', border: '1px solid #d1d5db', background: 'white', fontSize: '12px', cursor: 'pointer', fontWeight: '600' }}>Copiar</button>
                        <button onClick={() => handleWhatsApp(link)} style={{ padding: '6px 12px', borderRadius: '8px', border: 'none', background: '#25D366', color: 'white', fontSize: '12px', cursor: 'pointer', fontWeight: '700' }}>WhatsApp</button>
                      </div>
                    )}
                    {link.status === 'ANSWERED' && (
                      <div style={{ fontSize: '12px', color: '#065f46', fontWeight: '600' }}>
                        R$ {Number(link.response?.value ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        <span style={{ color: '#94a3b8', fontWeight: '400', marginLeft: '4px' }}>— {link.response?.costCenter}</span>
                      </div>
                    )}
                    <button onClick={() => deleteMut.mutate({ id: link.id })} style={{ padding: '4px 8px', borderRadius: '6px', border: '1px solid #fecaca', background: '#fef2f2', fontSize: '11px', cursor: 'pointer', color: '#dc2626' }}>Excluir</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </DataCard>

      {/* Colaboradores cadastrados */}
      <DataCard title={`Colaboradores (${collabs?.length ?? 0})`}>
        {!collabs?.length ? (
          <EmptyState icon="👥" title="Nenhum colaborador" description='Clique em "+ Colaborador" para cadastrar.' />
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
            {collabs.map((c: any) => (
              <div key={c.id} style={{ padding: '10px 14px', border: '1px solid #e2e8f0', borderRadius: '10px', background: 'white', minWidth: '160px' }}>
                <div style={{ fontWeight: '600', color: '#0f172a', fontSize: '14px' }}>{c.name}</div>
                {c.role && <div style={{ fontSize: '12px', color: '#64748b' }}>{c.role}</div>}
                {c.phone && <div style={{ fontSize: '12px', color: '#2563eb' }}>📱 {c.phone}</div>}
              </div>
            ))}
          </div>
        )}
      </DataCard>
    </ModulePage>
  )
}
