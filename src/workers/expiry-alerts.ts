import { prisma } from '@/lib/prisma'
import { resend, ALERT_FROM, passportExpiryEmailHtml, visaExpiryEmailHtml, insuranceCoverageEmailHtml, tripHealthEmailHtml } from '@/lib/resend'
import { sendAlertQueue } from '@/lib/queues'
import { logger } from '@/lib/logger'
import { env } from '@/env'
import { computeHealthScore } from '@/types/trip'
import {
  isPassportExpiring,
  isVisaExpiring,
  isInsuranceInsufficient,
  isTripHealthLow,
  PASSPORT_WARNING_DAYS,
  VISA_WARNING_DAYS,
  TRIP_WARNING_DAYS,
} from '@/lib/alert-rules'

// ── Job payload types (discriminated union for type safety) ───────────────────

export type AlertType = 'PASSPORT_EXPIRY' | 'VISA_EXPIRY' | 'INSURANCE_COVERAGE' | 'TRIP_HEALTH'

export type SendAlertJobData =
  | {
      alertType: 'PASSPORT_EXPIRY'
      userId: string
      entityId: string
      recipientEmail: string
      documentName: string
      expiryDate: string
    }
  | {
      alertType: 'VISA_EXPIRY'
      userId: string
      entityId: string
      recipientEmail: string
      documentName: string
      expiryDate: string
    }
  | {
      alertType: 'INSURANCE_COVERAGE'
      userId: string
      entityId: string
      recipientEmail: string
      tripName: string
      tripId: string
      departureDate: string
    }
  | {
      alertType: 'TRIP_HEALTH'
      userId: string
      entityId: string
      recipientEmail: string
      tripName: string
      tripId: string
      departureDate: string
      healthPercent: number
      missingItems: string[]
    }

// ── Dep injection interfaces ──────────────────────────────────────────────────

export interface ExpiryCheckDeps {
  prisma: Pick<typeof prisma, 'document' | 'trip' | 'alertSentLog'>
  enqueueAlert: (data: SendAlertJobData) => Promise<void>
  now: () => Date
}

export interface SendAlertDeps {
  prisma: Pick<typeof prisma, 'userPreferences' | 'alertSentLog'>
  resend: { emails: { send: (args: { from: string; to: string; subject: string; html: string }) => Promise<unknown> } }
  appUrl: string
  now: () => Date
}

const defaultExpiryCheckDeps: ExpiryCheckDeps = {
  prisma,
  enqueueAlert: (data) => sendAlertQueue.add('send-alert', data).then(() => undefined),
  now: () => new Date(),
}

const defaultSendAlertDeps: SendAlertDeps = {
  prisma,
  resend,
  appUrl: env.NEXT_PUBLIC_APP_URL,
  now: () => new Date(),
}

// ── Deduplication helper ──────────────────────────────────────────────────────

function startOfDayUTC(d: Date): Date {
  const result = new Date(d)
  result.setUTCHours(0, 0, 0, 0)
  return result
}

async function hasAlertBeenSentToday(
  entityId: string,
  alertType: AlertType,
  now: Date,
  db: Pick<typeof prisma, 'alertSentLog'>
): Promise<boolean> {
  const todayStart = startOfDayUTC(now)
  const entry = await db.alertSentLog.findFirst({
    where: { entityId, alertType, sentAt: { gte: todayStart } },
    select: { id: true },
  })
  return entry !== null
}

// ── Scheduler: queries DB and enqueues individual send-alert jobs ─────────────

