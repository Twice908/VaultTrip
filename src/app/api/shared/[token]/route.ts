import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import type { RequiredLevel, ChecklistStatus } from '@prisma/client'

type ErrorResponse = { error: string }

interface SharedChecklistItem {
  id: string
  label: string
  description: string | null
  required: RequiredLevel
  status: ChecklistStatus
}

interface SharedTripDTO {
  id: string
  name: string
  destination: string
  departureDate: string
  returnDate: string | null
  checklist: SharedChecklistItem[]
}

type Params = { params: { token: string } }

export async function GET(
  _req: Request,
  { params }: Params
): Promise<NextResponse<{ trip: SharedTripDTO } | ErrorResponse>> {
  try {
    const trip = await prisma.trip.findUnique({
      where: { shareToken: params.token },
      select: {
        id: true,
        name: true,
        destination: true,
        departureDate: true,
        returnDate: true,
        checklist: {
          select: {
            id: true,
            label: true,
            description: true,
            required: true,
            status: true,
          },
          orderBy: [{ required: 'asc' }, { createdAt: 'asc' }],
        },
      },
    })

    if (!trip) return NextResponse.json({ error: 'Trip not found' }, { status: 404 })

    const sharedTrip: SharedTripDTO = {
      id: trip.id,
      name: trip.name,
      destination: trip.destination,
      departureDate: trip.departureDate.toISOString(),
      returnDate: trip.returnDate?.toISOString() ?? null,
      checklist: trip.checklist,
    }

    return NextResponse.json({ trip: sharedTrip })
  } catch (err) {
    logger.error({ err, token: params.token }, 'Failed to fetch shared trip')
    return NextResponse.json({ error: 'Failed to fetch trip' }, { status: 500 })
  }
}
