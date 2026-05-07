export type DesignationId =
  | 'PRESIDENT'
  | 'VICE_PRESIDENT'
  | 'GENERAL_SECRETARY'
  | 'TREASURER'
  | 'DIRECTOR'
  | 'ASSISTANT_DIRECTOR'
  | 'SECRETARY'
  | 'SENIOR_EXECUTIVE'
  | 'EXECUTIVE'
  | 'GENERAL_MEMBER'

export type DepartmentId =
  | 'EVENT_MANAGEMENT'
  | 'HR'
  | 'LOGISTICS'
  | 'MEDIA_AND_CREATIVE'
  | 'FIELD_AND_OPERATIONS'
  | 'MARKETING_AND_PR'

export type Designation = {
  id: DesignationId
  label: string
  rank: number
  isPanel: boolean
}

/** Highest rank first. `rank` is used for sorting. */
export const DESIGNATIONS: Designation[] = [
  { id: 'PRESIDENT', label: 'President', rank: 100, isPanel: true },
  { id: 'VICE_PRESIDENT', label: 'Vice-President', rank: 90, isPanel: true },
  { id: 'GENERAL_SECRETARY', label: 'General Secretary', rank: 80, isPanel: true },
  { id: 'TREASURER', label: 'Treasurer', rank: 70, isPanel: true },
  { id: 'DIRECTOR', label: 'Director', rank: 60, isPanel: false },
  { id: 'ASSISTANT_DIRECTOR', label: 'Assistant Director', rank: 55, isPanel: false },
  { id: 'SECRETARY', label: 'Secretary', rank: 50, isPanel: false },
  { id: 'SENIOR_EXECUTIVE', label: 'Senior Executive', rank: 40, isPanel: false },
  { id: 'EXECUTIVE', label: 'Executive', rank: 30, isPanel: false },
  { id: 'GENERAL_MEMBER', label: 'General Member', rank: 10, isPanel: false },
]

export const DEPARTMENTS: { id: DepartmentId; label: string }[] = [
  { id: 'EVENT_MANAGEMENT', label: 'Event Management' },
  { id: 'HR', label: 'HR' },
  { id: 'LOGISTICS', label: 'Logistics' },
  { id: 'MEDIA_AND_CREATIVE', label: 'Media & Creative' },
  { id: 'FIELD_AND_OPERATIONS', label: 'Field & Operations' },
  { id: 'MARKETING_AND_PR', label: 'Marketing & PR' },
]

export function designationLabel(id: DesignationId): string {
  return DESIGNATIONS.find((d) => d.id === id)?.label ?? id
}

export function designationRank(id: DesignationId): number {
  return DESIGNATIONS.find((d) => d.id === id)?.rank ?? 0
}

export function isPanelDesignation(id: DesignationId): boolean {
  return DESIGNATIONS.find((d) => d.id === id)?.isPanel ?? false
}

export function departmentLabel(id: DepartmentId): string {
  return DEPARTMENTS.find((d) => d.id === id)?.label ?? id
}

export type ClubMemberRecord = {
  uid: string
  designation: DesignationId
  department: DepartmentId
  joinedAt: number
  addedByAdminUid: string
  /** Cached on write so list views are fast and don't fan out reads. */
  playerName: string
  playerEmail: string
}
