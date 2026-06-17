import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { getCurrentUser } from '@/lib/current-user'
import { computeHealthScore, type TripDetailDTO, type ChecklistItemDTO } from '@/types/trip'
import { toDocumentDTO } from '@/types/document'

type ErrorResponse = { error: string; code?: string }
type Params = { params: { id: string } }

const patchTripSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  returnDate: z.string().datetime().nullable().optional(),
  tripType: z.enum(['TOURISM', 'BUSINESS', 'TRANSIT', 'STUDY', 'WORK']).optional(),
})

export async function GET(
  _req: Request,
  { params }: Params
): Promise<NextResponse<{ trip: TripDetailDTO } | ErrorResponse>> {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })

  try {
    const trip = await prisma.trip.findUnique({
      where: { id: params.id },
      include: {
        documents: true,
        checklist: { orderBy: [{ required: 'asc' }, { createdAt: 'asc' }] },
        _count: { select: { documents: true } },
      },
    })

    if (!trip) return NextResponse.json({ error: 'Trip not found' }, { status: 404 })
    if (trip.userId !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const healthScore = computeHealthScore(trip.checklist)
    const checklistItems: ChecklistItemDTO[] = trip.checklist.map((item) => ({
      id: item.id,
      tripId: item.tripId,
      label: item.label,
      description: item.description,
      required: item.required,
      status: item.status,
      documentId: item.documentId,
      createdAt: item.createdAt.toISOString(),
    }))

    const tripDetail: TripDetailDTO = {
      id: trip.id,
      name: trip.name,
      origin: trip.origin,
      destination: trip.destination,
      departureDate: trip.departureDate.toISOString(),
      returnDate: trip.returnDate?.toISOString() ?? null,
      tripType: trip.tripType,
      shareToken: trip.shareToken,
      createdAt: trip.createdAt.toISOString(),
      documentCount: trip._count.documents,
      checklistCounts: {
        fulfilled: trip.checklist.filter((c) => c.status === 'FULFILLED').length,
        pending: trip.checklist.filter((c) => c.status === 'PENDING').length,
        flagged: trip.checklist.filter((c) => c.status === 'FLAGGED').length,
        notApplicable: trip.checklist.filter((c) => c.status === 'NOT_APPLICABLE').length,
      },
      healthScore,
      documents: trip.documents.map(toDocumentDTO),
      checklist: checklistItems,
    }

    return NextResponse.json({ trip: tripDetail })
  } catch (err) {
    logger.error({ err, userId: user.id, tripId: params.id }, 'Failed to fetch trip')
    return NextResponse.json({ error: 'Failed to fetch trip' }, { status: 500 })
  }
}

export async function PATCH(
  req: Request,
  { params }: Params
): Promise<NextResponse<{ trip: { id: string } } | ErrorResponse>> {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = patchTripSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Validation error', code: 'VALIDATION_ERROR' },
      { status: 400 }
    )
  }

  try {
    const trip = await prisma.trip.findUnique({
      where: { id: params.id },
      select: { userId: true },
    })
    if (!trip) return NextResponse.json({ error: 'Trip not found' }, { status: 404 })
    if (trip.userId !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { name, returnDate, tripType } = parsed.data
    await prisma.trip.update({
      where: { id: params.id },
      data: {
        ...(name !== undefined && { name }),
        ...(returnDate !== undefined && { returnDate: returnDate ? new Date(returnDate) : null }),
        ...(tripType !== undefined && { tripType }),
      },
    })

    return NextResponse.json({ trip: { id: params.id } })
  } catch (err) {
    logger.error({ err, userId: user.id, tripId: params.id }, 'Failed to update trip')
    return NextResponse.json({ error: 'Failed to update trip' }, { status: 500 })
  }
}

export async function DELETE(
  _req: Request,
  { params }: Params
): Promise<NextResponse<{ ok: boolean } | ErrorResponse>> {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })

  try {
    const trip = await prisma.trip.findUnique({
      where: { id: params.id },
      select: { userId: true },
    })
    if (!trip) return NextResponse.json({ error: 'Trip not found' }, { status: 404 })
    if (trip.userId !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    await prisma.$transaction([
      // Unlink documents from this trip (keep documents in vault)
      prisma.document.updateMany({
        where: { tripId: params.id },
        data: { tripId: null },
      }),
      // Delete checklist items
      prisma.checklistItem.deleteMany({ where: { tripId: params.id } }),
      // Delete the trip
      prisma.trip.delete({ where: { id: params.id } }),
    ])

    logger.info({ tripId: params.id, userId: user.id }, 'Trip deleted')
    return NextResponse.json({ ok: true })
  } catch (err) {
    logger.error({ err, userId: user.id, tripId: params.id }, 'Failed to delete trip')
    return NextResponse.json({ error: 'Failed to delete trip' }, { status: 500 })
  }
}
