/**
 * Processador central de importações
 *
 * Fluxo:
 * 1. Carregar batch e layout
 * 2. Carregar itens do staging
 * 3. Validar cada linha
 * 4. Publicar linhas válidas no dado oficial do módulo
 * 5. Atualizar contadores do batch
 */
import type { PrismaClient } from '@prisma/client'
import { logger } from '@/lib/logger'

export async function processImportBatch(db: PrismaClient, batchId: string) {
  const batch = await db.importBatch.findUniqueOrThrow({
    where: { id: batchId },
    include: { layoutVersion: true },
  })

  const items = await db.importBatchItem.findMany({
    where: { batchId, isValid: true, isPublished: false },
  })

  let published = 0
  const errors: Array<{ rowNumber: number; error: string }> = []

  for (const item of items) {
    try {
      await publishItem(db, batch.module, item)
      await db.importBatchItem.update({
        where: { id: item.id },
        data: { isPublished: true, publishedAt: new Date(), recordId: item.recordId },
      })
      published++
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Erro ao publicar'
      errors.push({ rowNumber: item.rowNumber, error: msg })
      logger.warn({ batchId, rowNumber: item.rowNumber, error: msg }, 'Failed to publish item')
    }
  }

  const finalStatus = errors.length === 0 ? 'PUBLISHED' : 'PARTIALLY_PUBLISHED'

  await db.importBatch.update({
    where: { id: batchId },
    data: {
      status: finalStatus,
      publishedRows: published,
      publishedAt: new Date(),
    },
  })

  if (errors.length > 0) {
    await db.importError.createMany({
      data: errors.map((e) => ({
        batchId,
        rowNumber: e.rowNumber,
        errorCode: 'PUBLISH_ERROR',
        message: e.error,
      })),
    })
  }
}

async function publishItem(db: PrismaClient, module: string, item: any) {
  const data = item.parsedData as Record<string, any>

  switch (module) {
    case 'cde':
      return publishCdeItem(db, data, item.id)
    case 'note-transit':
      return publishNoteTransitItem(db, data, item.id)
    case 'write-offs':
      return publishWriteOffItem(db, data, item.id)
    case 'inventory':
      return publishInventoryItem(db, data, item.id)
    default:
      logger.warn({ module }, 'No publisher registered for module')
  }
}

async function publishCdeItem(db: PrismaClient, data: Record<string, any>, itemId: string) {
  const store = await db.store.findFirst({ where: { code: data.storeCode } })
  if (!store) throw new Error(`Loja não encontrada: ${data.storeCode}`)

  const existing = await db.cdeDailyRecord.findUnique({
    where: { storeId_date: { storeId: store.id, date: new Date(data.date) } },
  })

  if (existing) {
    await db.cdeDailyRecord.update({
      where: { id: existing.id },
      data: {
        initialStock: data.initialStock,
        entries: data.entries ?? 0,
        exits: data.exits ?? 0,
        sales: data.sales ?? 0,
        finalStock: data.finalStock,
        theoreticalFinalStock: Number(data.initialStock) + Number(data.entries ?? 0) - Number(data.exits ?? 0) - Number(data.sales ?? 0),
      },
    })
  } else {
    await db.cdeDailyRecord.create({
      data: {
        storeId: store.id,
        date: new Date(data.date),
        initialStock: data.initialStock,
        entries: data.entries ?? 0,
        exits: data.exits ?? 0,
        sales: data.sales ?? 0,
        finalStock: data.finalStock,
        theoreticalFinalStock: Number(data.initialStock) + Number(data.entries ?? 0) - Number(data.exits ?? 0) - Number(data.sales ?? 0),
        status: 'PENDING',
      },
    })
  }
}

