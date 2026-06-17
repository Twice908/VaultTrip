import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the lib modules so importing the worker logic never constructs real
// Prisma/Anthropic/S3 clients or touches env — all deps are injected per-test.
vi.mock('@/lib/prisma', () => ({
  prisma: { document: { findUnique: vi.fn(), update: vi.fn() } },
}))
vi.mock('@/lib/ai', () => ({ anthropic: { messages: { create: vi.fn() } } }))
vi.mock('@/lib/s3', () => ({ getPresignedDownloadUrl: vi.fn() }))
vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

import {
  documentParserSchema,
  stripMarkdownFences,
  parseDocumentParserResponse,
  buildFileContentBlock,
  mapParserTypeToDocumentType,
  processDocument,
  BOOKING_SUBTYPES,
  type ProcessDocumentDeps,
} from './document-processing'

describe('documentParserSchema', () => {
  it('accepts a fully populated valid response and coerces dates', () => {
    const result = documentParserSchema.safeParse({
      type: 'passport',
      expiryDate: '2030-05-01',
      issueDate: '2020-05-01',
      docNumber: 'X1234567',
      issuedBy: 'United Kingdom',
      fullName: 'Jane Traveler',
    })

    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.data.type).toBe('passport')
    expect(result.data.expiryDate).toBeInstanceOf(Date)
    expect(result.data.expiryDate?.toISOString()).toBe('2030-05-01T00:00:00.000Z')
    expect(result.data.issueDate).toBeInstanceOf(Date)
    expect(result.data.docNumber).toBe('X1234567')
  })

  it('accepts bookingSubtype for booking documents', () => {
    for (const subtype of BOOKING_SUBTYPES) {
      const result = documentParserSchema.safeParse({ type: 'booking', bookingSubtype: subtype })
      expect(result.success).toBe(true)
      if (!result.success) continue
      expect(result.data.bookingSubtype).toBe(subtype)
    }
  })

  it('treats missing bookingSubtype as null', () => {
    const result = documentParserSchema.safeParse({ type: 'booking' })
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.data.bookingSubtype).toBeNull()
  })

  it('rejects an unknown bookingSubtype value', () => {
    const result = documentParserSchema.safeParse({ type: 'booking', bookingSubtype: 'cruise' })
    expect(result.success).toBe(false)
  })

  it('accepts null for every nullable field', () => {
    const result = documentParserSchema.safeParse({
      type: 'other',
      expiryDate: null,
      issueDate: null,
      docNumber: null,
      issuedBy: null,
      fullName: null,
    })

    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.data.expiryDate).toBeNull()
    expect(result.data.issueDate).toBeNull()
    expect(result.data.docNumber).toBeNull()
    expect(result.data.issuedBy).toBeNull()
    expect(result.data.fullName).toBeNull()
  })

  it('treats missing nullable fields as null', () => {
    const result = documentParserSchema.safeParse({ type: 'visa' })

    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.data.expiryDate).toBeNull()
    expect(result.data.docNumber).toBeNull()
    expect(result.data.fullName).toBeNull()
  })

  it('normalises empty / whitespace strings to null', () => {
    const result = documentParserSchema.safeParse({
      type: 'visa',
      docNumber: '   ',
      issuedBy: '',
    })

    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.data.docNumber).toBeNull()
    expect(result.data.issuedBy).toBeNull()
  })

  it('rejects a malformed date string', () => {
    const result = documentParserSchema.safeParse({
      type: 'passport',
      expiryDate: 'not-a-real-date',
      issueDate: null,
      docNumber: null,
      issuedBy: null,
      fullName: null,
    })

    expect(result.success).toBe(false)
  })

  it('rejects an unknown document type', () => {
    const result = documentParserSchema.safeParse({ type: 'spaceship' })
    expect(result.success).toBe(false)
  })

  it('rejects a completely invalid JSON shape (array / missing type)', () => {
    expect(documentParserSchema.safeParse([1, 2, 3]).success).toBe(false)
    expect(documentParserSchema.safeParse({ expiryDate: null }).success).toBe(false)
  })
})

