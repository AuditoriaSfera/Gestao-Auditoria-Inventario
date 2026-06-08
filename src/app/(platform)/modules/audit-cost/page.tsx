'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function AuditCostRedirect() {
  const router = useRouter()
  useEffect(() => { router.replace('/modules/audit-cost/dashboard') }, [router])
  return null
}
