'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { APP_NAME, MODULE_LABELS } from '@/lib/constants'
import {
  LayoutDashboard,
  ClipboardList,
  Truck,
  TrendingDown,
  PackageCheck,
  Search,
  DollarSign,
  Box,
  Warehouse,
  Users,
  BarChart3,
  Settings,
  Bell,
  Upload,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Building2,
} from 'lucide-react'
import { useState } from 'react'
import { trpc } from '@/lib/trpc'
import { Badge } from '@/components/ui/badge'

type NavItem = {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  badge?: number | null
  children?: { href: string; label: string }[]
}

const navItems: NavItem[] = [
  {
    href: '/dashboard',
    label: 'Dashboard',
    icon: LayoutDashboard,
  },
  {
    href: '/pending',
    label: 'Pendências',
    icon: AlertCircle,
  },
  {
    href: '/imports',
    label: 'Importações',
    icon: Upload,
  },
  {
    href: '/modules/cde',
    label: MODULE_LABELS['cde']!,
    icon: ClipboardList,
  },
  {
    href: '/modules/note-transit',
    label: MODULE_LABELS['note-transit']!,
    icon: Truck,
    children: [
      { href: '/modules/note-transit', label: 'Visão Geral' },
      { href: '/modules/note-transit/importacao', label: 'Importação de Dados' },
    ],
  },
  {
    href: '/modules/write-offs',
    label: MODULE_LABELS['write-offs']!,
    icon: TrendingDown,
  },
  {
    href: '/modules/merchandise',
    label: MODULE_LABELS['merchandise']!,
    icon: PackageCheck,
  },
  {
    href: '/modules/audit-round',
    label: MODULE_LABELS['audit-round']!,
    icon: Search,
  },
  {
    href: '/modules/audit-cost',
    label: 'Custo Auditoria',
    icon: DollarSign,
    children: [
      { href: '/modules/audit-cost/viagens', label: 'Cadastro de Viagens' },
      { href: '/modules/audit-cost/salarios', label: 'Salários e Encargos' },
      { href: '/modules/audit-cost/dashboard', label: 'Dashboard' },
    ],
  },
  {
    href: '/modules/assets',
    label: MODULE_LABELS['assets']!,
    icon: Box,
  },
  {
    href: '/modules/inventory',
    label: MODULE_LABELS['inventory']!,
    icon: Warehouse,
    children: [
      { href: '/modules/inventory', label: 'Inventários' },
      { href: '/modules/inventory-kpi', label: 'KPI do Time' },
      { href: '/modules/inventory-cost', label: 'Custos' },
    ],
  },
  {
    href: '/modules/strategic',
    label: MODULE_LABELS['strategic']!,
    icon: BarChart3,
  },
]

const adminItems: NavItem[] = [
  { href: '/admin/users', label: 'Usuários', icon: Users },
  { href: '/admin/stores', label: 'Lojas', icon: Building2 },
  { href: '/admin/roles', label: 'Perfis e Permissões', icon: Settings },
  { href: '/admin/parameters', label: 'Parâmetros', icon: Settings },
]

function NavLink({ item, collapsed }: { item: NavItem; collapsed: boolean }) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const isActive = pathname.startsWith(item.href)
  const hasChildren = item.children && item.children.length > 0

  if (hasChildren) {
    return (
      <div>
        <button
          onClick={() => setOpen(!open)}
          className={cn(
            'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
            isActive
              ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
              : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
          )}
        >
          <item.icon className="h-4 w-4 shrink-0" />
          {!collapsed && (
            <>
              <span className="flex-1 truncate text-left">{item.label}</span>
              {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            </>
          )}
        </button>
        {open && !collapsed && (
          <div className="ml-7 mt-1 space-y-1 border-l border-sidebar-border pl-3">
            {item.children!.map((child) => (
              <Link
                key={child.href}
                href={child.href}
                className={cn(
                  'block rounded px-2 py-1.5 text-xs transition-colors',
                  pathname === child.href
                    ? 'text-sidebar-primary font-medium'
                    : 'text-sidebar-foreground/60 hover:text-sidebar-foreground'
                )}
              >
                {child.label}
              </Link>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <Link
      href={item.href}
      className={cn(
        'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
        isActive
          ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
          : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
      )}
    >
      <item.icon className="h-4 w-4 shrink-0" />
      {!collapsed && (
        <span className="flex-1 truncate">{item.label}</span>
      )}
      {!collapsed && item.badge != null && item.badge > 0 && (
        <Badge variant="destructive" className="h-5 px-1.5 text-[10px]">
          {item.badge > 99 ? '99+' : item.badge}
        </Badge>
      )}
    </Link>
  )
}

export function Sidebar({ collapsed = false }: { collapsed?: boolean }) {
  const { data: pendingSummary } = trpc.pending.summary.useQuery(undefined, {
    refetchInterval: 60000,
  })
  const { data: unreadCount } = trpc.notifications.unreadCount.useQuery(undefined, {
    refetchInterval: 30000,
  })

  const navWithBadges = navItems.map((item) => {
    if (item.href === '/pending') return { ...item, badge: pendingSummary?.open }
    return item
  })

  return (
    <aside
      className={cn(
        'flex h-screen flex-col bg-sidebar transition-all duration-300',
        collapsed ? 'w-16' : 'w-64'
      )}
    >
      {/* Logo / Brand */}
      <div className="flex h-16 items-center gap-3 border-b border-sidebar-border px-4">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary text-white text-xs font-bold">
          S
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-sidebar-foreground">{APP_NAME}</p>
            <p className="text-[10px] text-sidebar-foreground/50">Plataforma de Auditoria</p>
          </div>
        )}
      </div>

      {/* Nav principal */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-1">
        {navWithBadges.map((item) => (
          <NavLink key={item.href} item={item} collapsed={collapsed} />
        ))}

        {!collapsed && (
          <div className="pt-4 pb-1">
            <p className="px-3 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/40">
              Administração
            </p>
          </div>
        )}
        {adminItems.map((item) => (
          <NavLink key={item.href} item={item} collapsed={collapsed} />
        ))}
      </nav>

      {/* Rodapé */}
      <div className="border-t border-sidebar-border p-3">
        <Link
          href="/notifications"
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground transition-colors"
        >
          <Bell className="h-4 w-4 shrink-0" />
          {!collapsed && (
            <>
              <span>Notificações</span>
              {unreadCount != null && unreadCount > 0 && (
                <Badge variant="destructive" className="ml-auto h-5 px-1.5 text-[10px]">
                  {unreadCount}
                </Badge>
              )}
            </>
          )}
        </Link>
      </div>
    </aside>
  )
}
