/**
 * Helpers used by the admin scoring page when starting a match:
 *   - Resolve a TeamRecord to a LiveMatchTeam (uid + name pairs).
 *   - Build the LiveMatchTeam pair for a given MatchRecord.
 *   - Provide a stable matchLabel string for display.
 */

import { getPlayerProfileFromDb } from '../../models/firebase/playerRepository'
import type { LiveMatchTeam } from '../../models/scoring/Scoring'
import type {
  MatchRecord,
  TeamRecord,
  TournamentRecord,
} from '../../models/tournament/Tournament'

function normalizeTeamRecords(t: TournamentRecord): TeamRecord[] {
  if (!t.teams) return []
  if (Array.isArray(t.teams)) return t.teams.filter(Boolean)
  return Object.values(t.teams as unknown as Record<string, TeamRecord>)
}

async function teamRecordToLiveTeam(team: TeamRecord): Promise<LiveMatchTeam> {
  const memberUids = Array.isArray(team.memberUids) ? team.memberUids : []
  const players = await Promise.all(
    memberUids.map(async (uid) => {
      const profile = await getPlayerProfileFromDb(uid)
      return { uid, name: profile?.name ?? 'Player' }
    }),
  )
  return {
    id: team.id,
    name: team.teamName,
    players,
  }
}

export type ScoringSetup = {
  liveMatchId: string
  tournament: TournamentRecord
  match: MatchRecord
  matchLabel: string
  oversPerInnings: number
  teamA: LiveMatchTeam
  teamB: LiveMatchTeam
}

export async function buildScoringSetup(params: {
  tournament: TournamentRecord
  match: MatchRecord
}): Promise<ScoringSetup> {
  const { tournament, match } = params

  if (match.home.kind !== 'team' || match.away.kind !== 'team') {
    throw new Error(
      'Both teams must be assigned before scoring this match. Knockout slots have not been filled yet.',
    )
  }
  const teams = normalizeTeamRecords(tournament)
  const home = teams.find((t) => t.id === match.home.teamId)
  const away = teams.find((t) => t.id === match.away.teamId)
  if (!home || !away) throw new Error('Could not resolve team rosters.')

  const [teamA, teamB] = await Promise.all([
    teamRecordToLiveTeam(home),
    teamRecordToLiveTeam(away),
  ])

  if (teamA.players.length < 2) {
    throw new Error(`${teamA.name} must have at least 2 registered players to start scoring.`)
  }
  if (teamB.players.length < 2) {
    throw new Error(`${teamB.name} must have at least 2 registered players to start scoring.`)
  }

  const matchLabel = `${match.home.label} vs ${match.away.label}`
  const oversPerInnings = tournament.oversPerMatch ?? 20

  return {
    liveMatchId: `${tournament.id}__${match.id}`,
    tournament,
    match,
    matchLabel,
    oversPerInnings,
    teamA,
    teamB,
  }
}
