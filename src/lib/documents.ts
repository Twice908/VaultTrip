/**
 * Document upload constraints and validation logic. Kept free of any I/O so it
 * can be unit-tested in isolation and reused on both the client (pre-flight
 * checks before any API call) and the server (authoritative enforcement).
 */

export const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
] as const

export type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number]

/** Maximum upload size in bytes (20 MB). */
export const MAX_FILE_SIZE = 20 * 1024 * 1024

/** Free plan document allowance. Enforced in the upload-url route handler. */
export const FREE_DOCUMENT_LIMIT = 10

const HUMAN_ALLOWED = 'PDF, JPG, PNG, or WebP'

export type UploadValidation =
  | { ok: true }
  | { ok: false; error: string; code: 'INVALID_TYPE' | 'INVALID_SIZE' | 'FILE_TOO_LARGE' }

export function isAllowedMimeType(mimeType: string): mimeType is AllowedMimeType {
  return (ALLOWED_MIME_TYPES as readonly string[]).includes(mimeType)
}

/**
 * Validates a candidate upload by mime type and size. Pure function — the same
 * result on client and server.
 */
export function validateUpload(input: { mimeType: string; fileSize: number }): UploadValidation {
  if (!isAllowedMimeType(input.mimeType)) {
    return {
      ok: false,
      error: `Unsupported file type. Only ${HUMAN_ALLOWED} files are allowed.`,
      code: 'INVALID_TYPE',
    }
  }

  if (!Number.isFinite(input.fileSize) || input.fileSize <= 0) {
    return { ok: false, error: 'File appears to be empty.', code: 'INVALID_SIZE' }
  }

  if (input.fileSize > MAX_FILE_SIZE) {
    return {
      ok: false,
      error: 'File exceeds the 20MB limit.',
      code: 'FILE_TOO_LARGE',
    }
  }

  return { ok: true }
}
