'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { Sidebar } from '@/components/layout/sidebar'
import { Header } from '@/components/layout/header'
import { usePathname, useRouter } from 'next/navigation'
import { MODULE_LABELS } from '@/lib/constants'
import { trpc } from '@/lib/trpc'

function getPageTitle(pathname: string): string {
  if (pathname === '/dashboard') return 'Dashboard'
  if (pathname.startsWith('/pending')) return 'Central de Pendências'
  if (pathname.startsWith('/imports')) return 'Central de Importações'
  if (pathname.startsWith('/admin/users')) return 'Usuários'
  if (pathname.startsWith('/admin/stores')) return 'Lojas e Regionais'
  if (pathname.startsWith('/admin/roles')) return 'Perfis e Permissões'
  if (pathname.startsWith('/admin/parameters')) return 'Parâmetros do Sistema'

  for (const [key, label] of Object.entries(MODULE_LABELS)) {
    if (pathname.startsWith(`/modules/${key}`)) return label
  }
  return 'Plataforma Sfera'
}

export default function PlatformLayout({ children }: { children: React.ReactNode }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const pathname = usePathname()
  const router = useRouter()
  const title = getPageTitle(pathname)
  const { data: me } = trpc.auth.me.useQuery()

  useEffect(() => {
    if (me?.mustChangePassword && pathname !== '/change-password') {
      router.replace('/change-password')
    }
  }, [me?.mustChangePassword, pathname, router])

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar collapsed={sidebarCollapsed} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header
          onToggleSidebar={() => setSidebarCollapsed(!sidebarCollapsed)}
          title={title}
        />
        <main className="flex-1 overflow-y-auto bg-background p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
