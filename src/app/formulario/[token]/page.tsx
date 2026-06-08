'use client'

import { useState, use } from 'react'
import { trpc } from '@/lib/trpc'

const COST_CENTERS = ['Alimentação','Hospedagem','Combustível','Pedágio','Estacionamento','Passagem','Aluguel de carro','Carro de aplicativo','Outros']
const PAYMENT_METHODS = ['Adiantamento','Cartão Bruno','Cartão Combustível','Pix','Dinheiro','Reembolso']

const s = {
  page: { minHeight: '100vh', background: '#f8fafc', fontFamily: 'system-ui, -apple-system, sans-serif', padding: '0 0 60px' } as React.CSSProperties,
  header: { background: '#1e40af', color: 'white', padding: '20px 20px 24px', textAlign: 'center' as const },
  logo: { fontSize: '13px', opacity: 0.8, marginBottom: '6px' },
  title: { fontSize: '20px', fontWeight: '700', margin: 0 },
  subtitle: { fontSize: '13px', opacity: 0.75, marginTop: '4px' },
  body: { maxWidth: '480px', margin: '0 auto', padding: '20px 16px' },
  card: { background: 'white', borderRadius: '16px', padding: '20px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', marginBottom: '12px' },
  sectionTitle: { fontSize: '12px', fontWeight: '700', color: '#2563eb', textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: '14px' },
  field: { marginBottom: '16px' } as React.CSSProperties,
  label: { display: 'block', fontSize: '14px', fontWeight: '600', color: '#1e293b', marginBottom: '6px' } as React.CSSProperties,
  hint: { fontSize: '12px', color: '#94a3b8', marginTop: '3px' } as React.CSSProperties,
  inp: { width: '100%', padding: '12px 14px', borderRadius: '10px', border: '1.5px solid #e2e8f0', fontSize: '16px', boxSizing: 'border-box' as const, background: 'white', WebkitAppearance: 'none' as const, outline: 'none' },
  inpFocus: { borderColor: '#2563eb' },
  btn: { width: '100%', padding: '16px', background: '#1e40af', color: 'white', border: 'none', borderRadius: '12px', fontSize: '16px', fontWeight: '700', cursor: 'pointer', marginTop: '4px' } as React.CSSProperties,
  btnDisabled: { opacity: 0.6, cursor: 'not-allowed' } as React.CSSProperties,
  chips: { display: 'flex', flexWrap: 'wrap' as const, gap: '8px', marginTop: '2px' },
  chip: { padding: '9px 16px', borderRadius: '20px', fontSize: '14px', cursor: 'pointer', border: '1.5px solid #e2e8f0', background: 'white', fontWeight: '500' } as React.CSSProperties,
  chipActive: { background: '#2563eb', color: 'white', border: '1.5px solid #2563eb' } as React.CSSProperties,
  error: { background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', padding: '12px 16px', fontSize: '14px', color: '#dc2626', marginBottom: '16px' } as React.CSSProperties,
  success: { background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '16px', padding: '32px 24px', textAlign: 'center' as const } as React.CSSProperties,
}

function formatMoney(v: string) {
  const n = v.replace(/\D/g, '')
  if (!n) return ''
  const val = (parseInt(n) / 100).toFixed(2)
  return val.replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

export default function FormularioPublico({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params)
  const { data: link, isLoading } = trpc.auditForms.getByToken.useQuery({ token })

  const [storeName, setStoreName] = useState('')
  const [cityUf, setCityUf] = useState('')
  const [costCenter, setCostCenter] = useState('')
  const [reason, setReason] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [valueRaw, setValueRaw] = useState('')
  const [observations, setObservations] = useState('')
  const [error, setError] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const submitMut = trpc.auditForms.submitResponse.useMutation({
    onSuccess: () => setSubmitted(true),
    onError: e => setError(e.message),
  })

  function handleValue(v: string) {
    const digits = v.replace(/\D/g, '')
    setValueRaw(digits)
  }
  const displayValue = valueRaw ? formatMoney(valueRaw) : ''
  const numericValue = valueRaw ? parseInt(valueRaw) / 100 : 0

  function handleSubmit() {
    if (!storeName || !costCenter || !reason || !paymentMethod || !date || !valueRaw) {
      setError('Preencha todos os campos obrigatórios (*).')
      return
    }
    setError('')
    submitMut.mutate({ token, storeName, cityUf: cityUf || undefined, costCenter, reason, paymentMethod, date: new Date(date), value: numericValue, observations: observations || undefined })
  }

  if (isLoading) {
    return (
      <div style={{ ...s.page, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', color: '#64748b' }}>
          <div style={{ fontSize: '32px', marginBottom: '12px' }}>⏳</div>
          <div>Carregando formulário...</div>
        </div>
      </div>
    )
  }

  if (!link) {
    return (
      <div style={{ ...s.page, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', padding: '24px', maxWidth: '320px' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔗</div>
          <div style={{ fontSize: '18px', fontWeight: '700', color: '#0f172a', marginBottom: '8px' }}>Link inválido</div>
          <div style={{ color: '#64748b', fontSize: '14px' }}>Este link não existe ou expirou.</div>
        </div>
      </div>
    )
  }

  if (link.response || submitted) {
    return (
      <div style={s.page}>
        <div style={s.header}>
          <div style={s.logo}>Sfera Multifranquias</div>
          <div style={s.title}>Custo de Auditoria</div>
        </div>
        <div style={s.body}>
          <div style={s.success}>
            <div style={{ fontSize: '56px', marginBottom: '16px' }}>✅</div>
            <div style={{ fontSize: '20px', fontWeight: '700', color: '#166534', marginBottom: '8px' }}>Formulário enviado!</div>
            <div style={{ color: '#15803d', fontSize: '14px' }}>
              {link.collaborator?.name ? `Obrigado, ${link.collaborator.name}!` : 'Obrigado!'} Suas informações foram registradas com sucesso.
            </div>
            {link.response && (
              <div style={{ marginTop: '20px', background: 'white', borderRadius: '10px', padding: '16px', textAlign: 'left', fontSize: '13px' }}>
                <div style={{ fontWeight: '600', marginBottom: '10px', color: '#0f172a' }}>Resumo do lançamento:</div>
                {[
                  ['Loja', link.response.storeName],
                  ['Centro de Custo', link.response.costCenter],
                  ['Motivo', link.response.reason],
                  ['Forma de Pagamento', link.response.paymentMethod],
                  ['Valor', `R$ ${Number(link.response.value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`],
                ].map(([k, v]) => v && (
                  <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid #f1f5f9' }}>
                    <span style={{ color: '#64748b' }}>{k}</span>
                    <span style={{ fontWeight: '600', color: '#0f172a' }}>{v}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={s.page}>
      <div style={s.header}>
        <div style={s.logo}>Sfera Multifranquias</div>
        <div style={s.title}>Lançamento de Despesa</div>
        <div style={s.subtitle}>Auditoria e Inventário</div>
      </div>

      <div style={s.body}>
        {error && <div style={s.error}>{error}</div>}

        {/* Info do colaborador */}
        <div style={{ ...s.card, background: '#eff6ff', border: '1px solid #bfdbfe' }}>
          <div style={{ fontSize: '13px', color: '#1e40af', fontWeight: '600' }}>👤 {link.collaborator?.name}</div>
          {link.collaborator?.role && <div style={{ fontSize: '12px', color: '#3b82f6', marginTop: '2px' }}>{link.collaborator.role}</div>}
          {link.trip && <div style={{ fontSize: '12px', color: '#1e40af', marginTop: '6px' }}>🗺️ Viagem: {link.trip.reason || link.trip.city || 'Não especificado'}</div>}
        </div>

        {/* Responsável */}
        <div style={s.card}>
          <div style={s.sectionTitle}>Identificação</div>

          <div style={s.field}>
            <label style={s.label}>Loja Inventariada *</label>
            <input style={s.inp} value={storeName} onChange={e => setStoreName(e.target.value)} placeholder="Ex: ER Caratinga" />
          </div>

          <div style={s.field}>
            <label style={s.label}>Cidade / UF</label>
            <input style={s.inp} value={cityUf} onChange={e => setCityUf(e.target.value)} placeholder="Ex: Caratinga / MG" />
          </div>

          <div style={s.field}>
            <label style={s.label}>Data da Despesa *</label>
            <input style={s.inp} type="date" value={date} onChange={e => setDate(e.target.value)} />
          </div>
        </div>

        {/* Centro de Custo */}
        <div style={s.card}>
          <div style={s.sectionTitle}>Centro de Custo *</div>
          <div style={s.chips}>
            {COST_CENTERS.map(c => (
              <button key={c} style={{ ...s.chip, ...(costCenter === c ? s.chipActive : {}) }} onClick={() => setCostCenter(c)}>{c}</button>
            ))}
          </div>
        </div>

        {/* Motivo */}
        <div style={s.card}>
          <div style={s.sectionTitle}>Detalhes</div>
          <div style={s.field}>
            <label style={s.label}>Motivo / Descrição *</label>
            <input style={s.inp} value={reason} onChange={e => setReason(e.target.value)} placeholder="Ex: Almoço da equipe" />
          </div>

          <div style={s.field}>
            <label style={s.label}>Valor *</label>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#64748b', fontSize: '16px', fontWeight: '600' }}>R$</span>
              <input
                style={{ ...s.inp, paddingLeft: '40px', fontSize: '20px', fontWeight: '700', letterSpacing: '0.5px' }}
                inputMode="numeric"
                value={displayValue}
                onChange={e => handleValue(e.target.value)}
                placeholder="0,00"
              />
            </div>
          </div>
        </div>

        {/* Forma de Pagamento */}
        <div style={s.card}>
          <div style={s.sectionTitle}>Forma de Pagamento *</div>
          <div style={s.chips}>
            {PAYMENT_METHODS.map(p => (
              <button key={p} style={{ ...s.chip, ...(paymentMethod === p ? s.chipActive : {}) }} onClick={() => setPaymentMethod(p)}>{p}</button>
            ))}
          </div>
        </div>

        {/* Observações */}
        <div style={s.card}>
          <div style={{ ...s.field, marginBottom: 0 }}>
            <label style={s.label}>Observações</label>
            <textarea style={{ ...s.inp, minHeight: '80px', resize: 'none', fontSize: '15px' }} value={observations} onChange={e => setObservations(e.target.value)} placeholder="Informações adicionais..." />
          </div>
        </div>

        <button
          style={{ ...s.btn, ...(submitMut.isPending ? s.btnDisabled : {}) }}
          onClick={handleSubmit}
          disabled={submitMut.isPending}
        >
          {submitMut.isPending ? 'Enviando...' : '✓ Enviar Lançamento'}
        </button>
      </div>
    </div>
  )
}
