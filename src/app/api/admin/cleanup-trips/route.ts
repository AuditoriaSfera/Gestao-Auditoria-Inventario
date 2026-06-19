import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/server/db/client'

const SECRET = process.env.CLEANUP_SECRET ?? 'sfera-cleanup-2026'

export async function GET(req: NextRequest) {
  const s = req.nextUrl.searchParams.get('secret')
  if (s !== SECRET) return NextResponse.json({ error: 'Token inválido' }, { status: 403 })

  const tripCounts = await db.$queryRaw<{ status: string; total: bigint }[]>`
    SELECT status, COUNT(*) as total FROM audit_trips WHERE deleted_at IS NULL GROUP BY status ORDER BY status
  `
  const informativoCount = await db.auditInformativeCost.count({ where: { deletedAt: null } })

  return NextResponse.json({
    viagens_por_status: tripCounts.map(r => ({ status: r.status, total: Number(r.total) })),
    viagens_serao_excluidas: tripCounts.filter(r => r.status !== 'OPEN').reduce((s, r) => s + Number(r.total), 0),
    viagens_ficam: tripCounts.filter(r => r.status === 'OPEN').reduce((s, r) => s + Number(r.total), 0),
    custos_informativos_serao_excluidos: informativoCount,
  })
}

export async function POST(req: NextRequest) {
  const s = req.nextUrl.searchParams.get('secret')
  if (s !== SECRET) return NextResponse.json({ error: 'Token inválido' }, { status: 403 })

  const now = new Date()
  const [trips, informativos] = await Promise.all([
    db.auditTrip.updateMany({
      where: { deletedAt: null, status: { not: 'OPEN' } },
      data: { deletedAt: now },
    }),
    db.auditInformativeCost.updateMany({
      where: { deletedAt: null },
      data: { deletedAt: now },
    }),
  ])

  return NextResponse.json({
    sucesso: true,
    viagens_excluidas: trips.count,
    custos_informativos_excluidos: informativos.count,
  })
}
