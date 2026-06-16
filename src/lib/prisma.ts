import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { env } from '@/env'
import { logger } from './logger'

const prismaClientSingleton = () => {
  const adapter = new PrismaPg({ connectionString: env.DATABASE_URL })
  return new PrismaClient({
    adapter,
    log: [
      { level: 'query', emit: 'event' },
      { level: 'error', emit: 'stdout' },
    ],
  })
}

type PrismaClientSingleton = ReturnType<typeof prismaClientSingleton>

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClientSingleton }

export const prisma = globalForPrisma.prisma ?? prismaClientSingleton()

prisma.$on('query', (e) => {
  if (e.duration > 500) {
    logger.warn({ duration: e.duration, query: e.query }, 'Slow query detected')
  }
})

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
