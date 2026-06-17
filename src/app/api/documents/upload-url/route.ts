import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { getCurrentUser } from '@/lib/current-user'
import { buildFileKey, getPresignedUploadUrl } from '@/lib/s3'
import { validateUpload, FREE_DOCUMENT_LIMIT } from '@/lib/documents'
import { documentProcessingQueue } from '@/lib/queues'

const bodySchema = z.object({
  filename: z.string().trim().min(1).max(255),
  mimeType: z.string().min(1),
  fileSize: z.number().int().positive(),
  tripId: z.string().optional().nullable(),
})

interface UploadUrlResponse {
  documentId: string
  uploadUrl: string
}

type ErrorResponse = { error: string; code?: string }

export async function POST(
  req: Request
): Promise<NextResponse<UploadUrlResponse | ErrorResponse>> {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
  }

  let json: unknown
  try {
    json = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = bodySchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request body', code: 'VALIDATION_ERROR' },
      { status: 400 }
    )
  }

  const { filename, mimeType, fileSize, tripId } = parsed.data

  const validation = validateUpload({ mimeType, fileSize })
  if (!validation.ok) {
    return NextResponse.json(
      { error: validation.error, code: validation.code },
      { status: 422 }
    )
  }

  // Enforce the Free plan document allowance before any S3 or DB write.
  const documentCount = await prisma.document.count({ where: { userId: user.id } })
  if (documentCount >= FREE_DOCUMENT_LIMIT) {
    return NextResponse.json(
      { error: 'Document limit reached', code: 'LIMIT_DOCUMENTS' },
      { status: 402 }
    )
  }

  const fileKey = buildFileKey(user.id, filename)

  try {
    const uploadUrl = await getPresignedUploadUrl(fileKey, mimeType)

    const document = await prisma.document.create({
      data: {
        userId: user.id,
        type: 'OTHER',
        name: filename,
        fileKey,
        fileSize,
        mimeType,
        aiProcessed: false,
        ...(tripId ? { tripId } : {}),
      },
      select: { id: true },
    })

    logger.info({ userId: user.id, documentId: document.id }, 'Document upload URL issued')

    // Enqueue async AI processing. A queue hiccup must not fail the upload — the
    // row simply stays unprocessed — so failures are logged, not propagated.
    try {
      await documentProcessingQueue.add('process-document', {
        documentId: document.id,
        userId: user.id,
      })
      logger.info({ documentId: document.id }, 'Enqueued document-processing job')
    } catch (queueErr) {
      logger.error(
        { err: queueErr, documentId: document.id },
        'Failed to enqueue document-processing job'
      )
    }

    return NextResponse.json(
      { documentId: document.id, uploadUrl },
      { status: 201 }
    )
  } catch (err) {
    logger.error({ err, userId: user.id }, 'Failed to create document upload URL')
    return NextResponse.json({ error: 'Failed to create upload URL' }, { status: 500 })
  }
}
