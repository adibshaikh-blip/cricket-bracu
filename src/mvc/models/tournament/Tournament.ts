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
  /** Number of overs each innings of every match in this tournament will be played for. */
  oversPerMatch: number
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
  /** Set when match is finalised. Persisted on the tournament tree for quick listing. */
  result?: MatchResult
  /** Optional pointer to the live scoring record (kept for cross-referencing). */
  liveMatchId?: string
}

export type MatchResult = {
  winnerTeamId: string | null // null for tie or discarded
  winnerLabel: string
  margin: 'runs' | 'wickets' | 'tie' | 'discarded'
  marginValue: number
  innings1Summary?: { teamId: string; runs: number; wickets: number; oversText: string }
  innings2Summary?: { teamId: string; runs: number; wickets: number; oversText: string }
  manOfTheMatchUid?: string
  manOfTheMatchName?: string
  finalisedAt: number
}

