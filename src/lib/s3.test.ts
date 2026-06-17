import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'

// Mock the presigner so no network call happens; capture the command it receives
// to assert on the command shape our helpers build.
const getSignedUrl = vi.fn(async (...args: unknown[]) => {
  void args
  return 'https://signed.example/url'
})
vi.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: (...args: unknown[]) => getSignedUrl(...args),
}))

import {
  buildFileKey,
  getPresignedUploadUrl,
  getPresignedDownloadUrl,
} from './s3'

beforeEach(() => {
  getSignedUrl.mockClear()
})

describe('buildFileKey', () => {
  it('generates a path under documents/{userId}/', () => {
    const key = buildFileKey('user_abc', 'my passport.pdf')
    expect(key).toMatch(/^documents\/user_abc\/\d+_my_passport\.pdf$/)
  })

  it('sanitises special characters in filename', () => {
    const key = buildFileKey('user_abc', 'my file (1).pdf')
    expect(key).not.toContain(' ')
    expect(key).not.toContain('(')
  })
})

describe('getPresignedUploadUrl', () => {
  it('signs a PutObjectCommand with the key, content type, and AES256 encryption', async () => {
    const url = await getPresignedUploadUrl('documents/u/123_file.pdf', 'application/pdf')

    expect(url).toBe('https://signed.example/url')
    expect(getSignedUrl).toHaveBeenCalledTimes(1)

    const command = getSignedUrl.mock.calls[0]?.[1] as unknown as PutObjectCommand
    expect(command).toBeInstanceOf(PutObjectCommand)
    expect(command.input.Key).toBe('documents/u/123_file.pdf')
    expect(command.input.ContentType).toBe('application/pdf')
    expect(command.input.ServerSideEncryption).toBe('AES256')
    expect(command.input.Bucket).toBeTruthy()
  })

  it('uses a 15-minute expiry', async () => {
    await getPresignedUploadUrl('documents/u/123_file.pdf', 'application/pdf')
    const options = getSignedUrl.mock.calls[0]?.[2] as unknown as { expiresIn: number }
    expect(options.expiresIn).toBe(900)
  })
})

describe('getPresignedDownloadUrl', () => {
  it('signs a GetObjectCommand with the key and a 15-minute expiry', async () => {
    const url = await getPresignedDownloadUrl('documents/u/123_file.pdf')

    expect(url).toBe('https://signed.example/url')
    const command = getSignedUrl.mock.calls[0]?.[1] as unknown as GetObjectCommand
    expect(command).toBeInstanceOf(GetObjectCommand)
    expect(command.input.Key).toBe('documents/u/123_file.pdf')

    const options = getSignedUrl.mock.calls[0]?.[2] as unknown as { expiresIn: number }
    expect(options.expiresIn).toBe(900)
  })
})
