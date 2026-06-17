import { NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { getCurrentUser } from '@/lib/current-user'
import { toDocumentDTO, type DocumentDTO } from '@/types/document'

const documentTypeSchema = z.enum([
  'PASSPORT',
  'VISA',
  'TRAVEL_INSURANCE',
  'FLIGHT_BOOKING',
  'HOTEL_BOOKING',
  'VACCINATION_RECORD',
  'TRAVEL_PERMIT',
  'IDENTITY_CARD',
  'OTHER',
])

type ErrorResponse = { error: string; code?: string }

export async function GET(
  req: Request
): Promise<NextResponse<{ documents: DocumentDTO[] } | ErrorResponse>> {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const where: Prisma.DocumentWhereInput = { userId: user.id }

  const tripId = searchParams.get('tripId')
  if (tripId) where.tripId = tripId

  const typeParam = searchParams.get('type')
  if (typeParam) {
    const parsedType = documentTypeSchema.safeParse(typeParam)
    if (!parsedType.success) {
      return NextResponse.json(
        { error: 'Invalid document type filter', code: 'VALIDATION_ERROR' },
        { status: 400 }
      )
    }
    where.type = parsedType.data
  }

  try {
    const documents = await prisma.document.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ documents: documents.map(toDocumentDTO) })
  } catch (err) {
    logger.error({ err, userId: user.id }, 'Failed to list documents')
    return NextResponse.json({ error: 'Failed to list documents' }, { status: 500 })
  }
}
