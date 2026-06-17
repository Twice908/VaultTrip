import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { getCurrentUser } from '@/lib/current-user'

type ErrorResponse = { error: string; code?: string }

interface PreferencesDTO {
  alertPassport: boolean
  alertVisa: boolean
  alertInsurance: boolean
  alertTripHealth: boolean
}

export async function GET(): Promise<NextResponse<PreferencesDTO | ErrorResponse>> {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })

  try {
    // Upsert: create default preferences if none exist, return existing otherwise
    const prefs = await prisma.userPreferences.upsert({
      where: { userId: user.id },
      create: { userId: user.id },
      update: {},
      select: { alertPassport: true, alertVisa: true, alertInsurance: true, alertTripHealth: true },
    })
    return NextResponse.json(prefs)
  } catch (err) {
    logger.error({ err, userId: user.id }, 'Failed to get user preferences')
    return NextResponse.json({ error: 'Failed to get preferences' }, { status: 500 })
  }
}

const updatePreferencesSchema = z
  .object({
    alertPassport: z.boolean().optional(),
    alertVisa: z.boolean().optional(),
    alertInsurance: z.boolean().optional(),
    alertTripHealth: z.boolean().optional(),
  })
  .strict()

export async function PATCH(req: Request): Promise<NextResponse<PreferencesDTO | ErrorResponse>> {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = updatePreferencesSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Validation error', code: 'VALIDATION_ERROR' },
      { status: 400 }
    )
  }

  try {
    const prefs = await prisma.userPreferences.upsert({
      where: { userId: user.id },
      create: { userId: user.id, ...parsed.data },
      update: parsed.data,
      select: { alertPassport: true, alertVisa: true, alertInsurance: true, alertTripHealth: true },
    })
    return NextResponse.json(prefs)
  } catch (err) {
    logger.error({ err, userId: user.id }, 'Failed to update user preferences')
    return NextResponse.json({ error: 'Failed to update preferences' }, { status: 500 })
  }
}
