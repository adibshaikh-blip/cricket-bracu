import {
  addTeamToTournamentInDb,
  getTournamentByIdFromDb,
  removeTeamFromTournamentInDb,
  setTournamentStartedDataInDb,
} from '../../models/firebase/tournamentRepository'
import type {
  GroupRecord,
  MatchParticipantRef,
  MatchRecord,
  MatchStage,
  TeamRecord,
  TournamentRecord,
} from '../../models/tournament/Tournament'

function normalizeCollection<T>(value: unknown): T[] {
  if (!value) return []
  if (Array.isArray(value)) return value.filter(Boolean) as T[]
  if (typeof value === 'object') return Object.values(value as Record<string, T>)
  return []
}

export async function getTournamentForManagement(
  tournamentId: string,
): Promise<TournamentRecord | null> {
  const t = await getTournamentByIdFromDb(tournamentId)
  if (!t) return null

  return {
    ...t,
    teams: normalizeCollection<TeamRecord>(t.teams),
    groups: normalizeCollection<GroupRecord>(t.groups),
    matches: normalizeCollection<MatchRecord>(t.matches),
  }
}

export async function addTeamToTournament(params: {
  tournamentId: string
  teamName: string
}): Promise<TeamRecord> {
  if (!params.teamName.trim()) throw new Error('Team name is required.')

  const t = await getTournamentForManagement(params.tournamentId)
  if (!t) throw new Error('Tournament not found.')
  if (t.status !== 'UPCOMING') {
    throw new Error('Cannot add teams after tournament starts.')
  }
  if ((t.teams?.length ?? 0) >= t.maxTeams) {
    throw new Error('Maximum number of teams reached.')
  }

  return addTeamToTournamentInDb(params)
}

export async function kickTeamFromTournament(params: {
  tournamentId: string
  teamId: string
}): Promise<void> {
  const t = await getTournamentForManagement(params.tournamentId)
  if (!t) throw new Error('Tournament not found.')
  if (t.status !== 'UPCOMING') {
    throw new Error('Teams can only be removed before tournament starts.')
  }
  await removeTeamFromTournamentInDb(params)
}

function divideTeamsIntoGroups(teams: TeamRecord[], numberOfGroups: number): GroupRecord[] {
  const groups: GroupRecord[] = Array.from({ length: numberOfGroups }, (_, idx) => ({
    id: `group-${idx + 1}`,
    groupName: `Group ${String.fromCharCode(65 + idx)}`,
    teamIds: [],
  }))

  teams.forEach((team, idx) => {
    const groupIdx = idx % numberOfGroups
    groups[groupIdx].teamIds.push(team.id)
  })

  return groups
}

function createGroupStageMatches(groups: GroupRecord[], teams: TeamRecord[]): MatchRecord[] {
  const teamById = new Map(teams.map((t) => [t.id, t]))
  const matches: MatchRecord[] = []
  let sequence = 1

  for (const group of groups) {
    for (let i = 0; i < group.teamIds.length; i += 1) {
      for (let j = i + 1; j < group.teamIds.length; j += 1) {
        const homeTeam = teamById.get(group.teamIds[i])
        const awayTeam = teamById.get(group.teamIds[j])
        if (!homeTeam || !awayTeam) continue

        matches.push({
          id: `group-${group.id}-m-${sequence}`,
          stage: 'GROUP',
          status: 'SCHEDULED',
          groupId: group.id,
          sequence,
          home: { kind: 'team', teamId: homeTeam.id, label: homeTeam.teamName },
          away: { kind: 'team', teamId: awayTeam.id, label: awayTeam.teamName },
        })
        sequence += 1
      }
    }
  }

  return matches
}

function createKnockoutMatches(params: {
  startSequence: number
  qualifiedCount: 8 | 4
}): MatchRecord[] {
  let seq = params.startSequence
  const matches: MatchRecord[] = []

  const slot = (label: string): MatchParticipantRef => ({ kind: 'slot', label })
  const pushMatch = (stage: MatchStage, home: string, away: string) => {
    matches.push({
      id: `${stage.toLowerCase()}-m-${seq}`,
      stage,
      status: 'SCHEDULED',
      sequence: seq,
      home: slot(home),
      away: slot(away),
    })
    seq += 1
  }

  if (params.qualifiedCount === 8) {
    pushMatch('QUARTER_FINAL', 'Q1', 'Q8')
    pushMatch('QUARTER_FINAL', 'Q2', 'Q7')
    pushMatch('QUARTER_FINAL', 'Q3', 'Q6')
    pushMatch('QUARTER_FINAL', 'Q4', 'Q5')
    pushMatch('SEMI_FINAL', 'Winner QF1', 'Winner QF2')
    pushMatch('SEMI_FINAL', 'Winner QF3', 'Winner QF4')
    pushMatch('FINAL', 'Winner SF1', 'Winner SF2')
  } else {
    pushMatch('SEMI_FINAL', 'Q1', 'Q4')
    pushMatch('SEMI_FINAL', 'Q2', 'Q3')
    pushMatch('FINAL', 'Winner SF1', 'Winner SF2')
  }

  return matches
}

export async function startTournament(params: { tournamentId: string }): Promise<void> {
  const t = await getTournamentForManagement(params.tournamentId)
  if (!t) throw new Error('Tournament not found.')
  if (t.status !== 'UPCOMING') throw new Error('Tournament is already started.')

  const teams = t.teams ?? []
  if (teams.length < t.numberOfGroups * 3) {
    throw new Error('Not enough teams. At least 3 teams per group are required.')
  }

  const qualifiedCount = t.tournamentType === 1 ? 8 : 4
  if (teams.length < qualifiedCount) {
    throw new Error(`At least ${qualifiedCount} teams are required for knockout stage.`)
  }

  const groups = divideTeamsIntoGroups(teams, t.numberOfGroups)
  const groupMatches = createGroupStageMatches(groups, teams)
  const knockoutMatches = createKnockoutMatches({
    startSequence: groupMatches.length + 1,
    qualifiedCount,
  })

  await setTournamentStartedDataInDb({
    tournamentId: params.tournamentId,
    groups,
    matches: [...groupMatches, ...knockoutMatches],
  })
}

