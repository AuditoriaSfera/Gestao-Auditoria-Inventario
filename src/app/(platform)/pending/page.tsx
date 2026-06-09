'use client'

export const dynamic = 'force-dynamic'

import { Suspense } from 'react'
import { useState } from 'react'
import { trpc } from '@/lib/trpc'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { PENDING_STATUS_LABELS, CRITICALITY_LABELS, MODULE_LABELS } from '@/lib/constants'
import { formatDate, formatDateTime } from '@/lib/utils'
import { AlertCircle, Search, Filter, Clock } from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
type PendingStatus = 'OPEN' | 'IN_ANALYSIS' | 'WAITING_STORE' | 'WAITING_AUDIT' | 'RESOLVED_PENDING_VALIDATION' | 'CLOSED' | 'CANCELLED' | 'EXPIRED' | 'REOPENED'
type PendingCriticality = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'

const statusColors: Record<string, string> = {
  OPEN: 'bg-blue-100 text-blue-800',
  IN_ANALYSIS: 'bg-purple-100 text-purple-800',
  WAITING_STORE: 'bg-yellow-100 text-yellow-800',
  WAITING_AUDIT: 'bg-orange-100 text-orange-800',
  RESOLVED_PENDING_VALIDATION: 'bg-green-100 text-green-800',
  CLOSED: 'bg-gray-100 text-gray-800',
  CANCELLED: 'bg-red-100 text-red-800',
  EXPIRED: 'bg-red-100 text-red-800',
  REOPENED: 'bg-orange-100 text-orange-800',
}

const criticalityColors: Record<string, string> = {
  LOW: 'bg-green-100 text-green-800',
  MEDIUM: 'bg-yellow-100 text-yellow-800',
  HIGH: 'bg-orange-100 text-orange-800',
  CRITICAL: 'bg-red-100 text-red-800',
}

function PendingPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<PendingStatus | undefined>(
    (searchParams.get('status') as PendingStatus) ?? undefined
  )
  const [criticality, setCriticality] = useState<PendingCriticality | undefined>(
    (searchParams.get('criticality') as PendingCriticality) ?? undefined
  )
  const [module, setModule] = useState<string | undefined>()
  const [page, setPage] = useState(1)

  const { data, isLoading } = trpc.pending.list.useQuery({
    page,
    pageSize: 20,
    search: search || undefined,
    status,
    criticality,
    module,
    overdueOnly: searchParams.get('overdueOnly') === 'true',
  })

  const { data: summary } = trpc.pending.summary.useQuery()

  return (
    <div className="space-y-6 fade-in">
      {/* Summary cards */}
      <div className="grid gap-3 md:grid-cols-4">
        {[
          { label: 'Total Abertas', value: summary?.open, color: 'text-blue-600' },
          { label: 'Vencidas', value: summary?.expired, color: 'text-red-600' },
          { label: 'SLA Rompido', value: summary?.slaBreached, color: 'text-orange-600' },
          { label: 'Críticas', value: summary?.critical, color: 'text-red-700' },
        ].map((item) => (
          <Card key={item.label}>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">{item.label}</p>
              <p className={`text-2xl font-bold ${item.color}`}>{item.value ?? '—'}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar pendências..."
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <Select
              value={status ?? 'all'}
              onValueChange={(v) => { setStatus(v === 'all' ? undefined : v as PendingStatus); setPage(1) }}
            >
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Todos os status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                {Object.entries(PENDING_STATUS_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={criticality ?? 'all'}
              onValueChange={(v) => { setCriticality(v === 'all' ? undefined : v as PendingCriticality); setPage(1) }}
            >
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Criticidade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {Object.entries(CRITICALITY_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={module ?? 'all'}
              onValueChange={(v) => { setModule(v === 'all' ? undefined : v); setPage(1) }}
            >
              <SelectTrigger className="w-52">
                <SelectValue placeholder="Módulo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os módulos</SelectItem>
                {Object.entries(MODULE_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Lista de pendências */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {data?.meta.total ?? 0} pendência(s) encontrada(s)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading && (
            <div className="flex items-center justify-center py-12">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          )}

          <div className="space-y-3">
            {data?.items.map((item: any) => (
              <div
                key={item.id}
                className="flex items-start gap-4 rounded-lg border p-4 hover:bg-muted/30 cursor-pointer transition-colors"
                onClick={() => router.push(`/pending/${item.id}`)}
              >
                <AlertCircle className={`h-5 w-5 mt-0.5 shrink-0 ${
                  item.criticality === 'CRITICAL' ? 'text-red-600'
                    : item.criticality === 'HIGH' ? 'text-orange-500'
                    : 'text-yellow-500'
                }`} />

                <div className="flex-1 min-w-0">
                  <div className="flex items-start gap-2 flex-wrap">
                    <p className="font-medium text-sm">{item.title}</p>
                    {item.slaBreached && (
                      <Badge variant="destructive" className="text-[10px] shrink-0">SLA Rompido</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                    {item.description}
                  </p>
                  <div className="flex items-center gap-3 mt-2 flex-wrap">
                    <span className="text-xs text-muted-foreground">
                      {item.store?.name ?? 'N/A'}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {MODULE_LABELS[item.module] ?? item.module}
                    </span>
                    {item.dueAt && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        Prazo: {formatDate(item.dueAt)}
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground">
                      Aberta em {formatDate(item.openedAt)}
                    </span>
                  </div>
                </div>

                <div className="shrink-0 flex flex-col items-end gap-2">
                  <span className={`status-badge text-[10px] ${statusColors[item.status] ?? ''}`}>
                    {PENDING_STATUS_LABELS[item.status] ?? item.status}
                  </span>
                  <span className={`status-badge text-[10px] ${criticalityColors[item.criticality] ?? ''}`}>
                    {CRITICALITY_LABELS[item.criticality] ?? item.criticality}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Paginação */}
          {data && data.meta.totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t">
              <p className="text-xs text-muted-foreground">
                Página {data.meta.page} de {data.meta.totalPages}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!data.meta.hasPrev}
                  onClick={() => setPage(page - 1)}
                >
                  Anterior
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!data.meta.hasNext}
                  onClick={() => setPage(page + 1)}
                >
                  Próxima
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default function PendingPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-12"><div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>}>
      <PendingPageContent />
    </Suspense>
  )
}
