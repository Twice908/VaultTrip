import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { getCurrentUser } from '@/lib/current-user'

type ErrorResponse = { error: string; code?: string }
type Params = { params: { id: string } }

export async function GET(
  _req: Request,
  { params }: Params
): Promise<NextResponse<{ shareToken: string } | ErrorResponse>> {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })

  try {
    const trip = await prisma.trip.findUnique({
      where: { id: params.id },
      select: { userId: true, shareToken: true },
    })
    if (!trip) return NextResponse.json({ error: 'Trip not found' }, { status: 404 })
    if (trip.userId !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    if (trip.shareToken) {
      return NextResponse.json({ shareToken: trip.shareToken })
    }

    const shareToken = crypto.randomUUID()
    await prisma.trip.update({
      where: { id: params.id },
      data: { shareToken },
    })

    logger.info({ tripId: params.id, userId: user.id }, 'Share token generated')
    return NextResponse.json({ shareToken })
  } catch (err) {
    logger.error({ err, userId: user.id, tripId: params.id }, 'Failed to generate share token')
    return NextResponse.json({ error: 'Failed to generate share token' }, { status: 500 })
  }
}
