import { z } from 'zod'
import type Anthropic from '@anthropic-ai/sdk'
import type { DocumentType } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { anthropic } from '@/lib/ai'
import { getPresignedDownloadUrl } from '@/lib/s3'
import { logger } from '@/lib/logger'

/**
 * Core document-processing logic, kept free of any BullMQ or Redis imports so it
 * can be unit-tested and invoked without a running queue. The BullMQ worker
 * entry point (`document-processor.ts`) is a thin wrapper that calls
 * `processDocument` with the production dependencies.
 */

/** Claude model used for document parsing — see CLAUDE.md "Document Parser". */
export const DOCUMENT_PARSER_MODEL = 'claude-opus-4-6'
export const DOCUMENT_PARSER_MAX_TOKENS = 1024

/**
 * Authoritative prompt contract from CLAUDE.md. Do not edit without updating
 * that file and the Zod schema below in lock-step.
 */
export const DOCUMENT_PARSER_PROMPT = `Extract the following from this document image or PDF:
- Document type (passport/visa/insurance/booking/vaccination/identity_card/other)
- If type is "booking", also include bookingSubtype: "flight", "hotel", or "other"
- Expiry date (ISO 8601 format, or null)
- Issue date (ISO 8601 format, or null)
- Document number (or null)
- Issuing authority or country (or null)
- Full name on document (or null)

Return JSON only. No explanation. No markdown fences.
Schema: { type, bookingSubtype, expiryDate, issueDate, docNumber, issuedBy, fullName }
bookingSubtype is only required when type is "booking"; omit or set to null otherwise.`

/** The type values the parser may return, per the prompt contract. */
export const DOCUMENT_PARSER_TYPES = [
  'passport',
  'visa',
  'insurance',
  'booking',
  'vaccination',
  'identity_card',
  'other',
] as const

export type DocumentParserType = (typeof DOCUMENT_PARSER_TYPES)[number]

const PARSER_TYPE_TO_DOCUMENT_TYPE: Record<DocumentParserType, DocumentType> = {
  passport: 'PASSPORT',
  visa: 'VISA',
  insurance: 'TRAVEL_INSURANCE',
  booking: 'OTHER',
  vaccination: 'VACCINATION_RECORD',
  identity_card: 'IDENTITY_CARD',
  other: 'OTHER',
}

/** Booking subtype values the parser may return when `type === "booking"`. */
export const BOOKING_SUBTYPES = ['flight', 'hotel', 'other'] as const
export type BookingSubtype = (typeof BOOKING_SUBTYPES)[number]

/**
 * Maps the parser's type vocabulary onto the Prisma `DocumentType` enum.
 * When `type` is `"booking"`, the optional `bookingSubtype` field distinguishes
 * `FLIGHT_BOOKING` from `HOTEL_BOOKING`; anything else falls through to `OTHER`.
 */
export function mapParserTypeToDocumentType(
  type: DocumentParserType,
  bookingSubtype?: string | null
): DocumentType {
  if (type === 'booking') {
    if (bookingSubtype === 'flight') return 'FLIGHT_BOOKING'
    if (bookingSubtype === 'hotel') return 'HOTEL_BOOKING'
    return 'OTHER'
  }
  return PARSER_TYPE_TO_DOCUMENT_TYPE[type]
}

// `z.null()` must precede `z.coerce.date()`: `new Date(null)` silently coerces
// to the epoch, so order matters to keep nulls as nulls. `.optional()` makes the
// object key itself optional (absent → undefined → null below).
const nullableDate = z
  .union([z.null(), z.coerce.date()])
  .optional()
  .transform((value) => value ?? null)

const nullableString = z
  .union([z.string(), z.null()])
  .optional()
  .transform((value) => {
    if (value == null) return null
    const trimmed = value.trim()
    return trimmed === '' ? null : trimmed
  })

const nullableBookingSubtype = z
  .union([z.enum(BOOKING_SUBTYPES), z.null()])
  .optional()
  .transform((value) => value ?? null)

/**
 * Validates a parsed document-parser response. Matches the prompt contract:
 * `type` is required, every other field is nullable. Date strings are coerced
 * to `Date`; malformed dates fail validation.
 */
export const documentParserSchema = z.object({
  type: z.enum(DOCUMENT_PARSER_TYPES),
  bookingSubtype: nullableBookingSubtype,
  expiryDate: nullableDate,
  issueDate: nullableDate,
  docNumber: nullableString,
  issuedBy: nullableString,
  fullName: nullableString,
})

export type DocumentParserResult = z.infer<typeof documentParserSchema>

/**
 * Strips a single wrapping markdown code fence (```json … ``` or ``` … ```)
 * from a model response. Returns the input trimmed when there are no fences.
 */
export function stripMarkdownFences(raw: string): string {
  const text = raw.trim()
  if (!text.startsWith('```')) return text
  return text
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim()
}

