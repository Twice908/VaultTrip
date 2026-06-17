import { Resend } from 'resend'
import { env } from '@/env'

export const resend = new Resend(env.RESEND_API_KEY)

export const ALERT_FROM = 'VaultTrip Alerts <alerts@vaulttrip.app>'

function fmtDate(d: Date): string {
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}

function footer(appUrl: string): string {
  return `<hr style="margin:24px 0;border:none;border-top:1px solid #e5e7eb">
<p style="margin:0;color:#9ca3af;font-size:12px">Manage alert preferences in your <a href="${appUrl}/profile" style="color:#3B7FEB">VaultTrip profile</a>.</p>`
}

export function passportExpiryEmailHtml(p: {
  documentName: string
  expiryDate: Date
  appUrl: string
}): string {
  return `<!DOCTYPE html><html><body style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#111">
<h2 style="margin:0 0 8px">Passport expiring soon</h2>
<p style="margin:0 0 16px;color:#555"><strong>${p.documentName}</strong> expires on <strong>${fmtDate(p.expiryDate)}</strong>, within the next 12 months.</p>
<p style="margin:0 0 20px;color:#555">Many countries require your passport to be valid for at least 6 months beyond your travel dates. Renew early to avoid disruption.</p>
<a href="${p.appUrl}/vault" style="display:inline-block;background:#3B7FEB;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:600">View document in VaultTrip →</a>
${footer(p.appUrl)}
</body></html>`
}

export function visaExpiryEmailHtml(p: {
  documentName: string
  expiryDate: Date
  appUrl: string
}): string {
  return `<!DOCTYPE html><html><body style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#111">
<h2 style="margin:0 0 8px">Visa expiring in 30 days</h2>
<p style="margin:0 0 16px;color:#555"><strong>${p.documentName}</strong> expires on <strong>${fmtDate(p.expiryDate)}</strong>.</p>
<p style="margin:0 0 20px;color:#555">Ensure you have renewed or obtained a replacement visa before your next trip.</p>
<a href="${p.appUrl}/vault" style="display:inline-block;background:#3B7FEB;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:600">View document in VaultTrip →</a>
${footer(p.appUrl)}
</body></html>`
}

export function insuranceCoverageEmailHtml(p: {
  tripName: string
  tripId: string
  departureDate: Date
  appUrl: string
}): string {
  return `<!DOCTYPE html><html><body style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#111">
<h2 style="margin:0 0 8px">Travel insurance may not cover your trip</h2>
<p style="margin:0 0 16px;color:#555">Your trip <strong>${p.tripName}</strong> departs on <strong>${fmtDate(p.departureDate)}</strong>, but your travel insurance doesn't appear to cover the full duration.</p>
<p style="margin:0 0 20px;color:#555">Upload a valid policy that covers your entire trip, or contact your insurer to extend coverage.</p>
<a href="${p.appUrl}/trips/${p.tripId}" style="display:inline-block;background:#3B7FEB;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:600">View trip →</a>
${footer(p.appUrl)}
</body></html>`
}

export function tripHealthEmailHtml(p: {
  tripName: string
  tripId: string
  departureDate: Date
  healthPercent: number
  missingItems: string[]
  appUrl: string
}): string {
  const missingList =
    p.missingItems.length > 0
      ? `<p style="margin:8px 0 4px;color:#555;font-weight:600">Missing required documents:</p>
<ul style="margin:0 0 20px;padding-left:20px;color:#555">${p.missingItems.map((i) => `<li>${i}</li>`).join('')}</ul>`
      : '<p style="margin:0 0 20px;color:#555">Review your checklist for any outstanding items.</p>'

  return `<!DOCTYPE html><html><body style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#111">
<h2 style="margin:0 0 8px">Trip checklist is ${p.healthPercent}% complete</h2>
<p style="margin:0 0 16px;color:#555">Your trip <strong>${p.tripName}</strong> departs on <strong>${fmtDate(p.departureDate)}</strong> and still needs attention.</p>
${missingList}
<a href="${p.appUrl}/trips/${p.tripId}" style="display:inline-block;background:#3B7FEB;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:600">Complete your checklist →</a>
${footer(p.appUrl)}
</body></html>`
}
