import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { getCurrentUser } from '@/lib/current-user'
import { checklistGenerationQueue } from '@/lib/queues'
import { computeHealthScore, type TripDTO } from '@/types/trip'

const FREE_TRIP_LIMIT = 3

const createTripSchema = z.object({
  name: z.string().min(1).max(120),
  origin: z.string().length(2).toUpperCase(),
  destination: z.string().length(2).toUpperCase(),
  departureDate: z
    .string()
    .datetime()
    .refine((d) => new Date(d) >= new Date(new Date().toDateString()), {
      message: 'Departure date cannot be in the past',
    }),
  returnDate: z.string().datetime().optional().nullable(),
  tripType: z.enum(['TOURISM', 'BUSINESS', 'TRANSIT', 'STUDY', 'WORK']).default('TOURISM'),
})

type ErrorResponse = { error: string; code?: string }

export async function GET(): Promise<NextResponse<{ trips: TripDTO[] } | ErrorResponse>> {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })

  try {
    const trips = await prisma.trip.findMany({
      where: { userId: user.id },
      orderBy: { departureDate: 'asc' },
      include: {
        _count: { select: { documents: true } },
        checklist: { select: { required: true, status: true } },
      },
    })

    const tripDTOs: TripDTO[] = trips.map((trip) => {
      const healthScore = computeHealthScore(trip.checklist)
      const checklistCounts = {
        fulfilled: trip.checklist.filter((c) => c.status === 'FULFILLED').length,
        pending: trip.checklist.filter((c) => c.status === 'PENDING').length,
        flagged: trip.checklist.filter((c) => c.status === 'FLAGGED').length,
        notApplicable: trip.checklist.filter((c) => c.status === 'NOT_APPLICABLE').length,
      }

      return {
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
        checklistCounts,
        healthScore,
      }
    })

    return NextResponse.json({ trips: tripDTOs })
  } catch (err) {
    logger.error({ err, userId: user.id }, 'Failed to list trips')
    return NextResponse.json({ error: 'Failed to list trips' }, { status: 500 })
  }
}

export async function POST(
  req: Request
): Promise<NextResponse<{ trip: TripDTO } | ErrorResponse>> {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = createTripSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Validation error', code: 'VALIDATION_ERROR' },
      { status: 400 }
    )
  }

  try {
    const tripCount = await prisma.trip.count({ where: { userId: user.id } })
    if (tripCount >= FREE_TRIP_LIMIT) {
      return NextResponse.json(
        { error: 'Plan limit reached', code: 'LIMIT_TRIPS' },
        { status: 402 }
      )
    }

    const { name, origin, destination, departureDate, returnDate, tripType } = parsed.data

    const trip = await prisma.trip.create({
      data: {
        userId: user.id,
        name,
        origin,
        destination,
        departureDate: new Date(departureDate),
        returnDate: returnDate ? new Date(returnDate) : null,
        tripType,
      },
      include: {
        _count: { select: { documents: true } },
        checklist: { select: { required: true, status: true } },
      },
    })

    await checklistGenerationQueue.add('generate-checklist', {
      tripId: trip.id,
      userId: user.id,
    })

    logger.info({ tripId: trip.id, userId: user.id }, 'Trip created, checklist generation enqueued')

    const tripDTO: TripDTO = {
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
      checklistCounts: { fulfilled: 0, pending: 0, flagged: 0, notApplicable: 0 },
      healthScore: { fulfilled: 0, total: 0, percent: null },
    }

    return NextResponse.json({ trip: tripDTO }, { status: 201 })
  } catch (err) {
    logger.error({ err, userId: user.id }, 'Failed to create trip')
    return NextResponse.json({ error: 'Failed to create trip' }, { status: 500 })
  }
}
