import { z } from 'zod'
import type Anthropic from '@anthropic-ai/sdk'
import type { RequiredLevel } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { anthropic } from '@/lib/ai'
import { logger } from '@/lib/logger'

export const CHECKLIST_GENERATOR_MODEL = 'claude-opus-4-6'
export const CHECKLIST_GENERATOR_MAX_TOKENS = 2048

export const CHECKLIST_GENERATOR_PROMPT = (
  nationality: string,
  destination: string,
  tripType: string,
  durationDays: number,
  departureDate: string
) => `Generate a travel document checklist for:
- Traveler nationality: ${nationality}
- Destination: ${destination}
- Trip type: ${tripType.toLowerCase()}
- Duration: ${durationDays} days
- Departure date: ${departureDate}

Return a JSON array only. No explanation. No markdown fences.
Each item: { label: string, description: string, required: "required" | "recommended" | "optional" }`

const REQUIRED_LEVEL_MAP: Record<string, RequiredLevel> = {
  required: 'REQUIRED',
  recommended: 'RECOMMENDED',
  optional: 'OPTIONAL',
}

export const checklistItemSchema = z.object({
  label: z.string().min(1),
  description: z.string(),
  required: z.enum(['required', 'recommended', 'optional']),
})

export const checklistResponseSchema = z.array(checklistItemSchema)

export type ChecklistItem = z.infer<typeof checklistItemSchema>

export interface ChecklistGenerationJobData {
  tripId: string
  userId: string
}

export interface GenerateChecklistDeps {
  prisma: Pick<typeof prisma, 'trip' | 'checklistItem' | 'user'>
  anthropic: Pick<Anthropic, 'messages'>
}

const defaultDeps: GenerateChecklistDeps = {
  prisma,
  anthropic,
}

function stripMarkdownFences(raw: string): string {
  const text = raw.trim()
  if (!text.startsWith('```')) return text
  return text
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim()
}

export async function generateChecklist(
  data: ChecklistGenerationJobData,
  deps: GenerateChecklistDeps = defaultDeps
): Promise<void> {
  const { tripId, userId } = data

  const trip = await deps.prisma.trip.findUnique({
    where: { id: tripId },
    select: {
      id: true,
      userId: true,
      destination: true,
      tripType: true,
      departureDate: true,
      returnDate: true,
      user: { select: { nationality: true } },
    },
  })

  if (!trip) {
    logger.warn({ tripId, userId }, 'Trip not found; discarding checklist generation job')
    return
  }

  if (trip.userId !== userId) {
    logger.warn({ tripId, userId }, 'User mismatch; discarding checklist generation job')
    return
  }

  const nationality = trip.user.nationality ?? 'US'
  const durationDays = trip.returnDate
    ? Math.max(1, Math.ceil((trip.returnDate.getTime() - trip.departureDate.getTime()) / 86_400_000))
    : 7
  const departureDateISO = trip.departureDate.toISOString().slice(0, 10)

  const prompt = CHECKLIST_GENERATOR_PROMPT(
    nationality,
    trip.destination,
    trip.tripType,
    durationDays,
    departureDateISO
  )

  let rawResponse: string
  try {
    const message = await deps.anthropic.messages.create({
      model: CHECKLIST_GENERATOR_MODEL,
      max_tokens: CHECKLIST_GENERATOR_MAX_TOKENS,
      messages: [{ role: 'user', content: prompt }],
    })

    const textBlock = message.content.find(
      (block): block is Anthropic.TextBlock => block.type === 'text'
    )
    if (!textBlock) throw new Error('Checklist generator returned no text content')
    rawResponse = textBlock.text
  } catch (err) {
    logger.error({ err, tripId, userId }, 'Claude checklist generation API call failed')
    throw err
  }

  const cleaned = stripMarkdownFences(rawResponse)

  let parsed: unknown
  try {
    parsed = JSON.parse(cleaned)
  } catch {
    logger.error({ tripId, rawResponse }, 'Checklist generator returned non-JSON response')
    throw new Error('Checklist generator response was not valid JSON')
  }

  const result = checklistResponseSchema.safeParse(parsed)
  if (!result.success) {
    logger.error(
      { tripId, rawResponse, issues: result.error.issues },
      'Checklist response failed schema validation'
    )
    throw new Error('Checklist response failed schema validation')
  }

  // Idempotent: delete existing items before inserting fresh ones
  await deps.prisma.checklistItem.deleteMany({ where: { tripId } })

  await deps.prisma.checklistItem.createMany({
    data: result.data.map((item) => ({
      tripId,
      label: item.label,
      description: item.description,
      required: (REQUIRED_LEVEL_MAP[item.required] ?? 'OPTIONAL') as RequiredLevel,
    })),
  })

  logger.info(
    { tripId, userId, itemCount: result.data.length },
    'Checklist generated and saved'
  )
}
