'use client'

export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { trpc } from '@/lib/trpc'
import { ModulePage, DataCard, EmptyState, LoadingState, Btn } from '@/components/shared/module-page'
import { formatDate, formatCurrency } from '@/lib/utils'

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  NOT_SENT:  { label: 'Não enviado',  color: '#92400e', bg: '#fef3c7' },
  SENT:      { label: 'Enviado',      color: '#1d4ed8', bg: '#dbeafe' },
  VIEWED:    { label: 'Visualizado',  color: '#6d28d9', bg: '#ede9fe' },
  ANSWERED:  { label: 'Respondido',   color: '#065f46', bg: '#d1fae5' },
  PENDING:   { label: 'Pendente',     color: '#dc2626', bg: '#fef2f2' },
}

const inp = { width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1.5px solid #e2e8f0', fontSize: '15px', boxSizing: 'border-box' as const }

function maskMoney(raw: string) {
  const digits = raw.replace(/\D/g, '')
  if (!digits) return ''
  return (parseInt(digits) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{ background: 'white', borderRadius: '16px', width: '100%', maxWidth: '520px', maxHeight: '92vh', overflow: 'auto', boxShadow: '0 25px 50px rgba(0,0,0,0.25)' }}>
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
  const [showTrip, setShowTrip] = useState(false)
  const [selectedCollab, setSelectedCollab] = useState('')
  const [selectedTrip, setSelectedTrip] = useState('')
  const [generatedLink, setGeneratedLink] = useState<{ id: string; token: string; collaborator: { name: string; phone?: string | null } } | null>(null)
  const [collabName, setCollabName] = useState('')
  const [collabRole, setCollabRole] = useState('')
  const [collabPhone, setCollabPhone] = useState('')
  const [collabEmail, setCollabEmail] = useState('')
  // Trip (orçamento)
  const [tripCollab, setTripCollab] = useState('')
  const [tripReason, setTripReason] = useState('')
  const [tripCity, setTripCity] = useState('')
  const [tripState, setTripState] = useState('')
  const [tripStart, setTripStart] = useState(new Date().toISOString().slice(0, 10))
  const [tripEnd, setTripEnd] = useState(new Date().toISOString().slice(0, 10))
  const [tripReleasedRaw, setTripReleasedRaw] = useState('')
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

  const createTripMut = trpc.auditTrips.create.useMutation({
    onSuccess: (data: any) => {
      utils.auditTrips.list.invalidate()
      setShowTrip(false)
      setSelectedTrip(data.id)           // já deixa selecionada no Gerar Link
      setSelectedCollab(data.collaboratorId || tripCollab)
      setTripReason(''); setTripCity(''); setTripState(''); setTripReleasedRaw(''); setTripCollab('')
      setError('')
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

  function handleCreateTrip() {
    if (!tripCollab) { setError('Selecione o colaborador da viagem.'); return }
    if (!tripReleasedRaw) { setError('Informe o valor destinado (orçamento) da viagem.'); return }
    setError('')
    createTripMut.mutate({
      collaboratorId: tripCollab,
      reason: tripReason || undefined,
      city: tripCity || undefined,
      state: tripState || undefined,
      startDate: new Date(tripStart),
      endDate: new Date(tripEnd),
      releasedAmount: parseInt(tripReleasedRaw) / 100,
    })
  }

  const allTrips = trips?.trips ?? []
  const selectedTripObj = allTrips.find((t: any) => t.id === selectedTrip)

  // Viagens visíveis no Gerar Link: se um colaborador foi escolhido, filtra pelas dele
  const tripsForCollab = selectedCollab ? allTrips.filter((t: any) => t.collaboratorId === selectedCollab) : allTrips

  return (
    <ModulePage
      title="Formulário"
      description="Gere links de formulário para os colaboradores lançarem despesas pelo celular. Cada resposta abate automaticamente do orçamento (viagem) destinado ao colaborador."
      actions={
        <div style={{ display: 'flex', gap: '8px' }}>
          <Btn variant="outline" onClick={() => setShowCollaborator(true)}>+ Colaborador</Btn>
          <Btn variant="outline" onClick={() => { setShowTrip(true); setTripCollab(selectedCollab); setError('') }}>+ Viagem</Btn>
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
                <select style={inp} value={selectedCollab} onChange={e => { setSelectedCollab(e.target.value); setSelectedTrip('') }}>
                  <option value="">Selecione...</option>
                  {(collabs ?? []).map((c: any) => <option key={c.id} value={c.id}>{c.name}{c.role ? ` — ${c.role}` : ''}</option>)}
                </select>
              </Field>

              <Field label="Viagem / Orçamento vinculado" hint="A despesa respondida será abatida do saldo desta viagem.">
                <div style={{ display: 'flex', gap: '8px' }}>
                  <select style={{ ...inp, flex: 1 }} value={selectedTrip} onChange={e => setSelectedTrip(e.target.value)}>
                    <option value="">Nenhuma (sem abatimento)</option>
                    {tripsForCollab.map((t: any) => (
                      <option key={t.id} value={t.id}>
                        {t.collaborator?.name} — {t.reason || t.city || t.id.slice(0, 8)} ({formatCurrency(t.balance)} disp.)
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => { setShowTrip(true); setTripCollab(selectedCollab); setError('') }}
                    style={{ padding: '0 14px', borderRadius: '10px', border: '1.5px solid #2563eb', background: '#eff6ff', color: '#2563eb', fontSize: '13px', fontWeight: '700', cursor: 'pointer', whiteSpace: 'nowrap' }}
                  >+ Nova</button>
                </div>
              </Field>

              {/* Card de orçamento da viagem selecionada */}
              {selectedTripObj && (
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '14px', marginBottom: '16px' }}>
                  <div style={{ fontSize: '12px', fontWeight: '700', color: '#475569', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Orçamento da viagem</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                    <div><div style={{ fontSize: '11px', color: '#94a3b8' }}>Liberado</div><div style={{ fontSize: '15px', fontWeight: '700', color: '#0f172a' }}>{formatCurrency(selectedTripObj.releasedAmount)}</div></div>
                    <div><div style={{ fontSize: '11px', color: '#94a3b8' }}>Já gasto</div><div style={{ fontSize: '15px', fontWeight: '700', color: '#dc2626' }}>{formatCurrency(selectedTripObj.spentAmount)}</div></div>
                    <div><div style={{ fontSize: '11px', color: '#94a3b8' }}>Saldo</div><div style={{ fontSize: '15px', fontWeight: '700', color: selectedTripObj.balance < 0 ? '#dc2626' : '#16a34a' }}>{formatCurrency(selectedTripObj.balance)}</div></div>
                  </div>
                </div>
              )}

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

      {/* Modal Nova Viagem (orçamento) */}
      {showTrip && (
        <Modal title="Nova Viagem / Orçamento" onClose={() => { setShowTrip(false); setError('') }}>
          {error && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '10px 14px', marginBottom: '16px', fontSize: '13px', color: '#dc2626' }}>{error}</div>}
          <Field label="Colaborador *" hint="O orçamento será destinado a este colaborador.">
            <select style={inp} value={tripCollab} onChange={e => setTripCollab(e.target.value)}>
              <option value="">Selecione...</option>
              {(collabs ?? []).map((c: any) => <option key={c.id} value={c.id}>{c.name}{c.role ? ` — ${c.role}` : ''}</option>)}
            </select>
          </Field>
          <Field label="Motivo da Viagem"><input style={inp} value={tripReason} onChange={e => setTripReason(e.target.value)} placeholder="Ex: Inventário mensal" /></Field>
          <div style={{ display: 'flex', gap: '12px' }}>
            <div style={{ flex: 1 }}><Field label="Cidade"><input style={inp} value={tripCity} onChange={e => setTripCity(e.target.value)} /></Field></div>
            <div style={{ width: '90px' }}><Field label="UF"><input style={inp} value={tripState} onChange={e => setTripState(e.target.value)} placeholder="MG" maxLength={2} /></Field></div>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <div style={{ flex: 1 }}><Field label="Início *"><input style={inp} type="date" value={tripStart} onChange={e => setTripStart(e.target.value)} /></Field></div>
            <div style={{ flex: 1 }}><Field label="Fim *"><input style={inp} type="date" value={tripEnd} onChange={e => setTripEnd(e.target.value)} /></Field></div>
          </div>
          <Field label="Valor Destinado / Liberado (R$) *" hint="Total que o colaborador pode gastar nesta viagem.">
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#64748b', fontSize: '15px', fontWeight: '600' }}>R$</span>
              <input style={{ ...inp, paddingLeft: '40px', fontSize: '18px', fontWeight: '700' }} inputMode="numeric" value={maskMoney(tripReleasedRaw)} onChange={e => setTripReleasedRaw(e.target.value.replace(/\D/g, ''))} placeholder="0,00" />
            </div>
          </Field>
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <Btn variant="outline" onClick={() => { setShowTrip(false); setError('') }}>Cancelar</Btn>
            <Btn onClick={handleCreateTrip} disabled={createTripMut.isPending}>{createTripMut.isPending ? 'Salvando...' : 'Criar Viagem'}</Btn>
          </div>
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

      {/* Orçamentos por viagem — mostra o abatimento acontecendo */}
      <DataCard title={`Orçamentos por Viagem (${allTrips.length})`}>
        {!allTrips.length ? (
          <EmptyState icon="🗺️" title="Nenhuma viagem cadastrada" description='Clique em "+ Viagem" para destinar um orçamento a um colaborador.' />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {allTrips.map((t: any) => {
              const pct = t.releasedAmount > 0 ? Math.min(100, (t.spentAmount / t.releasedAmount) * 100) : 0
              const over = t.spentAmount > t.releasedAmount
              return (
                <div key={t.id} style={{ border: `1.5px solid ${over ? '#fecaca' : '#e2e8f0'}`, borderRadius: '12px', padding: '14px', background: over ? '#fff5f5' : 'white' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px', flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ fontWeight: '700', fontSize: '15px', color: '#0f172a' }}>{t.collaborator?.name ?? '—'}</div>
                      <div style={{ fontSize: '12px', color: '#64748b' }}>{t.reason || ''} {t.city ? `· ${t.city}${t.state ? '/' + t.state : ''}` : ''}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '16px', fontWeight: '800', color: over ? '#dc2626' : '#0f172a' }}>{formatCurrency(t.spentAmount)} <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: '500' }}>/ {formatCurrency(t.releasedAmount)}</span></div>
                      <div style={{ fontSize: '12px', fontWeight: '700', color: over ? '#dc2626' : '#16a34a' }}>
                        {over ? `⚠️ Excedeu ${formatCurrency(Math.abs(t.balance))}` : `Saldo: ${formatCurrency(t.balance)}`}
                      </div>
                    </div>
                  </div>
                  {t.releasedAmount > 0 && (
                    <div style={{ marginTop: '10px', background: '#f1f5f9', borderRadius: '5px', height: '8px' }}>
                      <div style={{ background: over ? '#dc2626' : pct > 80 ? '#f59e0b' : '#22c55e', borderRadius: '5px', height: '8px', width: `${Math.min(100, pct)}%`, transition: 'width 0.5s' }} />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </DataCard>

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
