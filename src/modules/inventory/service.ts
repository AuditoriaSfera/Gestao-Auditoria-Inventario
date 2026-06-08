import type { PrismaClient, InventoryItem, InventoryClosing } from '@prisma/client'

/**
 * Fórmulas do KPI Interno do Time de Inventário
 * Documentação: docs/formulas/inventory-kpi.md
 *
 * total_pieces = soma(Apurado)
 * total_sku = contagem de linhas com Apurado > 0
 * pieces_per_collaborator = total_pieces / collaborators_count
 * sku_per_collaborator = total_sku / collaborators_count
 * productivity_per_hour = total_pieces / (duration_min / 60)
 * pieces_by_error = soma(Apurado) onde status = 'ERROR_CTG'
 * sku_by_error = contagem de linhas onde status = 'ERROR_CTG'
 * error_rate = sku_by_error / total_sku
 * recount_rate = recount_count / total_sku
 */
export async function calculateInventoryKpi(
  db: PrismaClient,
  cycleId: string,
  closing: InventoryClosing,
  items: InventoryItem[]
) {
  const totalPieces = items.reduce((acc, i) => acc + Number(i.countedQty), 0)
  const totalSku = items.filter((i) => Number(i.countedQty) > 0).length
  const errorItems = items.filter((i) => i.errorType === 'ERROR_CTG')
  const piecesByError = errorItems.reduce((acc, i) => acc + Number(i.countedQty), 0)
  const skuByError = errorItems.length

  const collaborators = closing.collaboratorsCount || 1
  const durationMin = closing.totalDurationMin ?? 0
  const durationHours = durationMin / 60

  const piecesPerCollaborator = collaborators > 0 ? totalPieces / collaborators : 0
  const skuPerCollaborator = collaborators > 0 ? totalSku / collaborators : 0
  const productivityPerHour = durationHours > 0 ? totalPieces / durationHours : 0
  const errorRate = totalSku > 0 ? skuByError / totalSku : 0
  const recountRate = totalSku > 0 ? (closing.recountCount ?? 0) / totalSku : 0

  const existing = await db.inventoryTeamKpi.findFirst({
    where: { cycleId },
    orderBy: { version: 'desc' },
  })
  const newVersion = (existing?.version ?? 0) + 1

  return db.inventoryTeamKpi.create({
    data: {
      cycleId,
      closingVersion: closing.version,
      version: newVersion,
      isOfficial: true,
      totalPiecesCounted: totalPieces,
      totalSkuCounted: totalSku,
      piecesPerCollaborator,
      skuPerCollaborator,
      productivityPerHour,
      totalDurationMin: durationMin,
      piecesByCountError: piecesByError,
      skuByCountError: skuByError,
      errorRate,
      recountRate,
      collaboratorsCount: collaborators,
      createdBy: closing.closedById ?? '',
    },
  })
}
