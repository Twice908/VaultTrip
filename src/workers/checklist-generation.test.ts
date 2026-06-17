import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    trip: { findUnique: vi.fn() },
    checklistItem: { deleteMany: vi.fn(), createMany: vi.fn() },
    user: {},
  },
}))
vi.mock('@/lib/ai', () => ({ anthropic: { messages: { create: vi.fn() } } }))
vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

import {
  checklistItemSchema,
  checklistResponseSchema,
  generateChecklist,
  type GenerateChecklistDeps,
} from './checklist-generation'

// ── Schema tests ──────────────────────────────────────────────────────────────

describe('checklistItemSchema', () => {
  it('accepts a valid item', () => {
    const result = checklistItemSchema.safeParse({
      label: 'Valid passport',
      description: 'Must be valid for at least 6 months',
      required: 'required',
    })
    expect(result.success).toBe(true)
  })

  it('accepts all required level values', () => {
    for (const level of ['required', 'recommended', 'optional'] as const) {
      expect(checklistItemSchema.safeParse({ label: 'X', description: '', required: level }).success).toBe(true)
    }
  })

  it('rejects an unknown required level', () => {
    expect(checklistItemSchema.safeParse({ label: 'X', description: '', required: 'mandatory' }).success).toBe(false)
  })

  it('rejects missing label', () => {
    expect(checklistItemSchema.safeParse({ description: 'desc', required: 'required' }).success).toBe(false)
  })
})

describe('checklistResponseSchema', () => {
  it('accepts an array of valid items', () => {
    const result = checklistResponseSchema.safeParse([
      { label: 'Passport', description: 'Valid for 6 months', required: 'required' },
      { label: 'Travel insurance', description: '', required: 'recommended' },
    ])
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.data).toHaveLength(2)
  })

  it('rejects a non-array', () => {
    expect(checklistResponseSchema.safeParse({ label: 'X', description: '', required: 'required' }).success).toBe(false)
  })

  it('rejects an array with an invalid item', () => {
    expect(
      checklistResponseSchema.safeParse([
        { label: 'Passport', description: '', required: 'required' },
        { label: 'X', description: '', required: 'mandatory' },
      ]).success
    ).toBe(false)
  })
})

// ── Worker tests ──────────────────────────────────────────────────────────────

describe('generateChecklist', () => {
  const jobData = { tripId: 'trip_1', userId: 'user_1' }

  const stubTrip = {
    id: 'trip_1',
    userId: 'user_1',
    destination: 'JP',
    tripType: 'TOURISM',
    departureDate: new Date('2026-08-01'),
    returnDate: new Date('2026-08-15'),
    user: { nationality: 'GB' },
  }

  const stubItems = [
    { label: 'Passport', description: 'Valid passport required', required: 'required' },
    { label: 'Travel insurance', description: 'Recommended', required: 'recommended' },
  ]

  function buildDeps(overrides: Partial<{
    findUnique: ReturnType<typeof vi.fn>
    deleteMany: ReturnType<typeof vi.fn>
    createMany: ReturnType<typeof vi.fn>
    create: ReturnType<typeof vi.fn>
  }> = {}): GenerateChecklistDeps {
    const findUnique = overrides.findUnique ?? vi.fn().mockResolvedValue(stubTrip)
    const deleteMany = overrides.deleteMany ?? vi.fn().mockResolvedValue({})
    const createMany = overrides.createMany ?? vi.fn().mockResolvedValue({})
    const create =
      overrides.create ??
      vi.fn().mockResolvedValue({
        content: [{ type: 'text', text: JSON.stringify(stubItems) }],
      })

    return {
      prisma: {
        trip: { findUnique } as unknown as GenerateChecklistDeps['prisma']['trip'],
        checklistItem: { deleteMany, createMany } as unknown as GenerateChecklistDeps['prisma']['checklistItem'],
        user: {} as unknown as GenerateChecklistDeps['prisma']['user'],
      },
      anthropic: { messages: { create } } as unknown as GenerateChecklistDeps['anthropic'],
    }
  }

  beforeEach(() => vi.clearAllMocks())

  it('runs the full success path: deletes existing items then inserts new ones', async () => {
    const deleteMany = vi.fn().mockResolvedValue({})
    const createMany = vi.fn().mockResolvedValue({})
    const deps = buildDeps({ deleteMany, createMany })

    await generateChecklist(jobData, deps)

    expect(deleteMany).toHaveBeenCalledWith({ where: { tripId: 'trip_1' } })
    expect(createMany).toHaveBeenCalledTimes(1)

    const createArg = createMany.mock.calls[0]?.[0]
    expect(createArg.data).toHaveLength(2)
    expect(createArg.data[0]).toMatchObject({ tripId: 'trip_1', label: 'Passport', required: 'REQUIRED' })
    expect(createArg.data[1]).toMatchObject({ tripId: 'trip_1', label: 'Travel insurance', required: 'RECOMMENDED' })
  })

  it('discards (no AI call) when the trip is not found', async () => {
    const findUnique = vi.fn().mockResolvedValue(null)
    const create = vi.fn()
    const deps = buildDeps({ findUnique, create })

    await generateChecklist(jobData, deps)

    expect(create).not.toHaveBeenCalled()
  })

  it('discards when the userId does not match the trip', async () => {
    const findUnique = vi.fn().mockResolvedValue({ ...stubTrip, userId: 'other_user' })
    const create = vi.fn()
    const deps = buildDeps({ findUnique, create })

    await generateChecklist(jobData, deps)

    expect(create).not.toHaveBeenCalled()
  })

  it('throws when the Zod validation fails on the AI response', async () => {
    const create = vi.fn().mockResolvedValue({
      content: [{ type: 'text', text: '[{"label":"X","description":"","required":"mandatory"}]' }],
    })
    const createMany = vi.fn()
    const deps = buildDeps({ create, createMany })

    await expect(generateChecklist(jobData, deps)).rejects.toThrow()
    expect(createMany).not.toHaveBeenCalled()
  })

  it('throws when the AI returns non-JSON', async () => {
    const create = vi.fn().mockResolvedValue({
      content: [{ type: 'text', text: 'Sorry, I cannot help with that.' }],
    })
    const createMany = vi.fn()
    const deps = buildDeps({ create, createMany })

    await expect(generateChecklist(jobData, deps)).rejects.toThrow()
    expect(createMany).not.toHaveBeenCalled()
  })

  it('uses 7 days when returnDate is null', async () => {
    const findUnique = vi.fn().mockResolvedValue({ ...stubTrip, returnDate: null })
    const create = vi.fn().mockResolvedValue({
      content: [{ type: 'text', text: JSON.stringify(stubItems) }],
    })
    const deps = buildDeps({ findUnique, create })

    await generateChecklist(jobData, deps)

    expect(create).toHaveBeenCalledOnce()
    type CreateArg = { messages: { content: string }[] }
    const calls = create.mock.calls as unknown as [CreateArg][]
    const firstArg = calls[0]?.[0]
    if (!firstArg) throw new Error('create was not called with expected args')
    const prompt = firstArg.messages[0]?.content ?? ''
    expect(prompt).toContain('7 days')
  })
})
