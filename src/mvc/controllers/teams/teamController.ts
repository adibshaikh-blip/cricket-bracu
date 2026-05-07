import { getAllPlayersFromDb, getPlayerProfileFromDb } from '../../models/firebase/playerRepository'
import { getUserRoleFromDb } from '../../models/firebase/roleRepository'
import {
  createInvitationInDb,
  createTeamInTournamentInDb,
  deleteTeamFromTournamentInDb,
  getInvitationByIdFromDb,
  getInvitationsForPlayerFromDb,
  getPlayerMembershipFromDb,
  getTeamFromTournamentInDb,
  setPlayerMembershipInDb,
  setTeamInTournamentInDb,
  updateInvitationStatusInDb,
} from '../../models/firebase/teamRepository'
import {
  getAllTournamentsFromDb,
  getTournamentByIdFromDb,
} from '../../models/firebase/tournamentRepository'
import type { TeamRecord, TournamentRecord } from '../../models/tournament/Tournament'
import type { PlayerSearchRecord } from '../../models/firebase/playerRepository'
import type { PlayerTeamMembership, TeamInvitationRecord } from '../../models/team/Team'

export async function getJoinableTournaments(): Promise<TournamentRecord[]> {
  const all = await getAllTournamentsFromDb()
  return all.filter((t) => t.status === 'UPCOMING')
}

export async function createTeamForTournament(params: {
  tournamentId: string
  managerUid: string
  teamName: string
}): Promise<TeamRecord> {
  if (!params.teamName.trim()) throw new Error('Team name is required.')

  const [tournament, existingMembership] = await Promise.all([
    getTournamentByIdFromDb(params.tournamentId),
    getPlayerMembershipFromDb(params.managerUid),
  ])
  if (!tournament) throw new Error('Tournament not found.')
  if (tournament.status !== 'UPCOMING') {
    throw new Error('Tournament has already started.')
  }
  if (existingMembership) {
    throw new Error('You are already in a team. Leave your current team first.')
  }

  const teams = normalizeTeams(tournament)
  if (teams.length >= tournament.maxTeams) {
    throw new Error('Tournament team limit reached.')
  }

  const duplicate = teams.some(
    (team) => team.teamName.toLowerCase() === params.teamName.trim().toLowerCase(),
  )
  if (duplicate) throw new Error('A team with this name already exists.')

  const team = await createTeamInTournamentInDb({
    tournamentId: params.tournamentId,
    managerUid: params.managerUid,
    teamName: params.teamName,
  })

  await setPlayerMembershipInDb({
    uid: params.managerUid,
    membership: {
      teamId: team.id,
      tournamentId: params.tournamentId,
      role: 'MANAGER',
    },
  })
  return team
}

export async function getMyMembership(uid: string): Promise<PlayerTeamMembership | null> {
  return getPlayerMembershipFromDb(uid)
}

export async function getTeamManagementData(params: {
  tournamentId: string
  teamId: string
}): Promise<{
  tournament: TournamentRecord
  team: TeamRecord
  memberProfiles: Array<{ uid: string; name: string; email: string }>
}> {
  const [tournament, team] = await Promise.all([
    getTournamentByIdFromDb(params.tournamentId),
    getTeamFromTournamentInDb(params),
  ])
  if (!tournament) throw new Error('Tournament not found.')
  if (!team) throw new Error('Team not found.')

  const memberUids = team.memberUids ?? []
  const profiles = await Promise.all(
    memberUids.map(async (uid) => {
      const p = await getPlayerProfileFromDb(uid)
      return {
        uid,
        name: p?.name ?? 'Unknown',
        email: p?.email ?? 'Unknown',
      }
    }),
  )

  return { tournament, team, memberProfiles: profiles }
}

export async function searchPlayersForInvite(params: {
  query: string
  teamMemberUids: string[]
}): Promise<PlayerSearchRecord[]> {
  const q = params.query.trim().toLowerCase()
  if (!q) return []
  const all = await getAllPlayersFromDb()
  const candidates = all
    .filter((p) => !params.teamMemberUids.includes(p.uid))
    .filter((p) => p.name.toLowerCase().includes(q) || p.email.toLowerCase().includes(q))
    .slice(0, 10)

  const roleChecks = await Promise.all(
    candidates.map(async (p) => ({
      player: p,
      role: await getUserRoleFromDb(p.uid),
    })),
  )

  return roleChecks
    .filter((entry) => entry.role === 'player')
    .map((entry) => entry.player)
}

export async function invitePlayerToTeam(params: {
  managerUid: string
  tournamentId: string
  teamId: string
  targetPlayerUid: string
}): Promise<void> {
  const [team, tournament, targetMembership, targetProfile, targetRole] = await Promise.all([
    getTeamFromTournamentInDb({ tournamentId: params.tournamentId, teamId: params.teamId }),
    getTournamentByIdFromDb(params.tournamentId),
    getPlayerMembershipFromDb(params.targetPlayerUid),
    getPlayerProfileFromDb(params.targetPlayerUid),
    getUserRoleFromDb(params.targetPlayerUid),
  ])
  if (!team || !tournament) throw new Error('Team or tournament not found.')
  if (team.managerUid !== params.managerUid) throw new Error('Only manager can invite players.')
  if (tournament.status !== 'UPCOMING') {
    throw new Error('Invitations are disabled after tournament starts.')
  }
  if (targetMembership) throw new Error('Player is already in a team.')
  if ((team.memberUids ?? []).includes(params.targetPlayerUid)) {
    throw new Error('Player is already in this team.')
  }
  if (targetRole !== 'player') {
    throw new Error('Only players can be invited to a team.')
  }
  if (!targetProfile) throw new Error('Player profile not found.')

  await createInvitationInDb({
    tournamentId: params.tournamentId,
    teamId: params.teamId,
    teamName: team.teamName,
    fromManagerUid: params.managerUid,
    toPlayerUid: params.targetPlayerUid,
    toPlayerEmail: targetProfile.email,
  })
}

