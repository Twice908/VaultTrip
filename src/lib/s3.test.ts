import { describe, it, expect } from 'vitest'
import { buildFileKey } from './s3'

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
