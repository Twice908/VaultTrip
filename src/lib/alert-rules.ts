// Pure, side-effect-free functions for alert eligibility checks.
// All accept an optional `now` parameter for deterministic testing.

export const PASSPORT_WARNING_DAYS = 365
export const VISA_WARNING_DAYS = 30
export const TRIP_WARNING_DAYS = 7
export const TRIP_HEALTH_THRESHOLD_PERCENT = 80

function addDays(date: Date, days: number): Date {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

/** True when the passport expires within the next 12 months but has not yet expired. */
export function isPassportExpiring(expiryDate: Date, now: Date = new Date()): boolean {
  const cutoff = addDays(now, PASSPORT_WARNING_DAYS)
  return expiryDate > now && expiryDate <= cutoff
}

/** True when the visa expires within the next 30 days but has not yet expired. */
export function isVisaExpiring(expiryDate: Date, now: Date = new Date()): boolean {
  const cutoff = addDays(now, VISA_WARNING_DAYS)
  return expiryDate > now && expiryDate <= cutoff
}

/**
 * True when a trip departs within 7 days AND travel insurance does not cover the full trip.
 * "Does not cover" means: no insurance document found, or insurance expires before the trip ends.
 */
export function isInsuranceInsufficient(
  tripDepartureDate: Date,
  tripReturnDate: Date | null,
  insuranceExpiryDate: Date | null,
  now: Date = new Date()
): boolean {
  if (!isTripDepartingSoon(tripDepartureDate, now)) return false
  const coverageEnd = tripReturnDate ?? tripDepartureDate
  if (!insuranceExpiryDate) return true
  return insuranceExpiryDate < coverageEnd
}

/** True when a trip departs within 7 days and the health score is below 80%. */
export function isTripHealthLow(
  tripDepartureDate: Date,
  healthPercent: number | null,
  now: Date = new Date()
): boolean {
  if (!isTripDepartingSoon(tripDepartureDate, now)) return false
  if (healthPercent === null) return false
  return healthPercent < TRIP_HEALTH_THRESHOLD_PERCENT
}

/** True when the trip departure is strictly in the future but within the next 7 days. */
export function isTripDepartingSoon(departureDate: Date, now: Date = new Date()): boolean {
  const cutoff = addDays(now, TRIP_WARNING_DAYS)
  return departureDate > now && departureDate <= cutoff
}
