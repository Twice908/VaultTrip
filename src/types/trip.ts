import type { TripType, ChecklistStatus, RequiredLevel } from '@prisma/client'
import type { DocumentDTO } from './document'

export interface ChecklistItemDTO {
  id: string
  tripId: string
  label: string
  description: string | null
  required: RequiredLevel
  status: ChecklistStatus
  documentId: string | null
  createdAt: string
}

export interface TripHealthScore {
  fulfilled: number
  total: number
  percent: number | null
}

export interface TripDTO {
  id: string
  name: string
  origin: string
  destination: string
  departureDate: string
  returnDate: string | null
  tripType: TripType
  shareToken: string | null
  createdAt: string
  documentCount: number
  checklistCounts: {
    fulfilled: number
    pending: number
    flagged: number
    notApplicable: number
  }
  healthScore: TripHealthScore
}

export interface TripDetailDTO extends TripDTO {
  documents: DocumentDTO[]
  checklist: ChecklistItemDTO[]
}

/**
 * Computes the trip health score: fulfilled REQUIRED items / total REQUIRED items.
 * Returns percent: null when no required items exist.
 */
export function computeHealthScore(
  items: { required: RequiredLevel; status: ChecklistStatus }[]
): TripHealthScore {
  const requiredItems = items.filter((i) => i.required === 'REQUIRED')
  const total = requiredItems.length
  if (total === 0) return { fulfilled: 0, total: 0, percent: null }
  const fulfilled = requiredItems.filter((i) => i.status === 'FULFILLED').length
  const percent = Math.round((fulfilled / total) * 100)
  return { fulfilled, total, percent }
}
