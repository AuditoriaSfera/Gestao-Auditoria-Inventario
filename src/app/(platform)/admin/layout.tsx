'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { trpc } from '@/lib/trpc'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const { data: me, isLoading } = trpc.auth.me.useQuery()

  const userRoles: string[] = (me?.roles ?? []).map((ur: any) => ur.role?.name ?? ur)
  const isAdmin = userRoles.includes('platform-admin')

  useEffect(() => {
    if (!isLoading && me && !isAdmin) {
      router.replace('/dashboard')
    }
  }, [isLoading, me, isAdmin, router])

  if (isLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '200px', color: '#94a3b8', fontSize: '14px' }}>
        Verificando permissões...
      </div>
    )
  }

  if (!isAdmin) {
    return null
  }

  return <>{children}</>
}
