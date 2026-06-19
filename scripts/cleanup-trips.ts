import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

async function main() {
  // Mostrar contagem por status antes
  const counts = await db.$queryRaw<{ status: string; total: bigint }[]>`
    SELECT status, COUNT(*) as total
    FROM audit_trips
    WHERE deleted_at IS NULL
    GROUP BY status
    ORDER BY status
  `
  console.log('\n=== Viagens por status (antes) ===')
  for (const row of counts) {
    console.log(`  ${row.status}: ${row.total}`)
  }

  const dryRun = process.argv.includes('--dry-run')

  if (dryRun) {
    const toDelete = await db.$queryRaw<{ total: bigint }[]>`
      SELECT COUNT(*) as total FROM audit_trips WHERE deleted_at IS NULL AND status != 'OPEN'
    `
    console.log(`\n[DRY RUN] Seriam excluídas: ${toDelete[0]?.total ?? 0} viagens (todas exceto OPEN)`)
    console.log('[DRY RUN] Execute sem --dry-run para confirmar.')
    return
  }

  const result = await db.auditTrip.updateMany({
    where: { deletedAt: null, status: { not: 'OPEN' } },
    data: { deletedAt: new Date() },
  })

  console.log(`\n✅ ${result.count} viagem(ns) excluídas (soft delete).`)

  const after = await db.$queryRaw<{ status: string; total: bigint }[]>`
    SELECT status, COUNT(*) as total
    FROM audit_trips
    WHERE deleted_at IS NULL
    GROUP BY status
    ORDER BY status
  `
  console.log('\n=== Viagens por status (depois) ===')
  for (const row of after) {
    console.log(`  ${row.status}: ${row.total}`)
  }
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => db.$disconnect())
