export type ComplaintStatus = 'OPEN' | 'IN_REVIEW' | 'RESOLVED' | 'REJECTED'

export type ComplaintCategory =
  | 'GENERAL'
  | 'TOURNAMENT'
  | 'TEAM'
  | 'FIELD_BOOKING'
  | 'PLAYER_CONDUCT'
  | 'OTHER'

export const COMPLAINT_CATEGORIES: { id: ComplaintCategory; label: string }[] = [
  { id: 'GENERAL', label: 'General' },
  { id: 'TOURNAMENT', label: 'Tournament' },
  { id: 'TEAM', label: 'Team' },
  { id: 'FIELD_BOOKING', label: 'Field Booking' },
  { id: 'PLAYER_CONDUCT', label: 'Player Conduct' },
  { id: 'OTHER', label: 'Other' },
]

export const COMPLAINT_STATUSES: { id: ComplaintStatus; label: string }[] = [
  { id: 'OPEN', label: 'Open' },
  { id: 'IN_REVIEW', label: 'In Review' },
  { id: 'RESOLVED', label: 'Resolved' },
  { id: 'REJECTED', label: 'Rejected' },
]

export type ComplaintSubmitInput = {
  subject: string
  description: string
  category: ComplaintCategory
  isAnonymous: boolean
  /** Provided when isAnonymous = false */
  submitterUid?: string
  submitterName?: string
  submitterEmail?: string
}

export type ComplaintRecord = {
  id: string
  subject: string
  description: string
  category: ComplaintCategory
  status: ComplaintStatus
  isAnonymous: boolean
  submitterUid?: string
  submitterName?: string
  submitterEmail?: string
  createdAt: number
  updatedAt: number
  /** Note from admin when status changes (e.g. resolution explanation). */
  resolutionNote?: string
  /** Admin uid that last updated the status. */
  updatedByAdminUid?: string
}
