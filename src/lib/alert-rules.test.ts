import { describe, it, expect } from 'vitest'
import {
  isPassportExpiring,
  isVisaExpiring,
  isInsuranceInsufficient,
  isTripHealthLow,
  isTripDepartingSoon,
  PASSPORT_WARNING_DAYS,
  VISA_WARNING_DAYS,
  TRIP_WARNING_DAYS,
  TRIP_HEALTH_THRESHOLD_PERCENT,
} from './alert-rules'

const NOW = new Date('2026-01-01T12:00:00Z')

function daysFromNow(days: number): Date {
  const d = new Date(NOW)
  d.setDate(d.getDate() + days)
  return d
}

// ── isPassportExpiring ────────────────────────────────────────────────────────

describe('isPassportExpiring', () => {
  it('returns true when passport expires exactly at the 12-month boundary', () => {
    expect(isPassportExpiring(daysFromNow(PASSPORT_WARNING_DAYS), NOW)).toBe(true)
  })

  it('returns true for a passport expiring in 6 months (well within window)', () => {
    expect(isPassportExpiring(daysFromNow(180), NOW)).toBe(true)
  })

  it('returns true for a passport expiring tomorrow (edge of window)', () => {
    expect(isPassportExpiring(daysFromNow(1), NOW)).toBe(true)
  })

  it('returns false for a passport expiring more than 12 months away', () => {
    expect(isPassportExpiring(daysFromNow(PASSPORT_WARNING_DAYS + 1), NOW)).toBe(false)
  })

  it('returns false for an already-expired passport', () => {
    expect(isPassportExpiring(daysFromNow(-1), NOW)).toBe(false)
  })

  it('returns false for a passport expiring exactly now (not strictly in the future)', () => {
    expect(isPassportExpiring(new Date(NOW), NOW)).toBe(false)
  })
})

// ── isVisaExpiring ────────────────────────────────────────────────────────────

describe('isVisaExpiring', () => {
  it('returns true when visa expires exactly at the 30-day boundary', () => {
    expect(isVisaExpiring(daysFromNow(VISA_WARNING_DAYS), NOW)).toBe(true)
  })

  it('returns true for a visa expiring in 15 days', () => {
    expect(isVisaExpiring(daysFromNow(15), NOW)).toBe(true)
  })

  it('returns false for a visa expiring in 31 days (outside window)', () => {
    expect(isVisaExpiring(daysFromNow(31), NOW)).toBe(false)
  })

  it('returns false for an already-expired visa', () => {
    expect(isVisaExpiring(daysFromNow(-5), NOW)).toBe(false)
  })
})

// ── isTripDepartingSoon ───────────────────────────────────────────────────────

describe('isTripDepartingSoon', () => {
  it('returns true when trip departs within 7 days', () => {
    expect(isTripDepartingSoon(daysFromNow(3), NOW)).toBe(true)
  })

  it('returns true at the exact 7-day boundary', () => {
    expect(isTripDepartingSoon(daysFromNow(TRIP_WARNING_DAYS), NOW)).toBe(true)
  })

  it('returns false when trip departs more than 7 days away', () => {
    expect(isTripDepartingSoon(daysFromNow(8), NOW)).toBe(false)
  })

  it('returns false for a trip that has already departed', () => {
    expect(isTripDepartingSoon(daysFromNow(-1), NOW)).toBe(false)
  })

  it('returns false for a trip departing exactly now', () => {
    expect(isTripDepartingSoon(new Date(NOW), NOW)).toBe(false)
  })
})

// ── isInsuranceInsufficient ───────────────────────────────────────────────────

describe('isInsuranceInsufficient', () => {
  const departure = daysFromNow(3)
  const returnDate = daysFromNow(10)

  it('returns true when there is no insurance document', () => {
    expect(isInsuranceInsufficient(departure, returnDate, null, NOW)).toBe(true)
  })

  it('returns true when insurance expires before the return date', () => {
    const insufficientExpiry = daysFromNow(8) // expires before day 10 return
    expect(isInsuranceInsufficient(departure, returnDate, insufficientExpiry, NOW)).toBe(true)
  })

  it('returns false when insurance covers exactly to the return date', () => {
    expect(isInsuranceInsufficient(departure, returnDate, returnDate, NOW)).toBe(false)
  })

  it('returns false when insurance covers beyond the return date', () => {
    const goodExpiry = daysFromNow(20)
    expect(isInsuranceInsufficient(departure, returnDate, goodExpiry, NOW)).toBe(false)
  })

  it('returns false when the trip departs more than 7 days away (outside warning window)', () => {
    const farDeparture = daysFromNow(10)
    expect(isInsuranceInsufficient(farDeparture, daysFromNow(17), null, NOW)).toBe(false)
  })

  it('uses departure date as coverage end when no return date is set', () => {
    // Insurance expires on the departure day — counts as covered
    expect(isInsuranceInsufficient(departure, null, departure, NOW)).toBe(false)
    // Insurance expires before departure — not covered
    expect(isInsuranceInsufficient(departure, null, daysFromNow(2), NOW)).toBe(true)
  })
})

// ── isTripHealthLow ───────────────────────────────────────────────────────────

describe('isTripHealthLow', () => {
  const departure = daysFromNow(4)

  it(`returns true when health is below ${TRIP_HEALTH_THRESHOLD_PERCENT}%`, () => {
    expect(isTripHealthLow(departure, 79, NOW)).toBe(true)
    expect(isTripHealthLow(departure, 0, NOW)).toBe(true)
  })

  it(`returns false when health is exactly ${TRIP_HEALTH_THRESHOLD_PERCENT}%`, () => {
    expect(isTripHealthLow(departure, TRIP_HEALTH_THRESHOLD_PERCENT, NOW)).toBe(false)
  })

  it('returns false when health is above threshold', () => {
    expect(isTripHealthLow(departure, 100, NOW)).toBe(false)
  })

  it('returns false when health percent is null (no required items)', () => {
    expect(isTripHealthLow(departure, null, NOW)).toBe(false)
  })

  it('returns false when trip departs more than 7 days away', () => {
    expect(isTripHealthLow(daysFromNow(10), 50, NOW)).toBe(false)
  })
})
