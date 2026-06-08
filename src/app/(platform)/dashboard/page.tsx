'use client'

export const dynamic = 'force-dynamic'

import { trpc } from '@/lib/trpc'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency, formatNumber } from '@/lib/utils'
import { AlertCircle, TrendingDown, Truck, Warehouse, BarChart3, Box, DollarSign } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useRouter } from 'next/navigation'
import { subDays, startOfMonth } from 'date-fns'

function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  variant = 'default',
  href,
}: {
  title: string
  value: string | number
  subtitle?: string
  icon: React.ComponentType<{ className?: string }>
  variant?: 'default' | 'danger' | 'warning' | 'success'
  href?: string
}) {
  const router = useRouter()
  const variantClass = {
    default: 'text-primary',
    danger: 'text-destructive',
    warning: 'text-yellow-600',
    success: 'text-green-600',
  }[variant]

  return (
    <Card
      className={href ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}
      onClick={href ? () => router.push(href) : undefined}
    >
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className={`h-5 w-5 ${variantClass}`} />
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-bold ${variantClass}`}>{value}</div>
        {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
      </CardContent>
    </Card>
  )
}

export default function DashboardPage() {
  const now = new Date()
  const monthStart = startOfMonth(now)

  const { data: pendingSummary } = trpc.pending.summary.useQuery()
  const { data: cdeKpi } = trpc.cde.kpiSummary.useQuery({
    startDate: subDays(now, 7),
    endDate: now,
  })
  const { data: noteKpi } = trpc.noteTransit.kpiSummary.useQuery({})
  const { data: strategic } = trpc.strategic.executiveSummary.useQuery({
    startDate: monthStart,
    endDate: now,
  })
  const { data: pendingList } = trpc.pending.list.useQuery({
    pageSize: 5,
    status: 'OPEN',
  })

  const router = useRouter()

  return (
    <div className="space-y-6 fade-in">
      {/* Alertas críticos */}
      {pendingSummary?.critical != null && pendingSummary.critical > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3">
          <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
          <p className="text-sm font-medium text-destructive">
            {pendingSummary.critical} pendência(s) crítica(s) aguardando atenção imediata
          </p>
          <Button
            size="sm"
            variant="destructive"
            className="ml-auto"
            onClick={() => router.push('/pending?criticality=CRITICAL')}
          >
            Ver agora
          </Button>
        </div>
      )}

      {/* KPIs principais */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground mb-3">VISÃO GERAL DO MÊS</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Pendências Abertas"
            value={pendingSummary?.open ?? '—'}
            subtitle={`${pendingSummary?.expired ?? 0} vencidas`}
            icon={AlertCircle}
            variant={pendingSummary?.expired ? 'danger' : 'default'}
            href="/pending"
          />
          <StatCard
            title="Perda em Inventário"
            value={formatCurrency(strategic?.totalInventoryLoss)}
            subtitle={`${strategic?.inventoriesCount ?? 0} inventários finalizados`}
            icon={Warehouse}
            variant="warning"
            href="/modules/inventory"
          />
          <StatCard
            title="Notas em Atraso"
            value={noteKpi?.late ?? '—'}
            subtitle={`${noteKpi?.pending ?? 0} pendentes no total`}
            icon={Truck}
            variant={noteKpi?.late ? 'danger' : 'default'}
            href="/modules/note-transit"
          />
          <StatCard
            title="Patrimônio Divergente"
            value={strategic?.assetsDivergent ?? '—'}
            subtitle="ativos com divergência ou extraviados"
            icon={Box}
            variant={strategic?.assetsDivergent ? 'warning' : 'success'}
            href="/modules/assets"
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Perdas em Baixas"
          value={formatCurrency(strategic?.totalWriteOffLoss)}
          subtitle="no mês vigente"
          icon={TrendingDown}
          variant="warning"
          href="/modules/write-offs"
        />
        <StatCard
          title="Rondas Realizadas"
          value={strategic?.auditRoundsCompleted ?? '—'}
          subtitle="no mês vigente"
          icon={BarChart3}
          href="/modules/audit-round"
        />
        <StatCard
          title="CDE — Sem Retorno (7d)"
          value={cdeKpi?.noResponse ?? '—'}
          subtitle={`Taxa de aceite: ${formatNumber(cdeKpi?.acceptRate)}%`}
          icon={AlertCircle}
          variant={cdeKpi?.noResponse ? 'warning' : 'default'}
          href="/modules/cde"
        />
        <StatCard
          title="Perda Total Estimada"
          value={formatCurrency(strategic?.totalLoss)}
          subtitle="inventário + baixas no mês"
          icon={DollarSign}
          variant="danger"
          href="/modules/strategic"
        />
      </div>

      {/* Pendências recentes */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Pendências Críticas Recentes</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => router.push('/pending')}>
              Ver todas
            </Button>
          </CardHeader>
          <CardContent>
            {pendingList?.items.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhuma pendência aberta.</p>
            )}
            <div className="space-y-3">
              {pendingList?.items.map((item: any) => (
                <div
                  key={item.id}
                  className="flex items-start gap-3 rounded-lg border p-3 hover:bg-muted/50 cursor-pointer transition-colors"
                  onClick={() => router.push(`/pending/${item.id}`)}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {item.store?.name} • {item.module}
                    </p>
                  </div>
                  <div className="shrink-0 flex flex-col items-end gap-1">
                    <Badge
                      variant={
                        item.criticality === 'CRITICAL' ? 'destructive'
                          : item.criticality === 'HIGH' ? 'secondary'
                          : 'outline'
                      }
                      className="text-[10px]"
                    >
                      {item.criticality}
                    </Badge>
                    {item.slaBreached && (
                      <Badge variant="destructive" className="text-[10px]">Vencido</Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Atalhos rápidos */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Atalhos Rápidos</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            {[
              { label: 'Nova Importação', href: '/imports', icon: '📥' },
              { label: 'Nova Ronda', href: '/modules/audit-round?new=1', icon: '🔍' },
              { label: 'Lançar Custo', href: '/modules/audit-cost?new=1', icon: '💰' },
              { label: 'Pendências Vencidas', href: '/pending', icon: '🚨' },
              { label: 'Inventários em Aberto', href: '/modules/inventory?status=IN_ANALYSIS', icon: '📦' },
              { label: 'Dashboard Executivo', href: '/modules/strategic', icon: '📊' },
            ].map((item) => (
              <Button
                key={item.href}
                variant="outline"
                className="h-auto py-3 flex flex-col gap-1"
                onClick={() => router.push(item.href)}
              >
                <span className="text-xl">{item.icon}</span>
                <span className="text-xs text-center">{item.label}</span>
              </Button>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
