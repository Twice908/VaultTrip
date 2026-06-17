import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { getCurrentUser } from '@/lib/current-user'
import { checklistGenerationQueue } from '@/lib/queues'

type ErrorResponse = { error: string; code?: string }
type Params = { params: { id: string } }

export async function POST(
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

    await checklistGenerationQueue.add('generate-checklist', {
      tripId: params.id,
      userId: user.id,
    })

    logger.info({ tripId: params.id, userId: user.id }, 'Checklist regeneration enqueued')
    return NextResponse.json({ ok: true }, { status: 202 })
  } catch (err) {
    logger.error({ err, userId: user.id, tripId: params.id }, 'Failed to enqueue checklist generation')
    return NextResponse.json({ error: 'Failed to enqueue checklist generation' }, { status: 500 })
  }
}
