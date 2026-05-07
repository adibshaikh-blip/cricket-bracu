import { getAllPlayersFromDb } from '../../models/firebase/playerRepository'
import { getPlayerDataFromDb } from '../../models/firebase/playerDataRepository'
import { getUserRoleFromDb } from '../../models/firebase/roleRepository'
import {
  defaultPlayerData,
  type PlayerDataRecord,
} from '../../models/playerData/PlayerData'

export type RankingCategoryId =
  | 'runs'
  | 'wickets'
  | 'sixes'
  | 'fours'
  | 'economy'
  | 'dotBalls'
  | 'runRate'
  | 'fifties'
  | 'hundreds'

export type RankingCategory = {
  id: RankingCategoryId
  label: string
  metricKey: keyof PlayerRankingRow
  /** if true, lower is better (e.g. economy rate). */
  ascending?: boolean
}

export const RANKING_CATEGORIES: RankingCategory[] = [
  { id: 'runs', label: 'Highest Runs', metricKey: 'runs' },
  { id: 'wickets', label: 'Most Wickets', metricKey: 'wickets' },
  { id: 'sixes', label: 'Most Sixes', metricKey: 'sixes' },
  { id: 'fours', label: 'Most Fours', metricKey: 'fours' },
  { id: 'economy', label: 'Best Economy Rate', metricKey: 'economy', ascending: true },
  { id: 'dotBalls', label: 'Most Dot Balls', metricKey: 'dotBalls' },
  { id: 'runRate', label: 'Best Run Rate', metricKey: 'runRate' },
  { id: 'fifties', label: 'Most 50s', metricKey: 'fifties' },
  { id: 'hundreds', label: 'Most 100s', metricKey: 'hundreds' },
]

export type PlayerRankingRow = {
  uid: string
  name: string
  email: string
  department?: string
  runs: number
  wickets: number
  sixes: number
  fours: number
  economy: number
  dotBalls: number
  runRate: number
  fifties: number
  hundreds: number
  matches: number
  ballsFaced: number
}

function mergeWithDefault(data: PlayerDataRecord | null): PlayerDataRecord {
  if (!data) return defaultPlayerData
  return {
    batting: { ...defaultPlayerData.batting, ...(data.batting ?? {}) },
    bowling: { ...defaultPlayerData.bowling, ...(data.bowling ?? {}) },
    tournamentHistory: Array.isArray(data.tournamentHistory)
      ? data.tournamentHistory
      : [],
  }
}

function computeRunRate(runs: number, ballsFaced: number): number {
  if (!ballsFaced || ballsFaced <= 0) return 0
  return Number(((runs / ballsFaced) * 6).toFixed(2))
}

export async function getPlayerRankingRows(): Promise<PlayerRankingRow[]> {
  const players = await getAllPlayersFromDb()

  const rows = await Promise.all(
    players.map(async (p) => {
      const role = await getUserRoleFromDb(p.uid)
      if (role !== 'player') return null

      const raw = await getPlayerDataFromDb(p.uid)
      const data = mergeWithDefault(raw)

      const row: PlayerRankingRow = {
        uid: p.uid,
        name: p.name,
        email: p.email,
        department: p.department,
        runs: data.batting.runs,
        wickets: data.bowling.wickets,
        sixes: data.batting.sixes,
        fours: data.batting.fours,
        economy: data.bowling.economy,
        dotBalls: data.bowling.dotBalls,
        runRate: computeRunRate(data.batting.runs, data.batting.ballsFaced),
        fifties: data.batting.fifties,
        hundreds: data.batting.hundreds,
        matches: data.batting.matches,
        ballsFaced: data.batting.ballsFaced,
      }
      return row
    }),
  )

  return rows.filter((r): r is PlayerRankingRow => r !== null)
}

export function rankRows(
  rows: PlayerRankingRow[],
  categoryId: RankingCategoryId,
): PlayerRankingRow[] {
  const cat = RANKING_CATEGORIES.find((c) => c.id === categoryId)
  if (!cat) return rows

  const sorted = rows.slice().sort((a, b) => {
    const av = a[cat.metricKey] as number
    const bv = b[cat.metricKey] as number
    if (cat.ascending) {
      // For ascending (best = lowest), filter out zeros to put them last.
      if (av === 0 && bv === 0) return 0
      if (av === 0) return 1
      if (bv === 0) return -1
      return av - bv
    }
    return bv - av
  })

  return sorted
}

export function metricValueFor(
  row: PlayerRankingRow,
  categoryId: RankingCategoryId,
): number {
  const cat = RANKING_CATEGORIES.find((c) => c.id === categoryId)
  if (!cat) return 0
  return row[cat.metricKey] as number
}
