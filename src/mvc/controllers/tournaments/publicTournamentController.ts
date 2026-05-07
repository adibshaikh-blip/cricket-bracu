import { getAllTournamentsFromDb, getTournamentByIdFromDb } from '../../models/firebase/tournamentRepository'
import { getPlayerDataFromDb } from '../../models/firebase/playerDataRepository'
import { getPlayerProfileFromDb } from '../../models/firebase/playerRepository'
import type { TeamRecord, TournamentRecord } from '../../models/tournament/Tournament'

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

function computePointsTable(teams: TeamRecord[]): PointsRow[] {
  // Placeholder scoring for v0.3; actual points will be tied to match results in future versions.
  return teams.map((team) => ({
    teamId: team.id,
    teamName: team.teamName,
    played: 0,
    won: 0,
    lost: 0,
    points: 0,
  }))
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
  const pointsTable = computePointsTable(teams)
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

