'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { trpc } from '@/lib/trpc'
import { useAuthStore } from '@/lib/stores/auth'
import { Eye, EyeOff, Loader2, ShieldCheck, BarChart3, Package } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const { setToken } = useAuthStore()
  const [showPassword, setShowPassword] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [emailError, setEmailError] = useState('')
  const [passwordError, setPasswordError] = useState('')

  const signIn = trpc.auth.signIn.useMutation({
    onSuccess: (data) => {
      setToken(data.token)
      document.cookie = `session-token=${data.token}; path=/; max-age=${8 * 3600}; SameSite=Strict`
      router.push('/dashboard')
    },
    onError: (error) => {
      setErrorMsg(error.message || 'Erro ao entrar. Verifique suas credenciais.')
    },
  })

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setEmailError('')
    setPasswordError('')
    setErrorMsg('')
    let valid = true
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmailError('E-mail inválido')
      valid = false
    }
    if (!password) {
      setPasswordError('Senha obrigatória')
      valid = false
    }
    if (!valid) return
    signIn.mutate({ email, password })
  }

  const isSubmitting = signIn.isPending

  return (
    <div style={{ minHeight: '100vh', display: 'flex', background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #0f172a 100%)' }}>
      {/* Painel esquerdo — hero */}
      <div style={{
        flex: 1,
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '60px',
        color: 'white',
        display: 'none'
      }} className="hero-panel">
        <div style={{ maxWidth: '480px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '48px' }}>
            <div style={{
              width: '48px', height: '48px', borderRadius: '12px',
              background: '#2563eb', display: 'flex', alignItems: 'center',
              justifyContent: 'center', fontSize: '20px', fontWeight: 'bold'
            }}>S</div>
            <span style={{ fontSize: '20px', fontWeight: '600', letterSpacing: '-0.5px' }}>Sfera Multifranquias</span>
          </div>

          <h1 style={{ fontSize: '42px', fontWeight: '700', lineHeight: '1.1', marginBottom: '24px', letterSpacing: '-1px' }}>
            Plataforma de<br />Auditoria & Gestão
          </h1>
          <p style={{ fontSize: '16px', opacity: '0.7', lineHeight: '1.7', marginBottom: '48px' }}>
            Controle operacional completo para sua rede de franquias. Inventário, perdas, rondas e indicadores em um único lugar.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {[
              { icon: '📦', title: 'Inventário Digital', desc: 'Fechamento e análise de resultados' },
              { icon: '🔍', title: 'Ronda de Auditoria', desc: 'Checklists e pendências em campo' },
              { icon: '📊', title: 'Dashboards Executivos', desc: 'KPIs em tempo real por loja e regional' },
            ].map((item) => (
              <div key={item.title} style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ fontSize: '24px' }}>{item.icon}</div>
                <div>
                  <div style={{ fontWeight: '600', fontSize: '15px' }}>{item.title}</div>
                  <div style={{ opacity: '0.6', fontSize: '13px' }}>{item.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Painel direito — formulário */}
      <div style={{
        width: '100%',
        maxWidth: '500px',
        margin: '0 auto',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
      }}>
        <div style={{
          background: 'white',
          borderRadius: '20px',
          padding: '48px 40px',
          width: '100%',
          boxShadow: '0 25px 50px rgba(0,0,0,0.4)',
        }}>
          {/* Logo */}
          <div style={{ textAlign: 'center', marginBottom: '36px' }}>
            <div style={{
              width: '64px', height: '64px', borderRadius: '16px',
              background: 'linear-gradient(135deg, #1d4ed8, #3b82f6)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 16px',
              boxShadow: '0 8px 24px rgba(37,99,235,0.4)',
              fontSize: '28px', fontWeight: '800', color: 'white',
            }}>S</div>
            <h1 style={{ fontSize: '24px', fontWeight: '700', color: '#0f172a', margin: '0 0 4px', letterSpacing: '-0.5px' }}>
              Sfera Multifranquias
            </h1>
            <p style={{ fontSize: '14px', color: '#64748b', margin: 0 }}>
              Plataforma de Auditoria e Gestão
            </p>
          </div>

          {/* Formulário */}
          <form onSubmit={onSubmit} autoComplete="new-password">
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>
                E-mail
              </label>
              <input
                type="text"
                inputMode="email"
                placeholder="seu@email.com.br"
                autoComplete="new-password"
                value={email}
                onChange={e => { setEmail(e.target.value); setEmailError('') }}
                style={{
                  width: '100%', padding: '12px 16px',
                  border: emailError ? '2px solid #ef4444' : '2px solid #e5e7eb',
                  borderRadius: '10px', fontSize: '15px', outline: 'none',
                  background: '#f9fafb', color: '#0f172a',
                  boxSizing: 'border-box',
                  transition: 'border-color 0.2s',
                }}
                onFocus={(e) => { e.target.style.borderColor = '#3b82f6'; e.target.style.background = 'white' }}
                onBlur={(e) => { e.target.style.borderColor = emailError ? '#ef4444' : '#e5e7eb'; e.target.style.background = '#f9fafb' }}
              />
              {emailError && (
                <p style={{ fontSize: '12px', color: '#ef4444', marginTop: '4px' }}>{emailError}</p>
              )}
            </div>

            <div style={{ marginBottom: '28px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>
                Senha
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  value={password}
                  onChange={e => { setPassword(e.target.value); setPasswordError('') }}
                  style={{
                    width: '100%', padding: '12px 48px 12px 16px',
                    border: passwordError ? '2px solid #ef4444' : '2px solid #e5e7eb',
                    borderRadius: '10px', fontSize: '15px', outline: 'none',
                    background: '#f9fafb', color: '#0f172a',
                    boxSizing: 'border-box',
                    transition: 'border-color 0.2s',
                  }}
                  onFocus={(e) => { e.target.style.borderColor = '#3b82f6'; e.target.style.background = 'white' }}
                  onBlur={(e) => { e.target.style.borderColor = passwordError ? '#ef4444' : '#e5e7eb'; e.target.style.background = '#f9fafb' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af',
                    display: 'flex', alignItems: 'center',
                  }}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {passwordError && (
                <p style={{ fontSize: '12px', color: '#ef4444', marginTop: '4px' }}>{passwordError}</p>
              )}
            </div>

            {errorMsg && (
              <div style={{
                background: '#fef2f2', border: '1px solid #fecaca',
                borderRadius: '10px', padding: '12px 16px', marginBottom: '20px',
                fontSize: '13px', color: '#dc2626',
              }}>
                {errorMsg}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              style={{
                width: '100%', padding: '14px',
                background: isSubmitting
                  ? '#93c5fd'
                  : 'linear-gradient(135deg, #1d4ed8, #3b82f6)',
                color: 'white', border: 'none', borderRadius: '10px',
                fontSize: '15px', fontWeight: '600', cursor: isSubmitting ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                transition: 'opacity 0.2s',
                boxShadow: '0 4px 12px rgba(37,99,235,0.3)',
              }}
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} />
                  Entrando...
                </>
              ) : 'Entrar na plataforma'}
            </button>
          </form>

          {/* Stats */}
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
            gap: '12px', marginTop: '32px',
            paddingTop: '24px', borderTop: '1px solid #f1f5f9',
          }}>
            {[
              { icon: <ShieldCheck size={18} />, label: 'Auditoria', color: '#3b82f6' },
              { icon: <Package size={18} />, label: 'Inventário', color: '#8b5cf6' },
              { icon: <BarChart3 size={18} />, label: 'Indicadores', color: '#10b981' },
            ].map((item) => (
              <div key={item.label} style={{ textAlign: 'center' }}>
                <div style={{ color: item.color, display: 'flex', justifyContent: 'center', marginBottom: '4px' }}>
                  {item.icon}
                </div>
                <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '500' }}>{item.label}</div>
              </div>
            ))}
          </div>

          <div style={{ textAlign: 'center', marginTop: '20px' }}>
            <Link
              href="/forgot-password"
              style={{ fontSize: '13px', color: '#3b82f6', textDecoration: 'none', fontWeight: '500' }}
            >
              Esqueci minha senha
            </Link>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @media (min-width: 900px) {
          .hero-panel { display: flex !important; }
        }
      `}</style>
    </div>
  )
}
