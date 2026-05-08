import type {
  GroupRecord,
  MatchRecord,
  TeamRecord,
  TournamentRecord,
} from '../../models/tournament/Tournament'

export type PointsRow = {
  teamId: string
  teamName: string
  played: number
  won: number
  lost: number
  tied: number
  points: number
}

export function normalizeMatches(tournament: TournamentRecord): MatchRecord[] {
  const matches = tournament.matches
  if (!matches) return []
  if (Array.isArray(matches)) return matches.filter(Boolean)
  return Object.values(matches as unknown as Record<string, MatchRecord>)
}

export function normalizeGroups(tournament: TournamentRecord): GroupRecord[] {
  const groups = tournament.groups
  if (!groups) return []
  if (Array.isArray(groups)) return groups.filter(Boolean)
  return Object.values(groups as unknown as Record<string, GroupRecord>)
}

export function normalizeTeams(tournament: TournamentRecord): TeamRecord[] {
  const teams = tournament.teams
  if (!teams) return []
  if (Array.isArray(teams)) return teams.filter(Boolean)
  return Object.values(teams as unknown as Record<string, TeamRecord>)
}

function sortPointsRows(rows: PointsRow[]): PointsRow[] {
  return rows.slice().sort(
    (a, b) =>
      b.points - a.points ||
      b.won - a.won ||
      a.teamName.localeCompare(b.teamName),
  )
}

/**
 * ICC league standard for group-stage matches only:
 * Win 2, Tie 1 each, Loss 0; discarded omitted.
 */
export function computePointsTableForGroup(
  group: GroupRecord,
  teams: TeamRecord[],
  allMatches: MatchRecord[],
): PointsRow[] {
  const teamById = new Map(teams.map((t) => [t.id, t]))
  const inGroup = new Set(group.teamIds)

  const initial = new Map<string, PointsRow>()
  for (const tid of group.teamIds) {
    const t = teamById.get(tid)
    if (!t) continue
    initial.set(tid, {
      teamId: t.id,
      teamName: t.teamName,
      played: 0,
      won: 0,
      lost: 0,
      tied: 0,
      points: 0,
    })
  }

  for (const match of allMatches) {
    if (match.stage !== 'GROUP' || match.groupId !== group.id) continue
    if (match.status !== 'COMPLETED' || !match.result) continue
    if (match.result.margin === 'discarded') continue
    if (match.home.kind !== 'team' || match.away.kind !== 'team') continue
    if (!inGroup.has(match.home.teamId) || !inGroup.has(match.away.teamId)) continue

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

  return sortPointsRows(Array.from(initial.values()))
}

export type GroupPointsSection = {
  groupId: string
  groupName: string
  rows: PointsRow[]
}

export function computeGroupPointsSections(
  tournament: TournamentRecord,
): GroupPointsSection[] {
  const groups = normalizeGroups(tournament)
  const teams = normalizeTeams(tournament)
  const matches = normalizeMatches(tournament)

  return groups.map((g) => ({
    groupId: g.id,
    groupName: g.groupName,
    rows: computePointsTableForGroup(g, teams, matches),
  }))
}

/** Interleaved seeds: rank r across groups in order (A1, B1, A2, B2, …). */
export function buildKnockoutSeedOrder(args: {
  groups: GroupRecord[]
  rankedRowsPerGroup: PointsRow[][]
  slotsCount: number
}): PointsRow[] {
  const { groups, rankedRowsPerGroup, slotsCount } = args
  const perGroup = slotsCount / groups.length
  if (!Number.isInteger(perGroup)) return []

  const seeds: PointsRow[] = []
  for (let rank = 0; rank < perGroup; rank += 1) {
    for (let g = 0; g < groups.length; g += 1) {
      const row = rankedRowsPerGroup[g]?.[rank]
      if (row) seeds.push(row)
    }
  }
  return seeds.slice(0, slotsCount)
}