async function publishNoteTransitItem(db: PrismaClient, data: Record<string, any>, itemId: string) {
  const store = await db.store.findFirst({ where: { code: data.destinationCode } })
  if (!store) throw new Error(`Loja destino não encontrada: ${data.destinationCode}`)

  await db.noteTransit.upsert({
    where: { noteNumber_destinationStoreId: { noteNumber: data.noteNumber, destinationStoreId: store.id } },
    update: {
      expectedAt: data.expectedAt ? new Date(data.expectedAt) : undefined,
      totalValue: data.totalValue,
    },
    create: {
      noteNumber: data.noteNumber,
      noteType: data.noteType ?? 'NF-e',
      destinationStoreId: store.id,
      issuedAt: new Date(data.issuedAt),
      expectedAt: data.expectedAt ? new Date(data.expectedAt) : undefined,
      totalValue: data.totalValue,
      status: 'PENDING',
    },
  })
}

async function publishWriteOffItem(db: PrismaClient, data: Record<string, any>, itemId: string) {
  const store = await db.store.findFirst({ where: { code: data.storeCode } })
  if (!store) throw new Error(`Loja não encontrada: ${data.storeCode}`)

  let writeOff = await db.writeOff.findFirst({
    where: { storeId: store.id, date: new Date(data.date) },
  })

  if (!writeOff) {
    writeOff = await db.writeOff.create({
      data: { storeId: store.id, date: new Date(data.date), status: 'IMPORTED' },
    })
  }

  const qty = Number(data.quantity ?? 0)
  const unitCost = Number(data.unitCost ?? 0)
  const totalCost = qty * unitCost

  await db.writeOffItem.create({
    data: {
      writeOffId: writeOff.id,
      sku: data.sku,
      description: data.description,
      type: data.type ?? 'PERDA',
      quantity: qty,
      unitValue: data.unitValue,
      unitCost,
      totalCost,
      reason: data.reason,
    },
  })

  // Atualizar totais do writeOff
  const items = await db.writeOffItem.findMany({ where: { writeOffId: writeOff.id } })
  const totalQuantity = items.reduce((acc, i) => acc + Number(i.quantity), 0)
  const totalCostSum = items.reduce((acc, i) => acc + Number(i.totalCost ?? 0), 0)

  await db.writeOff.update({
    where: { id: writeOff.id },
    data: { totalQuantity, totalCost: totalCostSum },
  })
}

async function publishInventoryItem(db: PrismaClient, data: Record<string, any>, itemId: string) {
  // O cycleId é passado via metadata do batch — veja o fluxo de upload do inventário
  const cycleId = data.cycleId
  if (!cycleId) throw new Error('cycleId obrigatório para itens de inventário')

  const expected = Number(data.expectedQty ?? 0)
  const counted = Number(data.countedQty ?? 0)
  const divergence = counted - expected
  const unitCost = Number(data.unitCost ?? 0)
  const lossValue = divergence < 0 ? Math.abs(divergence) * unitCost : 0
  const gainValue = divergence > 0 ? divergence * unitCost : 0

  await db.inventoryItem.upsert({
    where: { id: itemId },
    update: {
      expectedQty: expected,
      countedQty: counted,
      divergenceQty: divergence,
      unitCost,
      lossValue,
      gainValue,
      status: data.status ?? (divergence === 0 ? 'OK' : divergence < 0 ? 'LOSS' : 'GAIN'),
      errorType: data.status === 'Erro de CTG.' ? 'ERROR_CTG' : null,
      hasError: data.status === 'Erro de CTG.',
    },
    create: {
      cycleId,
      sku: data.sku,
      description: data.description,
      categoryId: data.categoryId,
      expectedQty: expected,
      countedQty: counted,
      divergenceQty: divergence,
      unitCost,
      lossValue,
      gainValue,
      status: data.status ?? (divergence === 0 ? 'OK' : divergence < 0 ? 'LOSS' : 'GAIN'),
      errorType: data.status === 'Erro de CTG.' ? 'ERROR_CTG' : null,
      hasError: data.status === 'Erro de CTG.',
    },
  })
}