export async function getMyPendingInvitations(
  uid: string,
): Promise<TeamInvitationRecord[]> {
  return getInvitationsForPlayerFromDb(uid)
}

export async function acceptInvitation(params: {
  invitationId: string
  playerUid: string
}): Promise<void> {
  const invitation = await getInvitationByIdFromDb(params.invitationId)
  if (!invitation || invitation.toPlayerUid !== params.playerUid) {
    throw new Error('Invitation not found.')
  }
  if (invitation.status !== 'PENDING') throw new Error('Invitation already handled.')

  const [membership, tournament, team] = await Promise.all([
    getPlayerMembershipFromDb(params.playerUid),
    getTournamentByIdFromDb(invitation.tournamentId),
    getTeamFromTournamentInDb({
      tournamentId: invitation.tournamentId,
      teamId: invitation.teamId,
    }),
  ])
  if (membership) throw new Error('You are already in a team.')
  if (!tournament || tournament.status !== 'UPCOMING') {
    throw new Error('Tournament is not joinable now.')
  }
  if (!team) throw new Error('Team no longer exists.')

  const memberUids = Array.from(new Set([...(team.memberUids ?? []), params.playerUid]))
  await setTeamInTournamentInDb({
    tournamentId: invitation.tournamentId,
    team: { ...team, memberUids },
  })
  await setPlayerMembershipInDb({
    uid: params.playerUid,
    membership: {
      teamId: invitation.teamId,
      tournamentId: invitation.tournamentId,
      role: 'MEMBER',
    },
  })
  await updateInvitationStatusInDb({
    invitationId: invitation.id,
    status: 'ACCEPTED',
  })
}

export async function rejectInvitation(params: {
  invitationId: string
  playerUid: string
}): Promise<void> {
  const invitation = await getInvitationByIdFromDb(params.invitationId)
  if (!invitation || invitation.toPlayerUid !== params.playerUid) {
    throw new Error('Invitation not found.')
  }
  await updateInvitationStatusInDb({
    invitationId: invitation.id,
    status: 'REJECTED',
  })
}

export async function kickMemberFromTeam(params: {
  managerUid: string
  tournamentId: string
  teamId: string
  targetUid: string
}): Promise<void> {
  const [team, tournament] = await Promise.all([
    getTeamFromTournamentInDb({ tournamentId: params.tournamentId, teamId: params.teamId }),
    getTournamentByIdFromDb(params.tournamentId),
  ])
  if (!team || !tournament) throw new Error('Team or tournament not found.')
  if (team.managerUid !== params.managerUid) throw new Error('Only manager can kick members.')
  if (tournament.status !== 'UPCOMING') throw new Error('Cannot kick members after start.')
  if (params.targetUid === params.managerUid) throw new Error('Manager cannot self-kick.')

  const memberUids = (team.memberUids ?? []).filter((uid) => uid !== params.targetUid)
  await setTeamInTournamentInDb({ tournamentId: params.tournamentId, team: { ...team, memberUids } })
  await setPlayerMembershipInDb({ uid: params.targetUid, membership: null })
}

export async function leaveTeam(params: {
  uid: string
  tournamentId: string
  teamId: string
}): Promise<void> {
  const [team, membership, tournament] = await Promise.all([
    getTeamFromTournamentInDb({ tournamentId: params.tournamentId, teamId: params.teamId }),
    getPlayerMembershipFromDb(params.uid),
    getTournamentByIdFromDb(params.tournamentId),
  ])
  if (!team || !membership || !tournament) throw new Error('Unable to leave team.')
  if (membership.teamId !== params.teamId) throw new Error('You are not in this team.')
  if (membership.role === 'MANAGER') throw new Error('Manager cannot leave. Disband team instead.')
  if (tournament.status !== 'UPCOMING') throw new Error('Cannot leave after tournament starts.')

  const memberUids = (team.memberUids ?? []).filter((uid) => uid !== params.uid)
  await setTeamInTournamentInDb({ tournamentId: params.tournamentId, team: { ...team, memberUids } })
  await setPlayerMembershipInDb({ uid: params.uid, membership: null })
}

export async function disbandTeam(params: {
  managerUid: string
  tournamentId: string
  teamId: string
}): Promise<void> {
  const [team, tournament] = await Promise.all([
    getTeamFromTournamentInDb({ tournamentId: params.tournamentId, teamId: params.teamId }),
    getTournamentByIdFromDb(params.tournamentId),
  ])
  if (!team || !tournament) throw new Error('Team or tournament not found.')
  if (team.managerUid !== params.managerUid) throw new Error('Only manager can disband team.')
  if (tournament.status !== 'UPCOMING') throw new Error('Cannot disband team after tournament starts.')

  const members = team.memberUids ?? []
  await Promise.all(
    members.map((uid) => setPlayerMembershipInDb({ uid, membership: null })),
  )
  await deleteTeamFromTournamentInDb({ tournamentId: params.tournamentId, teamId: params.teamId })
}

function normalizeTeams(tournament: TournamentRecord): TeamRecord[] {
  const teams = tournament.teams
  if (!teams) return []
  if (Array.isArray(teams)) return teams.filter(Boolean)
  return Object.values(teams as unknown as Record<string, TeamRecord>)
}