export async function runExpiryCheck(deps: ExpiryCheckDeps = defaultExpiryCheckDeps): Promise<void> {
  const now = deps.now()

  // 1. Passports expiring within 12 months
  const passportCutoff = new Date(now)
  passportCutoff.setDate(passportCutoff.getDate() + PASSPORT_WARNING_DAYS)

  const expiringPassports = await deps.prisma.document.findMany({
    where: { type: 'PASSPORT', expiryDate: { gt: now, lte: passportCutoff } },
    select: { id: true, name: true, expiryDate: true, userId: true, user: { select: { email: true } } },
  })

  for (const doc of expiringPassports) {
    if (!doc.expiryDate) continue
    if (await hasAlertBeenSentToday(doc.id, 'PASSPORT_EXPIRY', now, deps.prisma)) continue
    await deps.enqueueAlert({
      alertType: 'PASSPORT_EXPIRY',
      userId: doc.userId,
      entityId: doc.id,
      recipientEmail: doc.user.email,
      documentName: doc.name,
      expiryDate: doc.expiryDate.toISOString(),
    })
    logger.info({ documentId: doc.id, userId: doc.userId }, 'Enqueued PASSPORT_EXPIRY alert')
  }

  // 2. Visas expiring within 30 days
  const visaCutoff = new Date(now)
  visaCutoff.setDate(visaCutoff.getDate() + VISA_WARNING_DAYS)

  const expiringVisas = await deps.prisma.document.findMany({
    where: { type: 'VISA', expiryDate: { gt: now, lte: visaCutoff } },
    select: { id: true, name: true, expiryDate: true, userId: true, user: { select: { email: true } } },
  })

  for (const visa of expiringVisas) {
    if (!visa.expiryDate) continue
    if (await hasAlertBeenSentToday(visa.id, 'VISA_EXPIRY', now, deps.prisma)) continue
    await deps.enqueueAlert({
      alertType: 'VISA_EXPIRY',
      userId: visa.userId,
      entityId: visa.id,
      recipientEmail: visa.user.email,
      documentName: visa.name,
      expiryDate: visa.expiryDate.toISOString(),
    })
    logger.info({ documentId: visa.id, userId: visa.userId }, 'Enqueued VISA_EXPIRY alert')
  }

  // 3. Trips departing within 7 days — insurance + health checks
  const tripCutoff = new Date(now)
  tripCutoff.setDate(tripCutoff.getDate() + TRIP_WARNING_DAYS)

  const approachingTrips = await deps.prisma.trip.findMany({
    where: { departureDate: { gt: now, lte: tripCutoff } },
    select: {
      id: true,
      name: true,
      userId: true,
      departureDate: true,
      returnDate: true,
      user: { select: { email: true } },
      documents: {
        where: { type: 'TRAVEL_INSURANCE' },
        select: { expiryDate: true },
      },
      checklist: { select: { required: true, status: true, label: true } },
    },
  })

  for (const trip of approachingTrips) {
    // Pick the best (latest) insurance expiry across linked insurance docs
    const bestInsuranceExpiry = trip.documents.reduce<Date | null>((best, doc) => {
      if (!doc.expiryDate) return best
      if (!best) return doc.expiryDate
      return doc.expiryDate > best ? doc.expiryDate : best
    }, null)

    // Insurance coverage check
    if (isInsuranceInsufficient(trip.departureDate, trip.returnDate, bestInsuranceExpiry, now)) {
      if (!(await hasAlertBeenSentToday(trip.id, 'INSURANCE_COVERAGE', now, deps.prisma))) {
        await deps.enqueueAlert({
          alertType: 'INSURANCE_COVERAGE',
          userId: trip.userId,
          entityId: trip.id,
          recipientEmail: trip.user.email,
          tripName: trip.name,
          tripId: trip.id,
          departureDate: trip.departureDate.toISOString(),
        })
        logger.info({ tripId: trip.id, userId: trip.userId }, 'Enqueued INSURANCE_COVERAGE alert')
      }
    }

    // Trip health check
    const healthScore = computeHealthScore(trip.checklist)
    if (isTripHealthLow(trip.departureDate, healthScore.percent, now)) {
      if (!(await hasAlertBeenSentToday(trip.id, 'TRIP_HEALTH', now, deps.prisma))) {
        const missingItems = trip.checklist
          .filter((i) => i.required === 'REQUIRED' && i.status === 'PENDING')
          .map((i) => i.label)
        await deps.enqueueAlert({
          alertType: 'TRIP_HEALTH',
          userId: trip.userId,
          entityId: trip.id,
          recipientEmail: trip.user.email,
          tripName: trip.name,
          tripId: trip.id,
          departureDate: trip.departureDate.toISOString(),
          healthPercent: healthScore.percent ?? 0,
          missingItems,
        })
        logger.info({ tripId: trip.id, userId: trip.userId }, 'Enqueued TRIP_HEALTH alert')
      }
    }
  }

  logger.info({ checkedAt: now.toISOString() }, 'Expiry check run complete')
}

// ── Sender: checks preferences, sends email, records the send ────────────────

export async function sendAlert(
  data: SendAlertJobData,
  deps: SendAlertDeps = defaultSendAlertDeps
): Promise<void> {
  const { alertType, userId, entityId, recipientEmail } = data

  // Resolve user preferences (default to all-enabled if no row exists yet)
  const prefs = await deps.prisma.userPreferences.findUnique({
    where: { userId },
    select: { alertPassport: true, alertVisa: true, alertInsurance: true, alertTripHealth: true },
  })

  const alertEnabled: boolean = (() => {
    if (!prefs) return true
    switch (alertType) {
      case 'PASSPORT_EXPIRY': return prefs.alertPassport
      case 'VISA_EXPIRY': return prefs.alertVisa
      case 'INSURANCE_COVERAGE': return prefs.alertInsurance
      case 'TRIP_HEALTH': return prefs.alertTripHealth
    }
  })()

  if (!alertEnabled) {
    logger.info({ alertType, userId }, 'Alert skipped — user opted out')
    return
  }

  const appUrl = deps.appUrl
  let subject: string
  let html: string

  switch (data.alertType) {
    case 'PASSPORT_EXPIRY': {
      const expiryDate = new Date(data.expiryDate)
      subject = `Action needed: passport expiring ${expiryDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`
      html = passportExpiryEmailHtml({ documentName: data.documentName, expiryDate, appUrl })
      break
    }
    case 'VISA_EXPIRY': {
      const expiryDate = new Date(data.expiryDate)
      subject = `Visa expiring soon — ${data.documentName}`
      html = visaExpiryEmailHtml({ documentName: data.documentName, expiryDate, appUrl })
      break
    }
    case 'INSURANCE_COVERAGE': {
      const departureDate = new Date(data.departureDate)
      subject = `Insurance coverage check needed — ${data.tripName}`
      html = insuranceCoverageEmailHtml({ tripName: data.tripName, tripId: data.tripId, departureDate, appUrl })
      break
    }
    case 'TRIP_HEALTH': {
      const departureDate = new Date(data.departureDate)
      subject = `${data.tripName} departs soon — checklist is ${data.healthPercent}% complete`
      html = tripHealthEmailHtml({
        tripName: data.tripName,
        tripId: data.tripId,
        departureDate,
        healthPercent: data.healthPercent,
        missingItems: data.missingItems,
        appUrl,
      })
      break
    }
  }

  try {
    await deps.resend.emails.send({ from: ALERT_FROM, to: recipientEmail, subject, html })
  } catch (err) {
    logger.error({ err, alertType, userId, entityId }, 'Resend email send failed')
    throw err
  }

  await deps.prisma.alertSentLog.create({ data: { userId, entityId, alertType } })
  logger.info({ alertType, userId, entityId }, 'Alert email sent and logged')
}
