import { getAllTournamentsFromDb, getTournamentByIdFromDb } from '../../models/firebase/tournamentRepository'
import { getPlayerDataFromDb } from '../../models/firebase/playerDataRepository'
import { getPlayerProfileFromDb } from '../../models/firebase/playerRepository'
import type { TeamRecord, TournamentRecord } from '../../models/tournament/Tournament'
import {
  computeGroupPointsSections,
  normalizeTeams,
  type GroupPointsSection,
  type PointsRow,
} from './groupStandings'

export type { PointsRow }

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

type TournamentInfoView = {
  tournament: TournamentRecord
  /** One standings table per group (group stage only). Empty if tournament has not started. */
  groupPointsTables: GroupPointsSection[]
  /** Top N from each group advance (N × groups = knockout size). */
  qualifiersPerGroup: number | null
  performanceTable: PerformanceRow[]
  bestPerformer: PerformanceRow | null
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
  const groupPointsTables = computeGroupPointsSections(tournament)
  const knockoutSize = tournament.tournamentType === 1 ? 8 : 4
  const ng = tournament.numberOfGroups || 1
  const qpg = knockoutSize / ng
  const qualifiersPerGroup = Number.isInteger(qpg) && qpg > 0 ? qpg : null

  const performanceTable = await computePerformanceTable(teams)
  const bestPerformer =
    tournament.status === 'COMPLETED'
      ? computeBestPerformer(performanceTable)
      : null

  return {
    tournament,
    groupPointsTables,
    qualifiersPerGroup,
    performanceTable,
    bestPerformer,
  }
}

