import { Queue } from 'bullmq'
import { redis } from './redis'

export const documentProcessingQueue = new Queue('document-processing', {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: 100,
    removeOnFail: 500,
  },
})

export const checklistGenerationQueue = new Queue('checklist-generation', {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 3000 },
    removeOnComplete: 100,
    removeOnFail: 500,
  },
})

export const expiryCheckQueue = new Queue('expiry-check', {
  connection: redis,
  defaultJobOptions: {
    attempts: 2,
    removeOnComplete: 10,
    removeOnFail: 100,
  },
})

export const sendAlertQueue = new Queue('send-alert', {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 10000 },
    removeOnComplete: 50,
    removeOnFail: 200,
  },
})
