import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { env } from '@/env'

export const s3 = new S3Client({
  region: env.AWS_REGION,
  credentials: {
    accessKeyId: env.AWS_ACCESS_KEY_ID,
    secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
  },
})

const PRESIGNED_EXPIRY_SECONDS = 900 // 15 minutes

export async function getPresignedUploadUrl(key: string, mimeType: string): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: env.S3_BUCKET_NAME,
    Key: key,
    ContentType: mimeType,
    ServerSideEncryption: 'AES256',
  })
  return getSignedUrl(s3, command, { expiresIn: PRESIGNED_EXPIRY_SECONDS })
}

export async function getPresignedDownloadUrl(key: string): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: env.S3_BUCKET_NAME,
    Key: key,
  })
  return getSignedUrl(s3, command, { expiresIn: PRESIGNED_EXPIRY_SECONDS })
}

export async function deleteS3Object(key: string): Promise<void> {
  await s3.send(new DeleteObjectCommand({ Bucket: env.S3_BUCKET_NAME, Key: key }))
}

export function buildFileKey(userId: string, filename: string): string {
  const timestamp = Date.now()
  const sanitised = filename.replace(/[^a-zA-Z0-9._-]/g, '_')
  return `documents/${userId}/${timestamp}_${sanitised}`
}
