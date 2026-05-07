export type TournamentTypeCode = 1 | 2

export const TournamentType = {
  GROUP_QUARTER_SEMI_FINAL_FINAL: 1 as const,
  GROUP_SEMI_FINAL_FINAL: 2 as const,
} satisfies Record<string, TournamentTypeCode>

export function tournamentTypeLabel(type: TournamentTypeCode): string {
  switch (type) {
    case 1:
      return 'Group Stage > Quarter final > Semi final > final'
    case 2:
      return 'Group Stage > Semi final > final'
    default: {
      // Exhaustiveness check
      const _exhaustive: never = type
      return _exhaustive
    }
  }
}

export type TournamentStatus = 'UPCOMING' | 'ONGOING' | 'COMPLETED'

export type TournamentCreateInput = {
  tournamentName: string
  startDate: string // YYYY-MM-DD
  endDate: string // YYYY-MM-DD
  numberOfGroups: number
  maxTeams: number
  tournamentType: TournamentTypeCode
}

export type TournamentRecord = TournamentCreateInput & {
  id: string
  createdByUid: string
  createdAt: number
  status: TournamentStatus
  startedAt?: number
  teams?: TeamRecord[]
  groups?: GroupRecord[]
  matches?: MatchRecord[]
}

export type TeamRecord = {
  id: string
  teamName: string
  addedAt: number
  managerUid?: string
  memberUids?: string[]
}

export type GroupRecord = {
  id: string
  groupName: string
  teamIds: string[]
}

export type MatchStage = 'GROUP' | 'QUARTER_FINAL' | 'SEMI_FINAL' | 'FINAL'

export type MatchStatus = 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED'

export type MatchParticipantRef =
  | { kind: 'team'; teamId: string; label: string }
  | { kind: 'slot'; label: string }

export type MatchRecord = {
  id: string
  stage: MatchStage
  status: MatchStatus
  groupId?: string
  sequence: number
  home: MatchParticipantRef
  away: MatchParticipantRef
  scheduledAt?: number
}

