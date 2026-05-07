import { getAllTournamentsFromDb, getTournamentByIdFromDb } from '../../models/firebase/tournamentRepository'
import { getPlayerDataFromDb } from '../../models/firebase/playerDataRepository'
import { getPlayerProfileFromDb } from '../../models/firebase/playerRepository'
import type { MatchRecord, TeamRecord, TournamentRecord } from '../../models/tournament/Tournament'

export type TournamentGroupBuckets = {
  active: TournamentRecord[]
  upcoming: TournamentRecord[]
  past: TournamentRecord[]
}

type PerformanceRow = {
  uid: string
  playerName: string
  runs: number
  wickets: number
  averageRun: number
  economyRate: number
}

type PointsRow = {
  teamId: string
  teamName: string
  played: number
  won: number
  lost: number
  tied: number
  points: number
}

type TournamentInfoView = {
  tournament: TournamentRecord
  pointsTable: PointsRow[]
  performanceTable: PerformanceRow[]
  bestPerformer: PerformanceRow | null
}

function normalizeTeams(tournament: TournamentRecord): TeamRecord[] {
  const teams = tournament.teams
  if (!teams) return []
  if (Array.isArray(teams)) return teams.filter(Boolean)
  return Object.values(teams as unknown as Record<string, TeamRecord>)
}

function normalizeMatches(tournament: TournamentRecord): MatchRecord[] {
  const matches = tournament.matches
  if (!matches) return []
  if (Array.isArray(matches)) return matches.filter(Boolean)
  return Object.values(matches as unknown as Record<string, MatchRecord>)
}

/**
 * ICC league standard:
 *   - Win: 2 points
 *   - Tie:  1 point each
 *   - Loss: 0 points
 *   - Discarded matches do not affect the table.
 */
function computePointsTable(
  teams: TeamRecord[],
  tournament: TournamentRecord,
): PointsRow[] {
  const initial = new Map<string, PointsRow>(
    teams.map((t) => [
      t.id,
      {
        teamId: t.id,
        teamName: t.teamName,
        played: 0,
        won: 0,
        lost: 0,
        tied: 0,
        points: 0,
      },
    ]),
  )

  for (const match of normalizeMatches(tournament)) {
    if (match.status !== 'COMPLETED' || !match.result) continue
    if (match.result.margin === 'discarded') continue
    if (match.home.kind !== 'team' || match.away.kind !== 'team') continue

    const homeRow = initial.get(match.home.teamId)
    const awayRow = initial.get(match.away.teamId)
    if (!homeRow || !awayRow) continue

    homeRow.played += 1
    awayRow.played += 1

    if (match.result.margin === 'tie' || match.result.winnerTeamId === null) {
      homeRow.tied += 1
      awayRow.tied += 1
      homeRow.points += 1
      awayRow.points += 1
      continue
    }

    if (match.result.winnerTeamId === homeRow.teamId) {
      homeRow.won += 1
      homeRow.points += 2
      awayRow.lost += 1
    } else if (match.result.winnerTeamId === awayRow.teamId) {
      awayRow.won += 1
      awayRow.points += 2
      homeRow.lost += 1
    }
  }

  return Array.from(initial.values()).sort(
    (a, b) => b.points - a.points || b.won - a.won || a.teamName.localeCompare(b.teamName),
  )
}

async function computePerformanceTable(teams: TeamRecord[]): Promise<PerformanceRow[]> {
  const uniqueUids = Array.from(
    new Set(
      teams.flatMap((team) => team.memberUids ?? []).filter(Boolean),
    ),
  )

  const rows = await Promise.all(
    uniqueUids.map(async (uid) => {
      const [profile, data] = await Promise.all([
        getPlayerProfileFromDb(uid),
        getPlayerDataFromDb(uid),
      ])
      const runs = data?.batting?.runs ?? 0
      const wickets = data?.bowling?.wickets ?? 0
      const outs = data?.batting?.outs ?? 0
      const economy = data?.bowling?.economy ?? 0
      const averageRun = outs > 0 ? Number((runs / outs).toFixed(2)) : runs

      return {
        uid,
        playerName: profile?.name ?? 'Unknown Player',
        runs,
        wickets,
        averageRun,
        economyRate: economy,
      } satisfies PerformanceRow
    }),
  )

  return rows
}

function computeBestPerformer(rows: PerformanceRow[]): PerformanceRow | null {
  if (rows.length === 0) return null
  return rows
    .slice()
    .sort((a, b) => {
      const scoreA = a.runs + a.wickets * 20
      const scoreB = b.runs + b.wickets * 20
      return scoreB - scoreA
    })[0]
}

export async function getPublicTournamentBuckets(): Promise<TournamentGroupBuckets> {
  const all = await getAllTournamentsFromDb()
  const active = all.filter((t) => t.status === 'ONGOING')
  const upcoming = all.filter((t) => t.status === 'UPCOMING')
  const past = all.filter((t) => t.status === 'COMPLETED')
  return { active, upcoming, past }
}

export async function getTournamentInfoView(
  tournamentId: string,
): Promise<TournamentInfoView | null> {
  const tournament = await getTournamentByIdFromDb(tournamentId)
  if (!tournament) return null

  const teams = normalizeTeams(tournament)
  const pointsTable = computePointsTable(teams, tournament)
  const performanceTable = await computePerformanceTable(teams)
  const bestPerformer =
    tournament.status === 'COMPLETED'
      ? computeBestPerformer(performanceTable)
      : null

  return {
    tournament,
    pointsTable,
    performanceTable,
    bestPerformer,
  }
}

