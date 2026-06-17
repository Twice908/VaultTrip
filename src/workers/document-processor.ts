import './load-env'
import { Worker } from 'bullmq'
import { redis } from '@/lib/redis'
import { expiryCheckQueue } from '@/lib/queues'
import { logger } from '@/lib/logger'
import { processDocument, type DocumentProcessingJobData } from './document-processing'
import { generateChecklist, type ChecklistGenerationJobData } from './checklist-generation'
import { runExpiryCheck, sendAlert, type SendAlertJobData } from './expiry-alerts'

/**
 * Standalone BullMQ worker process for all queues.
 * Start with `npm run worker:dev` / `npm run worker:start`.
 *
 * Each queue gets a dedicated Redis connection; BullMQ uses blocking commands
 * that must not share the app's primary connection.
 */

// ── Document processing ──────────────────────────────────────────────────────

const documentConnection = redis.duplicate()

const documentWorker = new Worker<DocumentProcessingJobData>(
  'document-processing',
  async (job) => {
    await processDocument(job.data)
  },
  { connection: documentConnection, concurrency: 5 }
)

documentWorker.on('completed', (job) => {
  logger.info({ jobId: job.id, documentId: job.data.documentId }, 'document-processing job completed')
})

documentWorker.on('failed', (job, err) => {
  logger.error(
    { jobId: job?.id, documentId: job?.data.documentId, attemptsMade: job?.attemptsMade, err },
    'document-processing job failed'
  )
})

documentWorker.on('error', (err) => {
  logger.error({ err }, 'document-processing worker error')
})

// ── Checklist generation ─────────────────────────────────────────────────────

const checklistConnection = redis.duplicate()

const checklistWorker = new Worker<ChecklistGenerationJobData>(
  'checklist-generation',
  async (job) => {
    await generateChecklist(job.data)
  },
  { connection: checklistConnection, concurrency: 3 }
)

checklistWorker.on('completed', (job) => {
  logger.info({ jobId: job.id, tripId: job.data.tripId }, 'checklist-generation job completed')
})

checklistWorker.on('failed', (job, err) => {
  logger.error(
    { jobId: job?.id, tripId: job?.data.tripId, attemptsMade: job?.attemptsMade, err },
    'checklist-generation job failed'
  )
})

checklistWorker.on('error', (err) => {
  logger.error({ err }, 'checklist-generation worker error')
})

// ── Expiry check scheduler ───────────────────────────────────────────────────

const expiryConnection = redis.duplicate()

const expiryCheckWorker = new Worker(
  'expiry-check',
  async () => {
    await runExpiryCheck()
  },
  { connection: expiryConnection, concurrency: 1 }
)

expiryCheckWorker.on('completed', (job) => {
  logger.info({ jobId: job.id }, 'expiry-check job completed')
})

expiryCheckWorker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, attemptsMade: job?.attemptsMade, err }, 'expiry-check job failed')
})

expiryCheckWorker.on('error', (err) => {
  logger.error({ err }, 'expiry-check worker error')
})

// Register the repeatable daily job (idempotent — BullMQ deduplicates by name+cron key)
expiryCheckQueue
  .add('run-expiry-check', {}, { repeat: { cron: '0 8 * * *' } })
  .then(() => logger.info('Expiry-check repeatable job registered (daily 08:00 UTC)'))
  .catch((err: unknown) => logger.error({ err }, 'Failed to register expiry-check repeatable job'))

// ── Send-alert worker ────────────────────────────────────────────────────────

const sendAlertConnection = redis.duplicate()

const sendAlertWorker = new Worker<SendAlertJobData>(
  'send-alert',
  async (job) => {
    await sendAlert(job.data)
  },
  { connection: sendAlertConnection, concurrency: 5 }
)

sendAlertWorker.on('completed', (job) => {
  logger.info({ jobId: job.id, alertType: job.data.alertType, userId: job.data.userId }, 'send-alert job completed')
})

sendAlertWorker.on('failed', (job, err) => {
  logger.error(
    { jobId: job?.id, alertType: job?.data.alertType, attemptsMade: job?.attemptsMade, err },
    'send-alert job failed'
  )
})

sendAlertWorker.on('error', (err) => {
  logger.error({ err }, 'send-alert worker error')
})

// ── Startup & shutdown ───────────────────────────────────────────────────────

logger.info('All workers started (document-processing, checklist-generation, expiry-check, send-alert)')

async function shutdown(signal: NodeJS.Signals): Promise<void> {
  logger.info({ signal }, 'Shutting down workers')
  await Promise.all([
    documentWorker.close(),
    checklistWorker.close(),
    expiryCheckWorker.close(),
    sendAlertWorker.close(),
    documentConnection.quit(),
    checklistConnection.quit(),
    expiryConnection.quit(),
    sendAlertConnection.quit(),
  ])
  process.exit(0)
}

process.on('SIGTERM', () => { void shutdown('SIGTERM') })
process.on('SIGINT', () => { void shutdown('SIGINT') })