describe('stripMarkdownFences', () => {
  it('returns plain JSON unchanged (aside from trimming)', () => {
    expect(stripMarkdownFences('{"type":"passport"}')).toBe('{"type":"passport"}')
    expect(stripMarkdownFences('  {"type":"visa"}  ')).toBe('{"type":"visa"}')
  })

  it('strips ```json fences', () => {
    const fenced = '```json\n{"type":"passport"}\n```'
    expect(stripMarkdownFences(fenced)).toBe('{"type":"passport"}')
  })

  it('strips bare ``` fences', () => {
    const fenced = '```\n{"type":"visa"}\n```'
    expect(stripMarkdownFences(fenced)).toBe('{"type":"visa"}')
  })
})

describe('parseDocumentParserResponse', () => {
  it('parses fenced JSON into a validated result', () => {
    const raw = '```json\n{"type":"visa","expiryDate":"2031-01-01","issueDate":null,"docNumber":"V99","issuedBy":"France","fullName":"A B"}\n```'
    const result = parseDocumentParserResponse(raw)
    expect(result.type).toBe('visa')
    expect(result.expiryDate?.toISOString()).toBe('2031-01-01T00:00:00.000Z')
    expect(result.docNumber).toBe('V99')
  })

  it('throws on non-JSON content', () => {
    expect(() => parseDocumentParserResponse('I could not read this document.')).toThrow()
  })

  it('throws when JSON parses but fails schema validation', () => {
    expect(() => parseDocumentParserResponse('{"type":"unknown"}')).toThrow()
  })
})

describe('buildFileContentBlock', () => {
  it('builds a document block for PDFs', () => {
    const block = buildFileContentBlock('application/pdf', 'BASE64')
    expect(block).toEqual({
      type: 'document',
      source: { type: 'base64', media_type: 'application/pdf', data: 'BASE64' },
    })
  })

  it('builds an image block for images', () => {
    const block = buildFileContentBlock('image/png', 'BASE64')
    expect(block).toEqual({
      type: 'image',
      source: { type: 'base64', media_type: 'image/png', data: 'BASE64' },
    })
  })
})

describe('mapParserTypeToDocumentType', () => {
  it('maps non-booking parser types onto the Prisma enum', () => {
    expect(mapParserTypeToDocumentType('passport')).toBe('PASSPORT')
    expect(mapParserTypeToDocumentType('visa')).toBe('VISA')
    expect(mapParserTypeToDocumentType('insurance')).toBe('TRAVEL_INSURANCE')
    expect(mapParserTypeToDocumentType('vaccination')).toBe('VACCINATION_RECORD')
    expect(mapParserTypeToDocumentType('identity_card')).toBe('IDENTITY_CARD')
    expect(mapParserTypeToDocumentType('other')).toBe('OTHER')
  })

  it('resolves booking subtypes to the correct Prisma enum value', () => {
    expect(mapParserTypeToDocumentType('booking', 'flight')).toBe('FLIGHT_BOOKING')
    expect(mapParserTypeToDocumentType('booking', 'hotel')).toBe('HOTEL_BOOKING')
    expect(mapParserTypeToDocumentType('booking', 'other')).toBe('OTHER')
    expect(mapParserTypeToDocumentType('booking')).toBe('OTHER')
    expect(mapParserTypeToDocumentType('booking', null)).toBe('OTHER')
  })
})

