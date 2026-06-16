import { describe, it, expect } from 'vitest'
import { logger } from './logger'

describe('logger', () => {
  it('is defined', () => {
    expect(logger).toBeDefined()
  })

  it('has correct log level in test env', () => {
    expect(['debug', 'info', 'trace']).toContain(logger.level)
  })
})
