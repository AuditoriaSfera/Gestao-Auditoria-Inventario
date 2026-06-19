'use client'

export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { trpc } from '@/lib/trpc'

export default function ChangePasswordPage() {
  const router = useRouter()
  const utils = trpc.useUtils()
  const [form, setForm] = useState({ current: '', next: '', confirm: '' })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const changeMut = trpc.auth.changePassword.useMutation()

  function set(k: string, v: string) { setForm(f => ({ ...f, [k]: v })) }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (form.next.length < 8) { setError('A nova senha deve ter ao menos 8 caracteres.'); return }
    if (form.next !== form.confirm) { setError('As senhas não coincidem.'); return }
    setSaving(true)
    try {
      await changeMut.mutateAsync({ currentPassword: form.current, newPassword: form.next })
      await utils.auth.me.invalidate()
      router.replace('/dashboard')
    } catch (err: any) {
      setError(err?.message ?? 'Erro ao alterar senha.')
    } finally {
      setSaving(false)
    }
  }

  const inp: React.CSSProperties = {
    width: '100%', padding: '11px 14px', borderRadius: '10px',
    border: '1.5px solid #e2e8f0', fontSize: '15px',
    boxSizing: 'border-box', outline: 'none',
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%)',
      position: 'fixed', inset: 0, zIndex: 9999,
    }}>
      <div style={{ background: 'white', borderRadius: '20px', padding: '40px', width: '100%', maxWidth: '420px', boxShadow: '0 20px 60px rgba(0,0,0,0.12)' }}>
        {/* Ícone + título */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '26px', margin: '0 auto 14px' }}>🔑</div>
          <h1 style={{ margin: 0, fontSize: '20px', fontWeight: '800', color: '#0f172a' }}>Altere sua senha</h1>
          <p style={{ margin: '8px 0 0', fontSize: '14px', color: '#64748b', lineHeight: 1.5 }}>
            Por segurança, você precisa criar uma nova senha antes de continuar.
          </p>
        </div>

        {error && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', padding: '10px 14px', marginBottom: '20px', fontSize: '13px', color: '#dc2626' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>
              Senha atual
            </label>
            <input
              type="password"
              style={inp}
              value={form.current}
              onChange={e => set('current', e.target.value)}
              placeholder="Digite sua senha atual"
              required
              autoFocus
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>
              Nova senha
            </label>
            <input
              type="password"
              style={inp}
              value={form.next}
              onChange={e => set('next', e.target.value)}
              placeholder="Mínimo 8 caracteres"
              required
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>
              Confirmar nova senha
            </label>
            <input
              type="password"
              style={inp}
              value={form.confirm}
              onChange={e => set('confirm', e.target.value)}
              placeholder="Repita a nova senha"
              required
            />
            {form.confirm && form.next !== form.confirm && (
              <div style={{ fontSize: '12px', color: '#dc2626', marginTop: '4px' }}>As senhas não coincidem.</div>
            )}
            {form.confirm && form.next === form.confirm && form.confirm.length >= 8 && (
              <div style={{ fontSize: '12px', color: '#16a34a', marginTop: '4px' }}>✓ Senhas coincidem.</div>
            )}
          </div>

          <button
            type="submit"
            disabled={saving}
            style={{
              padding: '13px', borderRadius: '12px', border: 'none',
              background: saving ? '#94a3b8' : '#0f172a',
              color: 'white', fontSize: '15px', fontWeight: '700',
              cursor: saving ? 'not-allowed' : 'pointer', marginTop: '4px',
              transition: 'background 0.15s',
            }}
          >
            {saving ? 'Salvando...' : 'Salvar nova senha'}
          </button>
        </form>

        <div style={{ marginTop: '20px', padding: '12px 16px', background: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>Dicas para uma senha segura</div>
          <ul style={{ margin: 0, padding: '0 0 0 16px', fontSize: '12px', color: '#64748b', lineHeight: 1.7 }}>
            <li>Ao menos 8 caracteres</li>
            <li>Misture letras maiúsculas e minúsculas</li>
            <li>Inclua números e símbolos</li>
            <li>Evite datas de nascimento ou sequências simples</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
