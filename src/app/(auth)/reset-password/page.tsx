'use client'

import { Suspense, useState, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { trpc } from '@/lib/trpc'

function ResetPasswordForm() {
  const params = useSearchParams()
  const router = useRouter()
  const token = params.get('token') ?? ''
  const [form, setForm] = useState({ password: '', confirm: '' })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  const resetMut = trpc.auth.resetPassword.useMutation()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (form.password.length < 8) { setError('A senha deve ter ao menos 8 caracteres.'); return }
    if (form.password !== form.confirm) { setError('As senhas não coincidem.'); return }
    setLoading(true)
    try {
      await resetMut.mutateAsync({ token, newPassword: form.password })
      setSuccess(true)
    } catch (err: any) {
      setError(err?.message ?? 'Erro ao redefinir senha.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (success) {
      const t = setTimeout(() => router.replace('/login'), 3000)
      return () => clearTimeout(t)
    }
  }, [success, router])

  const inp: React.CSSProperties = {
    width: '100%', padding: '12px 16px', borderRadius: '10px',
    border: '2px solid #e5e7eb', fontSize: '15px', outline: 'none',
    background: '#f9fafb', color: '#0f172a', boxSizing: 'border-box',
    transition: 'border-color 0.2s',
  }

  if (!token) {
    return (
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>❌</div>
        <h2 style={{ fontSize: '17px', fontWeight: '700', color: '#0f172a', margin: '0 0 10px' }}>Link inválido</h2>
        <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '24px' }}>Este link de redefinição é inválido ou expirou.</p>
        <Link href="/forgot-password" style={{ fontSize: '13px', color: '#2563eb', textDecoration: 'none', fontWeight: '600' }}>Solicitar novo link</Link>
      </div>
    )
  }

  if (success) {
    return (
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>✅</div>
        <h2 style={{ fontSize: '17px', fontWeight: '700', color: '#0f172a', margin: '0 0 10px' }}>Senha redefinida!</h2>
        <p style={{ fontSize: '13px', color: '#64748b', lineHeight: 1.6, marginBottom: '24px' }}>
          Sua senha foi alterada com sucesso. Você será redirecionado para o login em instantes...
        </p>
        <Link href="/login" style={{ fontSize: '13px', color: '#2563eb', textDecoration: 'none', fontWeight: '600' }}>
          Ir para o login agora
        </Link>
      </div>
    )
  }

  return (
    <>
      <div style={{ textAlign: 'center', marginBottom: '32px' }}>
        <div style={{ width: '56px', height: '56px', borderRadius: '14px', background: 'linear-gradient(135deg, #1d4ed8, #3b82f6)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', fontWeight: '800', color: 'white', margin: '0 auto 16px' }}>S</div>
        <h1 style={{ margin: '0 0 6px', fontSize: '20px', fontWeight: '700', color: '#0f172a' }}>Nova senha</h1>
        <p style={{ margin: 0, fontSize: '13px', color: '#64748b', lineHeight: 1.5 }}>
          Crie uma senha forte para sua conta.
        </p>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
        <div>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>
            Nova senha
          </label>
          <input
            type="password"
            placeholder="Mínimo 8 caracteres"
            value={form.password}
            onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
            required
            autoFocus
            style={inp}
            onFocus={e => { e.target.style.borderColor = '#3b82f6'; e.target.style.background = 'white' }}
            onBlur={e => { e.target.style.borderColor = '#e5e7eb'; e.target.style.background = '#f9fafb' }}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>
            Confirmar nova senha
          </label>
          <input
            type="password"
            placeholder="Repita a nova senha"
            value={form.confirm}
            onChange={e => setForm(f => ({ ...f, confirm: e.target.value }))}
            required
            style={inp}
            onFocus={e => { e.target.style.borderColor = '#3b82f6'; e.target.style.background = 'white' }}
            onBlur={e => { e.target.style.borderColor = '#e5e7eb'; e.target.style.background = '#f9fafb' }}
          />
          {form.confirm && form.password !== form.confirm && (
            <div style={{ fontSize: '12px', color: '#dc2626', marginTop: '4px' }}>As senhas não coincidem.</div>
          )}
          {form.confirm && form.password === form.confirm && form.confirm.length >= 8 && (
            <div style={{ fontSize: '12px', color: '#16a34a', marginTop: '4px' }}>✓ Senhas coincidem.</div>
          )}
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
          {loading ? 'Salvando...' : 'Salvar nova senha'}
        </button>
      </form>
    </>
  )
}

export default function ResetPasswordPage() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #0f172a 100%)', padding: '24px' }}>
      <div style={{ background: 'white', borderRadius: '20px', padding: '48px 40px', width: '100%', maxWidth: '440px', boxShadow: '0 25px 50px rgba(0,0,0,0.4)' }}>
        <Suspense fallback={<div style={{ textAlign: 'center', color: '#64748b' }}>Carregando...</div>}>
          <ResetPasswordForm />
        </Suspense>
      </div>
    </div>
  )
}
