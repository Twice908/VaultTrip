import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { getCurrentUser } from '@/lib/current-user'
import type { ChecklistItemDTO } from '@/types/trip'

type ErrorResponse = { error: string; code?: string }
type Params = { params: { id: string; itemId: string } }

const patchItemSchema = z.object({
  status: z.enum(['PENDING', 'FULFILLED', 'NOT_APPLICABLE', 'FLAGGED']).optional(),
  documentId: z.string().nullable().optional(),
})

export async function PATCH(
  req: Request,
  { params }: Params
): Promise<NextResponse<{ item: ChecklistItemDTO } | ErrorResponse>> {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = patchItemSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Validation error', code: 'VALIDATION_ERROR' },
      { status: 400 }
    )
  }

  try {
    // Verify trip ownership
    const trip = await prisma.trip.findUnique({
      where: { id: params.id },
      select: { userId: true },
    })
    if (!trip) return NextResponse.json({ error: 'Trip not found' }, { status: 404 })
    if (trip.userId !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    // Verify item belongs to this trip
    const item = await prisma.checklistItem.findUnique({
      where: { id: params.itemId },
      select: { tripId: true },
    })
    if (!item || item.tripId !== params.id) {
      return NextResponse.json({ error: 'Checklist item not found' }, { status: 404 })
    }

    const { status, documentId } = parsed.data

    // If a documentId is provided, verify it belongs to the same user
    if (documentId) {
      const doc = await prisma.document.findUnique({
        where: { id: documentId },
        select: { userId: true },
      })
      if (!doc || doc.userId !== user.id) {
        return NextResponse.json({ error: 'Document not found' }, { status: 404 })
      }
    }

    const updated = await prisma.checklistItem.update({
      where: { id: params.itemId },
      data: {
        ...(status !== undefined && { status }),
        ...(documentId !== undefined && { documentId }),
      },
    })

    const itemDTO: ChecklistItemDTO = {
      id: updated.id,
      tripId: updated.tripId,
      label: updated.label,
      description: updated.description,
      required: updated.required,
      status: updated.status,
      documentId: updated.documentId,
      createdAt: updated.createdAt.toISOString(),
    }

    return NextResponse.json({ item: itemDTO })
  } catch (err) {
    logger.error({ err, userId: user.id, tripId: params.id, itemId: params.itemId }, 'Failed to update checklist item')
    return NextResponse.json({ error: 'Failed to update checklist item' }, { status: 500 })
  }
}