/**
 * Defensively parses and validates a document-parser model response: strip
 * fences, `JSON.parse`, then run through the Zod schema. Logs the raw response
 * and throws (so BullMQ retries) on any failure.
 */
export function parseDocumentParserResponse(raw: string): DocumentParserResult {
  const cleaned = stripMarkdownFences(raw)

  let parsed: unknown
  try {
    parsed = JSON.parse(cleaned)
  } catch {
    logger.error({ rawResponse: raw }, 'Document parser returned non-JSON response')
    throw new Error('Document parser response was not valid JSON')
  }

  const result = documentParserSchema.safeParse(parsed)
  if (!result.success) {
    logger.error(
      { rawResponse: raw, issues: result.error.issues },
      'Document parser response failed schema validation'
    )
    throw new Error('Document parser response failed schema validation')
  }

  return result.data
}

type DocumentParserContentBlock =
  | Anthropic.ImageBlockParam
  | Anthropic.DocumentBlockParam

/**
 * Builds the Anthropic content block for the file: a `document` block for PDFs,
 * an `image` block for supported image types (validated at upload time).
 */
export function buildFileContentBlock(
  mimeType: string,
  base64Data: string
): DocumentParserContentBlock {
  if (mimeType === 'application/pdf') {
    return {
      type: 'document',
      source: { type: 'base64', media_type: 'application/pdf', data: base64Data },
    }
  }

  return {
    type: 'image',
    source: {
      type: 'base64',
      media_type: mimeType as Anthropic.Base64ImageSource['media_type'],
      data: base64Data,
    },
  }
}

export interface DocumentProcessingJobData {
  documentId: string
  userId: string
}

/** Injectable dependencies so the worker is testable without real clients. */
export interface ProcessDocumentDeps {
  prisma: Pick<typeof prisma, 'document'>
  anthropic: Pick<Anthropic, 'messages'>
  getDownloadUrl: (fileKey: string) => Promise<string>
  fetchFile: (url: string) => Promise<ArrayBuffer>
}

async function defaultFetchFile(url: string): Promise<ArrayBuffer> {
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`Failed to fetch document from storage (status ${res.status})`)
  }
  return res.arrayBuffer()
}

const defaultDeps: ProcessDocumentDeps = {
  prisma,
  anthropic,
  getDownloadUrl: getPresignedDownloadUrl,
  fetchFile: defaultFetchFile,
}

function extractResponseText(message: Anthropic.Message): string {
  const textBlock = message.content.find(
    (block): block is Anthropic.TextBlock => block.type === 'text'
  )
  if (!textBlock) {
    throw new Error('Document parser returned no text content')
  }
  return textBlock.text
}

/**
 * Processes a single document: fetch it from S3, send it to Claude for metadata
 * extraction, validate the response, and persist the extracted fields.
 *
 * Discards the job (no error) when the document no longer exists or has already
 * been processed. Any genuine failure is logged with context and rethrown so
 * BullMQ applies its configured retry/backoff policy.
 */
export async function processDocument(
  data: DocumentProcessingJobData,
  deps: ProcessDocumentDeps = defaultDeps
): Promise<void> {
  const { documentId, userId } = data

  try {
    const document = await deps.prisma.document.findUnique({
      where: { id: documentId },
      select: { id: true, fileKey: true, mimeType: true, aiProcessed: true },
    })

    if (!document) {
      logger.warn({ documentId, userId }, 'Document not found; discarding processing job')
      return
    }

    if (document.aiProcessed) {
      logger.info({ documentId, userId }, 'Document already processed; discarding job')
      return
    }

    const downloadUrl = await deps.getDownloadUrl(document.fileKey)
    const bytes = await deps.fetchFile(downloadUrl)
    const base64Data = Buffer.from(bytes).toString('base64')

    const fileBlock = buildFileContentBlock(document.mimeType, base64Data)

    const message = await deps.anthropic.messages.create({
      model: DOCUMENT_PARSER_MODEL,
      max_tokens: DOCUMENT_PARSER_MAX_TOKENS,
      messages: [
        {
          role: 'user',
          content: [fileBlock, { type: 'text', text: DOCUMENT_PARSER_PROMPT }],
        },
      ],
    })

    const parsed = parseDocumentParserResponse(extractResponseText(message))
    const documentType = mapParserTypeToDocumentType(parsed.type, parsed.bookingSubtype)

    await deps.prisma.document.update({
      where: { id: documentId },
      data: {
        type: documentType,
        expiryDate: parsed.expiryDate,
        issueDate: parsed.issueDate,
        docNumber: parsed.docNumber,
        issuedBy: parsed.issuedBy,
        aiProcessed: true,
      },
    })

    logger.info({ documentId, type: documentType }, 'Document processed and metadata extracted')
  } catch (err) {
    logger.error({ err, documentId, userId }, 'Document processing failed')
    throw err
  }
}
