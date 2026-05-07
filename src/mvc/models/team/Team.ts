export type TeamInvitationStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED'

export type TeamInvitationRecord = {
  id: string
  tournamentId: string
  teamId: string
  teamName: string
  fromManagerUid: string
  toPlayerUid: string
  toPlayerEmail: string
  status: TeamInvitationStatus
  createdAt: number
}

export type PlayerTeamMembership = {
  teamId: string
  tournamentId: string
  role: 'MANAGER' | 'MEMBER'
}

