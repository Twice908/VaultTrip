import { describe, it, expect } from 'vitest'
import { computeHealthScore } from './trip'

describe('computeHealthScore', () => {
  it('returns percent: null when there are no required items', () => {
    const score = computeHealthScore([
      { required: 'RECOMMENDED', status: 'FULFILLED' },
      { required: 'OPTIONAL', status: 'PENDING' },
    ])
    expect(score).toEqual({ fulfilled: 0, total: 0, percent: null })
  })

  it('returns 100% when all required items are fulfilled', () => {
    const score = computeHealthScore([
      { required: 'REQUIRED', status: 'FULFILLED' },
      { required: 'REQUIRED', status: 'FULFILLED' },
      { required: 'RECOMMENDED', status: 'PENDING' },
    ])
    expect(score).toEqual({ fulfilled: 2, total: 2, percent: 100 })
  })

  it('returns 0% when no required items are fulfilled', () => {
    const score = computeHealthScore([
      { required: 'REQUIRED', status: 'PENDING' },
      { required: 'REQUIRED', status: 'FLAGGED' },
    ])
    expect(score).toEqual({ fulfilled: 0, total: 2, percent: 0 })
  })

  it('computes a mixed score correctly', () => {
    const score = computeHealthScore([
      { required: 'REQUIRED', status: 'FULFILLED' },
      { required: 'REQUIRED', status: 'FULFILLED' },
      { required: 'REQUIRED', status: 'PENDING' },
      { required: 'REQUIRED', status: 'FLAGGED' },
      { required: 'RECOMMENDED', status: 'FULFILLED' },
    ])
    // 2 fulfilled out of 4 required = 50%
    expect(score).toEqual({ fulfilled: 2, total: 4, percent: 50 })
  })

  it('rounds the percent to the nearest integer', () => {
    const score = computeHealthScore([
      { required: 'REQUIRED', status: 'FULFILLED' },
      { required: 'REQUIRED', status: 'FULFILLED' },
      { required: 'REQUIRED', status: 'PENDING' },
    ])
    // 2/3 = 66.67% → rounds to 67
    expect(score.percent).toBe(67)
  })

  it('handles an empty checklist', () => {
    const score = computeHealthScore([])
    expect(score).toEqual({ fulfilled: 0, total: 0, percent: null })
  })

  it('only counts FULFILLED (not NOT_APPLICABLE or FLAGGED) as fulfilled', () => {
    const score = computeHealthScore([
      { required: 'REQUIRED', status: 'NOT_APPLICABLE' },
      { required: 'REQUIRED', status: 'FLAGGED' },
      { required: 'REQUIRED', status: 'FULFILLED' },
    ])
    expect(score).toEqual({ fulfilled: 1, total: 3, percent: 33 })
  })
})
