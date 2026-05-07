import { get, push, ref, set } from 'firebase/database'
import { db } from './firebase'
import type { TeamRecord } from '../tournament/Tournament'
import type {
  PlayerTeamMembership,
  TeamInvitationRecord,
  TeamInvitationStatus,
} from '../team/Team'

function teamRef(tournamentId: string, teamId: string) {
  return ref(db, `/tournaments/${tournamentId}/teams/${teamId}`)
}

function teamsRootRef(tournamentId: string) {
  return ref(db, `/tournaments/${tournamentId}/teams`)
}

function invitationsRootRef() {
  return ref(db, '/teamInvitations')
}

function playerMembershipRef(uid: string) {
  return ref(db, `/playerTeamMemberships/${uid}`)
}

export async function createTeamInTournamentInDb(params: {
  tournamentId: string
  teamName: string
  managerUid: string
}): Promise<TeamRecord> {
  const newRef = push(teamsRootRef(params.tournamentId))
  const id = newRef.key
  if (!id) throw new Error('Failed to create team id')

  const team: TeamRecord = {
    id,
    teamName: params.teamName.trim(),
    managerUid: params.managerUid,
    memberUids: [params.managerUid],
    addedAt: Date.now(),
  }
  await set(newRef, team)
  return team
}

export async function getTeamFromTournamentInDb(params: {
  tournamentId: string
  teamId: string
}): Promise<TeamRecord | null> {
  const snapshot = await get(teamRef(params.tournamentId, params.teamId))
  return snapshot.val() as TeamRecord | null
}

export async function setTeamInTournamentInDb(params: {
  tournamentId: string
  team: TeamRecord
}): Promise<void> {
  await set(teamRef(params.tournamentId, params.team.id), params.team)
}

export async function deleteTeamFromTournamentInDb(params: {
  tournamentId: string
  teamId: string
}): Promise<void> {
  await set(teamRef(params.tournamentId, params.teamId), null)
}

export async function getPlayerMembershipFromDb(
  uid: string,
): Promise<PlayerTeamMembership | null> {
  const snapshot = await get(playerMembershipRef(uid))
  return snapshot.val() as PlayerTeamMembership | null
}

export async function setPlayerMembershipInDb(params: {
  uid: string
  membership: PlayerTeamMembership | null
}): Promise<void> {
  await set(playerMembershipRef(params.uid), params.membership)
}

export async function createInvitationInDb(params: {
  tournamentId: string
  teamId: string
  teamName: string
  fromManagerUid: string
  toPlayerUid: string
  toPlayerEmail: string
}): Promise<TeamInvitationRecord> {
  const newRef = push(invitationsRootRef())
  const id = newRef.key
  if (!id) throw new Error('Failed to create invitation id')

  const invitation: TeamInvitationRecord = {
    id,
    tournamentId: params.tournamentId,
    teamId: params.teamId,
    teamName: params.teamName,
    fromManagerUid: params.fromManagerUid,
    toPlayerUid: params.toPlayerUid,
    toPlayerEmail: params.toPlayerEmail,
    status: 'PENDING',
    createdAt: Date.now(),
  }
  await set(newRef, invitation)
  return invitation
}

export async function getInvitationsForPlayerFromDb(
  toPlayerUid: string,
): Promise<TeamInvitationRecord[]> {
  const snapshot = await get(invitationsRootRef())
  const value = snapshot.val() as Record<string, TeamInvitationRecord> | null
  if (!value) return []

  return Object.values(value).filter(
    (inv) => inv.toPlayerUid === toPlayerUid && inv.status === 'PENDING',
  )
}

export async function getInvitationByIdFromDb(
  invitationId: string,
): Promise<TeamInvitationRecord | null> {
  const snapshot = await get(ref(db, `/teamInvitations/${invitationId}`))
  return snapshot.val() as TeamInvitationRecord | null
}

export async function updateInvitationStatusInDb(params: {
  invitationId: string
  status: TeamInvitationStatus
}): Promise<void> {
  const invitation = await getInvitationByIdFromDb(params.invitationId)
  if (!invitation) return

  await set(ref(db, `/teamInvitations/${params.invitationId}`), {
    ...invitation,
    status: params.status,
  })
}

