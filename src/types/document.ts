import type { Document, DocumentType } from '@prisma/client'

/**
 * The shape of a Document as exposed over the API. Dates are serialised to ISO
 * strings for JSON transport, and `fileKey` is deliberately omitted — clients
 * never see the raw S3 key (see CLAUDE.md security rules).
 */
export interface DocumentDTO {
  id: string
  tripId: string | null
  type: DocumentType
  name: string
  fileSize: number
  mimeType: string
  expiryDate: string | null
  issueDate: string | null
  docNumber: string | null
  issuedBy: string | null
  aiProcessed: boolean
  createdAt: string
}

/** A document detail response includes a short-lived presigned download URL. */
export interface DocumentDetailDTO extends DocumentDTO {
  downloadUrl: string
}

/** Strips sensitive fields and serialises dates for a Prisma Document row. */
export function toDocumentDTO(doc: Document): DocumentDTO {
  return {
    id: doc.id,
    tripId: doc.tripId,
    type: doc.type,
    name: doc.name,
    fileSize: doc.fileSize,
    mimeType: doc.mimeType,
    expiryDate: doc.expiryDate?.toISOString() ?? null,
    issueDate: doc.issueDate?.toISOString() ?? null,
    docNumber: doc.docNumber,
    issuedBy: doc.issuedBy,
    aiProcessed: doc.aiProcessed,
    createdAt: doc.createdAt.toISOString(),
  }
}
