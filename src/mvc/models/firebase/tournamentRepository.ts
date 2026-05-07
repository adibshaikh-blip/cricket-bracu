import { get, push, ref, set, update } from 'firebase/database'
import { db } from './firebase'
import type {
  GroupRecord,
  MatchRecord,
  TeamRecord,
  TournamentCreateInput,
  TournamentRecord,
  TournamentStatus,
} from '../tournament/Tournament'

function tournamentsRootRef() {
  return ref(db, '/tournaments')
}

export async function createTournamentInDb(params: {
  createdByUid: string
  input: TournamentCreateInput
  status?: TournamentStatus
}): Promise<string> {
  const newTournamentRef = push(tournamentsRootRef())
  const id = newTournamentRef.key
  if (!id) throw new Error('Failed to create tournament id')

  const status: TournamentStatus = params.status ?? 'UPCOMING'
  const record: TournamentRecord = {
    ...params.input,
    id,
    createdByUid: params.createdByUid,
    createdAt: Date.now(),
    status,
  }

  await set(newTournamentRef, record)
  return id
}

function tournamentRef(tournamentId: string) {
  return ref(db, `/tournaments/${tournamentId}`)
}

function teamsRef(tournamentId: string) {
  return ref(db, `/tournaments/${tournamentId}/teams`)
}

export async function getTournamentByIdFromDb(
  tournamentId: string,
): Promise<TournamentRecord | null> {
  const snapshot = await get(tournamentRef(tournamentId))
  return snapshot.val() as TournamentRecord | null
}

export async function getAllTournamentsFromDb(): Promise<TournamentRecord[]> {
  const snapshot = await get(tournamentsRootRef())
  const value = snapshot.val() as Record<string, TournamentRecord> | null
  if (!value) return []
  return Object.values(value)
}

export async function addTeamToTournamentInDb(params: {
  tournamentId: string
  teamName: string
}): Promise<TeamRecord> {
  const newTeamRef = push(teamsRef(params.tournamentId))
  const id = newTeamRef.key
  if (!id) throw new Error('Failed to create team id')

  const team: TeamRecord = {
    id,
    teamName: params.teamName.trim(),
    addedAt: Date.now(),
  }

  await set(newTeamRef, team)
  return team
}

export async function removeTeamFromTournamentInDb(params: {
  tournamentId: string
  teamId: string
}): Promise<void> {
  await set(ref(db, `/tournaments/${params.tournamentId}/teams/${params.teamId}`), null)
}

export async function setTournamentStartedDataInDb(params: {
  tournamentId: string
  groups: GroupRecord[]
  matches: MatchRecord[]
}): Promise<void> {
  await update(tournamentRef(params.tournamentId), {
    status: 'ONGOING',
    startedAt: Date.now(),
    groups: params.groups,
    matches: params.matches,
  })
}

