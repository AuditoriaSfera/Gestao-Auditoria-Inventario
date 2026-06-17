'use client'

import { ReactNode } from 'react'

interface StatCard {
  label: string
  value: string | number
  sub?: string
  color?: string
  icon?: string
}

interface ModulePageProps {
  title: string
  description?: string
  actions?: ReactNode
  stats?: StatCard[]
  children: ReactNode
}

export function ModulePage({ title, description, actions, stats, children }: ModulePageProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: '700', color: '#0f172a', margin: '0 0 4px' }}>{title}</h1>
          {description && <p style={{ fontSize: '14px', color: '#64748b', margin: 0 }}>{description}</p>}
        </div>
        {actions && <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>{actions}</div>}
      </div>

      {/* Stats */}
      {stats && stats.length > 0 && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${Math.min(stats.length, 4)}, 1fr)`,
          gap: '16px',
        }}>
          {stats.map((s, i) => (
            <div key={i} style={{
              background: 'white',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '20px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            }}>
              {s.icon && <div style={{ fontSize: '24px', marginBottom: '8px' }}>{s.icon}</div>}
              <div style={{ fontSize: '13px', color: '#64748b', marginBottom: '4px' }}>{s.label}</div>
              <div style={{ fontSize: '26px', fontWeight: '700', color: s.color || '#0f172a' }}>{s.value}</div>
              {s.sub && <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>{s.sub}</div>}
            </div>
          ))}
        </div>
      )}

      {/* Content */}
      {children}
    </div>
  )
}

export function DataCard({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <div style={{
      background: 'white',
      border: '1px solid #e2e8f0',
      borderRadius: '12px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
      overflow: 'hidden',
      height: '100%',
      boxSizing: 'border-box',
      display: 'flex',
      flexDirection: 'column',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '16px 20px', borderBottom: '1px solid #f1f5f9', flexShrink: 0,
      }}>
        <h3 style={{ fontSize: '15px', fontWeight: '600', color: '#0f172a', margin: 0 }}>{title}</h3>
        {action}
      </div>
      <div style={{ padding: '20px', flex: 1 }}>{children}</div>
    </div>
  )
}

export function StatusBadge({ status, label, colorMap }: {
  status: string
  label?: string
  colorMap?: Record<string, { bg: string; text: string }>
}) {
  const defaults: Record<string, { bg: string; text: string }> = {
    OPEN: { bg: '#dbeafe', text: '#1d4ed8' },
    ACTIVE: { bg: '#dcfce7', text: '#16a34a' },
    PENDING: { bg: '#fef3c7', text: '#d97706' },
    CLOSED: { bg: '#f1f5f9', text: '#64748b' },
    ERROR: { bg: '#fee2e2', text: '#dc2626' },
    CRITICAL: { bg: '#fee2e2', text: '#dc2626' },
    HIGH: { bg: '#ffedd5', text: '#ea580c' },
    MEDIUM: { bg: '#fef3c7', text: '#d97706' },
    LOW: { bg: '#dcfce7', text: '#16a34a' },
    ACCEPTED: { bg: '#dcfce7', text: '#16a34a' },
    CONTESTED: { bg: '#fee2e2', text: '#dc2626' },
    FINALIZED: { bg: '#dcfce7', text: '#16a34a' },
    RECEIVED: { bg: '#dcfce7', text: '#16a34a' },
    LATE: { bg: '#fee2e2', text: '#dc2626' },
  }
  const map = { ...defaults, ...colorMap }
  const style = map[status] || { bg: '#f1f5f9', text: '#64748b' }
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '2px 10px', borderRadius: '99px',
      fontSize: '12px', fontWeight: '600',
      background: style.bg, color: style.text,
    }}>
      {label || status}
    </span>
  )
}

export function EmptyState({ icon, title, description }: { icon: string; title: string; description: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '48px 24px' }}>
      <div style={{ fontSize: '40px', marginBottom: '12px' }}>{icon}</div>
      <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#374151', margin: '0 0 8px' }}>{title}</h3>
      <p style={{ fontSize: '14px', color: '#9ca3af', margin: 0 }}>{description}</p>
    </div>
  )
}

export function LoadingState() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '48px' }}>
      <div style={{
        width: '32px', height: '32px', borderRadius: '50%',
        border: '3px solid #e2e8f0', borderTopColor: '#3b82f6',
        animation: 'spin 0.8s linear infinite',
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

export function Btn({
  children, onClick, variant = 'primary', small = false, disabled = false
}: {
  children: ReactNode
  onClick?: () => void
  variant?: 'primary' | 'outline' | 'danger' | 'ghost'
  small?: boolean
  disabled?: boolean
}) {
  const styles: Record<string, React.CSSProperties> = {
    primary: { background: '#2563eb', color: 'white', border: '1px solid #2563eb' },
    outline: { background: 'white', color: '#374151', border: '1px solid #d1d5db' },
    danger: { background: '#dc2626', color: 'white', border: '1px solid #dc2626' },
    ghost: { background: 'transparent', color: '#64748b', border: '1px solid transparent' },
  }
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: small ? '6px 12px' : '9px 16px',
        borderRadius: '8px',
        fontSize: small ? '13px' : '14px',
        fontWeight: '500',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        display: 'inline-flex', alignItems: 'center', gap: '6px',
        transition: 'opacity 0.15s',
        ...styles[variant],
      }}
    >
      {children}
    </button>
  )
}