describe('processDocument', () => {
  const jobData = { documentId: 'doc_1', userId: 'user_1' }

  function buildDeps(overrides: Partial<{
    findUnique: ReturnType<typeof vi.fn>
    update: ReturnType<typeof vi.fn>
    create: ReturnType<typeof vi.fn>
    getDownloadUrl: ReturnType<typeof vi.fn>
    fetchFile: ReturnType<typeof vi.fn>
  }> = {}) {
    const findUnique =
      overrides.findUnique ??
      vi.fn().mockResolvedValue({
        id: 'doc_1',
        fileKey: 'documents/user_1/123_passport.pdf',
        mimeType: 'application/pdf',
        aiProcessed: false,
      })
    const update = overrides.update ?? vi.fn().mockResolvedValue({})
    const create =
      overrides.create ??
      vi.fn().mockResolvedValue({
        content: [
          {
            type: 'text',
            text: '{"type":"passport","expiryDate":"2030-01-01","issueDate":"2020-01-01","docNumber":"P1","issuedBy":"UK","fullName":"Jane"}',
          },
        ],
      })
    const getDownloadUrl =
      overrides.getDownloadUrl ?? vi.fn().mockResolvedValue('https://signed.example/get')
    const fetchFile =
      overrides.fetchFile ?? vi.fn().mockResolvedValue(new TextEncoder().encode('PDFBYTES').buffer)

    const deps = {
      prisma: { document: { findUnique, update } },
      anthropic: { messages: { create } },
      getDownloadUrl,
      fetchFile,
    } as unknown as ProcessDocumentDeps

    return { deps, findUnique, update, create, getDownloadUrl, fetchFile }
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('runs the full success path and updates the row', async () => {
    const { deps, create, update, getDownloadUrl, fetchFile } = buildDeps()

    await processDocument(jobData, deps)

    expect(getDownloadUrl).toHaveBeenCalledWith('documents/user_1/123_passport.pdf')
    expect(fetchFile).toHaveBeenCalledWith('https://signed.example/get')

    // PDF should be sent as a document content block.
    const createArg = create.mock.calls[0]?.[0]
    expect(createArg.model).toBe('claude-opus-4-6')
    expect(createArg.max_tokens).toBe(1024)
    expect(createArg.messages[0].content[0].type).toBe('document')

    expect(update).toHaveBeenCalledTimes(1)
    const updateArg = update.mock.calls[0]?.[0]
    expect(updateArg.where).toEqual({ id: 'doc_1' })
    expect(updateArg.data.type).toBe('PASSPORT')
    expect(updateArg.data.aiProcessed).toBe(true)
    expect(updateArg.data.docNumber).toBe('P1')
    expect(updateArg.data.expiryDate).toBeInstanceOf(Date)
  })

  it('resolves FLIGHT_BOOKING when the parser returns bookingSubtype "flight"', async () => {
    const create = vi.fn().mockResolvedValue({
      content: [
        {
          type: 'text',
          text: '{"type":"booking","bookingSubtype":"flight","expiryDate":null,"issueDate":"2024-06-01","docNumber":"ABC123","issuedBy":"Ryanair","fullName":null}',
        },
      ],
    })
    const { deps, update } = buildDeps({ create })

    await processDocument(jobData, deps)

    const updateArg = update.mock.calls[0]?.[0]
    expect(updateArg.data.type).toBe('FLIGHT_BOOKING')
    expect(updateArg.data.aiProcessed).toBe(true)
  })

  it('resolves HOTEL_BOOKING when the parser returns bookingSubtype "hotel"', async () => {
    const create = vi.fn().mockResolvedValue({
      content: [
        {
          type: 'text',
          text: '{"type":"booking","bookingSubtype":"hotel","expiryDate":null,"issueDate":null,"docNumber":"H99","issuedBy":"Marriott","fullName":null}',
        },
      ],
    })
    const { deps, update } = buildDeps({ create })

    await processDocument(jobData, deps)

    const updateArg = update.mock.calls[0]?.[0]
    expect(updateArg.data.type).toBe('HOTEL_BOOKING')
  })

  it('discards the job (no AI call) when the document is already processed', async () => {
    const findUnique = vi.fn().mockResolvedValue({
      id: 'doc_1',
      fileKey: 'k',
      mimeType: 'application/pdf',
      aiProcessed: true,
    })
    const { deps, create, update } = buildDeps({ findUnique })

    await processDocument(jobData, deps)

    expect(create).not.toHaveBeenCalled()
    expect(update).not.toHaveBeenCalled()
  })

  it('discards the job when the document does not exist', async () => {
    const findUnique = vi.fn().mockResolvedValue(null)
    const { deps, create, update } = buildDeps({ findUnique })

    await processDocument(jobData, deps)

    expect(create).not.toHaveBeenCalled()
    expect(update).not.toHaveBeenCalled()
  })

  it('throws (for BullMQ retry) when the response fails Zod validation', async () => {
    const create = vi.fn().mockResolvedValue({
      content: [{ type: 'text', text: '{"type":"definitely-not-valid"}' }],
    })
    const { deps, update } = buildDeps({ create })

    await expect(processDocument(jobData, deps)).rejects.toThrow()
    expect(update).not.toHaveBeenCalled()
  })

  it('throws when the S3 fetch fails', async () => {
    const fetchFile = vi.fn().mockRejectedValue(new Error('S3 unavailable'))
    const { deps, create, update } = buildDeps({ fetchFile })

    await expect(processDocument(jobData, deps)).rejects.toThrow('S3 unavailable')
    expect(create).not.toHaveBeenCalled()
    expect(update).not.toHaveBeenCalled()
  })
})
