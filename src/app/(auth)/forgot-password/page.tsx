'use client'

import { useState } from 'react'
import Link from 'next/link'
import { trpc } from '@/lib/trpc'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const requestMut = trpc.auth.requestPasswordReset.useMutation()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await requestMut.mutateAsync({ email })
      setSent(true)
    } catch (err: any) {
      setError(err?.message ?? 'Erro ao enviar e-mail.')
    } finally {
      setLoading(false)
    }
  }

  const inp: React.CSSProperties = {
    width: '100%', padding: '12px 16px', borderRadius: '10px',
    border: '2px solid #e5e7eb', fontSize: '15px', outline: 'none',
    background: '#f9fafb', color: '#0f172a', boxSizing: 'border-box',
    transition: 'border-color 0.2s',
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #0f172a 100%)', padding: '24px' }}>
      <div style={{ background: 'white', borderRadius: '20px', padding: '48px 40px', width: '100%', maxWidth: '440px', boxShadow: '0 25px 50px rgba(0,0,0,0.4)' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ width: '56px', height: '56px', borderRadius: '14px', background: 'linear-gradient(135deg, #1d4ed8, #3b82f6)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', fontWeight: '800', color: 'white', margin: '0 auto 16px' }}>S</div>
          <h1 style={{ margin: '0 0 6px', fontSize: '20px', fontWeight: '700', color: '#0f172a' }}>Esqueci minha senha</h1>
          <p style={{ margin: 0, fontSize: '13px', color: '#64748b', lineHeight: 1.5 }}>
            Informe seu e-mail e enviaremos um link para criar uma nova senha.
          </p>
        </div>

        {sent ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>📧</div>
            <h2 style={{ fontSize: '17px', fontWeight: '700', color: '#0f172a', margin: '0 0 10px' }}>E-mail enviado!</h2>
            <p style={{ fontSize: '13px', color: '#64748b', lineHeight: 1.6, marginBottom: '24px' }}>
              Se houver uma conta com esse e-mail, você receberá as instruções em instantes. Verifique também a pasta de spam.
            </p>
            <Link href="/login" style={{ fontSize: '13px', color: '#2563eb', textDecoration: 'none', fontWeight: '600' }}>
              ← Voltar para o login
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>
                E-mail
              </label>
              <input
                type="email"
                placeholder="seu@email.com.br"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoFocus
                style={inp}
                onFocus={e => { e.target.style.borderColor = '#3b82f6'; e.target.style.background = 'white' }}
                onBlur={e => { e.target.style.borderColor = '#e5e7eb'; e.target.style.background = '#f9fafb' }}
              />
            </div>

            {error && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', padding: '10px 14px', fontSize: '13px', color: '#dc2626' }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                padding: '14px', borderRadius: '10px', border: 'none',
                background: loading ? '#93c5fd' : 'linear-gradient(135deg, #1d4ed8, #3b82f6)',
                color: 'white', fontSize: '15px', fontWeight: '600',
                cursor: loading ? 'not-allowed' : 'pointer',
                boxShadow: '0 4px 12px rgba(37,99,235,0.3)',
              }}
            >
              {loading ? 'Enviando...' : 'Enviar link de redefinição'}
            </button>

            <div style={{ textAlign: 'center' }}>
              <Link href="/login" style={{ fontSize: '13px', color: '#64748b', textDecoration: 'none' }}>
                ← Voltar para o login
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
