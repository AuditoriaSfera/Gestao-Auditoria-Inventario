'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ReactNode } from 'react'
import {
  CDE_CATEGORY_LABELS, CDE_CATEGORY_COLORS,
  CDE_STATUS_LABELS, CDE_STATUS_COLORS,
  CDE_NATURE_LABELS, CDE_NATURE_COLORS,
} from '@/modules/cde/constants'

// As áreas internas do módulo CDE (sub-navegação).
export const CDE_TABS = [
  { href: '/modules/cde', label: 'Painel', icon: '📊' },
  { href: '/modules/cde/importacao', label: 'Importação', icon: '📥' },
  { href: '/modules/cde/validacao', label: 'Validação', icon: '✅' },
  { href: '/modules/cde/pendencias', label: 'Pendências', icon: '⚠️' },
  { href: '/modules/cde/historico', label: 'Histórico', icon: '🕑' },
  { href: '/modules/cde/parametrizacao', label: 'Parametrização', icon: '⚙️' },
]

export function CdeTabs() {
  const pathname = usePathname()
  return (
    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', borderBottom: '1px solid #e2e8f0', paddingBottom: '2px' }}>
      {CDE_TABS.map((t) => {
        const active = pathname === t.href
        return (
          <Link
            key={t.href}
            href={t.href}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              padding: '8px 14px', borderRadius: '8px 8px 0 0', fontSize: '14px',
              fontWeight: active ? 700 : 500,
              color: active ? '#1d4ed8' : '#64748b',
              background: active ? '#eff6ff' : 'transparent',
              borderBottom: active ? '2px solid #2563eb' : '2px solid transparent',
              textDecoration: 'none',
            }}
          >
            <span>{t.icon}</span>
            <span>{t.label}</span>
          </Link>
        )
      })}
    </div>
  )
}

export function Pill({ bg, text, children }: { bg: string; text: string; children: ReactNode }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', padding: '2px 10px',
      borderRadius: '99px', fontSize: '12px', fontWeight: 600, background: bg, color: text, whiteSpace: 'nowrap',
    }}>
      {children}
    </span>
  )
}

export function CategoryBadge({ category }: { category: string }) {
  const c = CDE_CATEGORY_COLORS[category] ?? { bg: '#f1f5f9', text: '#64748b' }
  return <Pill bg={c.bg} text={c.text}>{CDE_CATEGORY_LABELS[category] ?? category}</Pill>
}

export function StatusBadge({ status }: { status: string }) {
  const c = CDE_STATUS_COLORS[status] ?? { bg: '#f1f5f9', text: '#64748b' }
  const label = CDE_STATUS_LABELS[status] ?? (status === 'MIXED' ? 'Misto' : status)
  return <Pill bg={c.bg} text={c.text}>{label}</Pill>
}

export function NatureBadge({ nature }: { nature: string }) {
  const c = CDE_NATURE_COLORS[nature] ?? { bg: '#f1f5f9', text: '#64748b' }
  return <Pill bg={c.bg} text={c.text}>{CDE_NATURE_LABELS[nature] ?? nature}</Pill>
}

export function SlaDot({ state }: { state: 'GREEN' | 'YELLOW' | 'RED' }) {
  const map = { GREEN: '#16a34a', YELLOW: '#d97706', RED: '#dc2626' }
  return <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: map[state] }} />
}

export function Card({ children, style }: { children: ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.05)', ...style,
    }}>
      {children}
    </div>
  )
}

export function Kpi({ label, value, color, icon, sub }: { label: string; value: string | number; color?: string; icon?: string; sub?: string }) {
  return (
    <Card style={{ padding: '18px' }}>
      {icon && <div style={{ fontSize: '22px', marginBottom: '6px' }}>{icon}</div>}
      <div style={{ fontSize: '13px', color: '#64748b', marginBottom: '4px' }}>{label}</div>
      <div style={{ fontSize: '26px', fontWeight: 700, color: color ?? '#0f172a' }}>{value}</div>
      {sub && <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>{sub}</div>}
    </Card>
  )
}

export function selectStyle(): React.CSSProperties {
  return { padding: '8px 10px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '13px', color: '#374151', background: 'white' }
}
