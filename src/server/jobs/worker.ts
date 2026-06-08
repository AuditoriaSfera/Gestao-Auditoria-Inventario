/**
 * Worker BullMQ para processamento assíncrono de importações
 * Executar em processo separado: npm run worker:dev
 */
import { Worker, Queue } from 'bullmq'
import Redis from 'ioredis'
import { db } from '../db/client'
import { logger } from '@/lib/logger'
import { processImportBatch } from './processors/import-processor'

const connection = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
})

export const importQueue = new Queue('import-processing', { connection })

const importWorker = new Worker(
  'import-processing',
  async (job) => {
    const { batchId } = job.data as { batchId: string }
    logger.info({ batchId }, 'Processing import batch')

    try {
      await db.importBatch.update({
        where: { id: batchId },
        data: { status: 'VALIDATING' },
      })

      await processImportBatch(db, batchId)

      logger.info({ batchId }, 'Import batch processed successfully')
    } catch (error) {
      logger.error({ batchId, error }, 'Import batch processing failed')
      await db.importBatch.update({
        where: { id: batchId },
        data: {
          status: 'FAILED',
          errorSummary: error instanceof Error ? error.message : 'Erro desconhecido',
        },
      })
      throw error
    }
  },
  {
    connection,
    concurrency: 3,
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 50 },
  }
)

importWorker.on('completed', (job) => {
  logger.info({ jobId: job.id }, 'Import job completed')
})

importWorker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, err }, 'Import job failed')
})

logger.info('Import worker started — waiting for jobs...')
