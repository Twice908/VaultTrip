import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock all side-effect modules before importing the route
vi.mock('@/lib/prisma', () => ({
  prisma: {
    trip: {
      count: vi.fn(),
      create: vi.fn(),
      findMany: vi.fn(),
    },
  },
}))
vi.mock('@/lib/queues', () => ({
  checklistGenerationQueue: { add: vi.fn() },
}))
vi.mock('@/lib/current-user', () => ({
  getCurrentUser: vi.fn(),
}))
vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

import { prisma } from '@/lib/prisma'
import { checklistGenerationQueue } from '@/lib/queues'
import { getCurrentUser } from '@/lib/current-user'
import { POST } from './route'

const mockPrisma = prisma as unknown as {
  trip: {
    count: ReturnType<typeof vi.fn>
    create: ReturnType<typeof vi.fn>
    findMany: ReturnType<typeof vi.fn>
  }
}
const mockQueue = checklistGenerationQueue as unknown as { add: ReturnType<typeof vi.fn> }
const mockGetCurrentUser = getCurrentUser as ReturnType<typeof vi.fn>

function makeRequest(body: object): Request {
  return new Request('http://localhost/api/trips', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const VALID_BODY = {
  name: 'Japan Summer',
  origin: 'GB',
  destination: 'JP',
  departureDate: new Date(Date.now() + 86_400_000 * 30).toISOString(),
  tripType: 'TOURISM',
}

describe('POST /api/trips', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetCurrentUser.mockResolvedValue({ id: 'user_1' })
    mockPrisma.trip.count.mockResolvedValue(0)
    mockPrisma.trip.create.mockResolvedValue({
      id: 'trip_1',
      name: 'Japan Summer',
      origin: 'GB',
      destination: 'JP',
      departureDate: new Date(VALID_BODY.departureDate),
      returnDate: null,
      tripType: 'TOURISM',
      shareToken: null,
      createdAt: new Date(),
      _count: { documents: 0 },
      checklist: [],
    })
    mockQueue.add.mockResolvedValue({})
  })

  it('returns 201 with the new trip on success', async () => {
    const res = await POST(makeRequest(VALID_BODY))
    expect(res.status).toBe(201)
    const data = (await res.json()) as { trip: { id: string } }
    expect(data.trip.id).toBe('trip_1')
    expect(mockQueue.add).toHaveBeenCalledOnce()
  })

  it('returns 402 with LIMIT_TRIPS code when user has 3 trips', async () => {
    mockPrisma.trip.count.mockResolvedValue(3)

    const res = await POST(makeRequest(VALID_BODY))

    expect(res.status).toBe(402)
    const data = (await res.json()) as { code: string }
    expect(data.code).toBe('LIMIT_TRIPS')
    expect(mockPrisma.trip.create).not.toHaveBeenCalled()
    expect(mockQueue.add).not.toHaveBeenCalled()
  })

  it('returns 401 when unauthenticated', async () => {
    mockGetCurrentUser.mockResolvedValue(null)
    const res = await POST(makeRequest(VALID_BODY))
    expect(res.status).toBe(401)
  })

  it('returns 400 for a missing required field', async () => {
    const res = await POST(makeRequest({ ...VALID_BODY, destination: undefined }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when departureDate is in the past', async () => {
    const res = await POST(makeRequest({
      ...VALID_BODY,
      departureDate: new Date(Date.now() - 86_400_000).toISOString(),
    }))
    expect(res.status).toBe(400)
  })
})
