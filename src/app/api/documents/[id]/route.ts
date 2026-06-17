import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { getCurrentUser } from '@/lib/current-user'
import { getPresignedDownloadUrl, deleteS3Object } from '@/lib/s3'
import { toDocumentDTO, type DocumentDetailDTO } from '@/types/document'

type ErrorResponse = { error: string; code?: string }
type RouteContext = { params: { id: string } }

export async function GET(
  _req: Request,
  { params }: RouteContext
): Promise<NextResponse<DocumentDetailDTO | ErrorResponse>> {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
  }

  const document = await prisma.document.findUnique({ where: { id: params.id } })
  if (!document || document.userId !== user.id) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 })
  }

  try {
    const downloadUrl = await getPresignedDownloadUrl(document.fileKey)
    return NextResponse.json({ ...toDocumentDTO(document), downloadUrl })
  } catch (err) {
    logger.error({ err, userId: user.id, documentId: document.id }, 'Failed to issue download URL')
    return NextResponse.json({ error: 'Failed to generate download URL' }, { status: 500 })
  }
}

export async function DELETE(
  _req: Request,
  { params }: RouteContext
): Promise<NextResponse<{ success: true } | ErrorResponse>> {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
  }

  const document = await prisma.document.findUnique({ where: { id: params.id } })
  if (!document || document.userId !== user.id) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 })
  }

  try {
    await deleteS3Object(document.fileKey)
    await prisma.document.delete({ where: { id: document.id } })

    logger.info({ userId: user.id, documentId: document.id }, 'Document deleted')

    return NextResponse.json({ success: true })
  } catch (err) {
    logger.error({ err, userId: user.id, documentId: document.id }, 'Failed to delete document')
    return NextResponse.json({ error: 'Failed to delete document' }, { status: 500 })
  }
}
