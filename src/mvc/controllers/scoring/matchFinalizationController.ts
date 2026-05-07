/**
 * On match completion (or discard), this module:
 *   1. Persists the result onto the tournament's MatchRecord.
 *   2. Advances knockout slots to point at concrete teams.
 *   3. Updates each participating player's career batting/bowling
 *      statistics in /playerData.
 *   4. Marks the tournament COMPLETED if the final has been decided.
 *
 * Discarded matches do NOT update player stats nor advance knockout
 * slots, but their result is stored on the MatchRecord so the UI can
 * surface the discard reason.
 */

import {
  getTournamentByIdFromDb,
  setTournamentMatchesInDb,
  setTournamentStatusInDb,
} from '../../models/firebase/tournamentRepository'
import {
  getPlayerDataFromDb,
  setPlayerDataInDb,
} from '../../models/firebase/playerDataRepository'
import {
  defaultPlayerData,
  type PlayerDataRecord,
} from '../../models/playerData/PlayerData'
import {
  ballsToOversDecimal,
  type BatsmanCard,
  type BowlerCard,
  type InningsState,
  type LiveMatchRecord,
} from '../../models/scoring/Scoring'
import type {
  MatchRecord,
  MatchResult,
  TournamentRecord,
} from '../../models/tournament/Tournament'
import {
  getLiveMatchFromDb,
  updateLiveMatchInDb,
} from '../../models/firebase/liveMatchRepository'

function normalizeMatches(t: TournamentRecord): MatchRecord[] {
  const m = t.matches
  if (!m) return []
  if (Array.isArray(m)) return m.filter(Boolean)
  return Object.values(m as unknown as Record<string, MatchRecord>)
}

function inningsToSummary(innings: InningsState): MatchResult['innings1Summary'] {
  return {
    teamId: innings.battingTeamId,
    runs: innings.runs,
    wickets: innings.wickets,
    oversText: `${Math.floor(innings.legalBalls / 6)}.${innings.legalBalls % 6}`,
  }
}

/* ---------- knockout advancement ---------- */

/**
 * Tournament progression rules for knockout slots:
 *   - QF1..QF8 are filled by group winners/runners-up (we don't auto-fill these
 *     in this controller; they were created with named slots from
 *     tournamentManagementController and admins assign teams via a future UI).
 *     For now this advancer only handles "Winner X" → concrete team after a
 *     match decides who progresses.
 *
 *   - We look at the just-completed match's stage and sequence to determine
 *     which downstream slot should be replaced with the winner team.
 */
function advanceKnockoutSlots(
  matches: MatchRecord[],
  finishedMatch: MatchRecord,
  winnerTeamId: string | null,
  winnerName: string,
): MatchRecord[] {
  if (!winnerTeamId) return matches
  if (finishedMatch.stage === 'GROUP') return matches

  // Map stage + sequence → label written when the bracket was generated.
  // From tournamentManagementController.createKnockoutMatches:
  //   - 8-team bracket: QFs are sequence 1..4 (relative); SFs use "Winner QF1".."Winner QF4"; Final uses "Winner SF1".."Winner SF2".
  //   - 4-team bracket: SFs are 1..2; Final uses "Winner SF1".."Winner SF2".
  //
  // The sequence numbers are global across the tournament so we can't rely on
  // them being 1..n at the knockout stage. Instead, match by stage label.
  const knockoutMatches = matches
    .filter((m) => m.stage !== 'GROUP')
    .sort((a, b) => a.sequence - b.sequence)

  const indexInStage = (stage: MatchRecord['stage']) => {
    const list = knockoutMatches.filter((m) => m.stage === stage)
    return list.findIndex((m) => m.id === finishedMatch.id) + 1 // 1-based
  }

  let upstreamLabel: string | null = null
  if (finishedMatch.stage === 'QUARTER_FINAL') {
    upstreamLabel = `Winner QF${indexInStage('QUARTER_FINAL')}`
  } else if (finishedMatch.stage === 'SEMI_FINAL') {
    upstreamLabel = `Winner SF${indexInStage('SEMI_FINAL')}`
  }
  if (!upstreamLabel) return matches

  return matches.map((m) => {
    const home = m.home
    const away = m.away
    let updated = m
    if (home.kind === 'slot' && home.label === upstreamLabel) {
      updated = {
        ...updated,
        home: { kind: 'team', teamId: winnerTeamId, label: winnerName },
      }
    }
    if (away.kind === 'slot' && away.label === upstreamLabel) {
      updated = {
        ...updated,
        away: { kind: 'team', teamId: winnerTeamId, label: winnerName },
      }
    }
    return updated
  })
}

/* ---------- player stats ---------- */

function ensurePlayerData(d: PlayerDataRecord | null): PlayerDataRecord {
  if (!d) return JSON.parse(JSON.stringify(defaultPlayerData)) as PlayerDataRecord
  return {
    ...defaultPlayerData,
    ...d,
    batting: { ...defaultPlayerData.batting, ...(d.batting ?? {}) },
    bowling: { ...defaultPlayerData.bowling, ...(d.bowling ?? {}) },
    tournamentHistory: Array.isArray(d.tournamentHistory) ? d.tournamentHistory : [],
  }
}

function applyBattingStats(
  current: PlayerDataRecord,
  card: BatsmanCard,
): PlayerDataRecord {
  const next = JSON.parse(JSON.stringify(current)) as PlayerDataRecord
  next.batting.matches += 1
  next.batting.innings += 1 // every batting card represents one innings appearance
  next.batting.runs += card.runs
  next.batting.ballsFaced += card.ballsFaced
  next.batting.fours += card.fours
  next.batting.sixes += card.sixes
  if (card.status === 'OUT') next.batting.outs += 1
  if (card.runs > next.batting.highestScore) next.batting.highestScore = card.runs
  if (card.runs >= 100) next.batting.hundreds += 1
  else if (card.runs >= 50) next.batting.fifties += 1
  return next
}

function applyBowlingStats(
  current: PlayerDataRecord,
  card: BowlerCard,
): PlayerDataRecord {
  const next = JSON.parse(JSON.stringify(current)) as PlayerDataRecord
  next.bowling.matches += 1
  next.bowling.overs = Number(
    (next.bowling.overs + ballsToOversDecimal(card.ballsBowled)).toFixed(1),
  )
  next.bowling.runsConceded += card.runsConceded
  next.bowling.wickets += card.wickets
  next.bowling.maidens += card.maidens
  next.bowling.dotBalls += card.dotBalls
  // Re-derive economy as career runsConceded * 6 / career ballsBowled.
  // We don't have career balls in the model; approximate via overs.
  if (next.bowling.overs > 0) {
    next.bowling.economy = Number(
      (next.bowling.runsConceded / next.bowling.overs).toFixed(2),
    )
  }
  // Update best figures: prefer more wickets; tie-break by fewer runs.
  const [bestWickets, bestRuns] = (() => {
    const parts = String(next.bowling.bestFigures || '0/0').split('/')
    return [Number(parts[0]) || 0, Number(parts[1]) || 0]
  })()
  const isBetter =
    card.wickets > bestWickets ||
    (card.wickets === bestWickets && card.runsConceded < bestRuns)
  if (card.ballsBowled > 0 && isBetter) {
    next.bowling.bestFigures = `${card.wickets}/${card.runsConceded}`
  }
  return next
}

async function applyPlayerStatsForMatch(live: LiveMatchRecord): Promise<void> {
  if (!live.innings1 || !live.innings2) return

  const playersThatBatted = new Set<string>()
  const playersThatBowled = new Set<string>()
  const battingByUid = new Map<string, BatsmanCard>()
  const bowlingByUid = new Map<string, BowlerCard>()

  const collect = (innings: InningsState) => {
    Object.values(innings.battingCards).forEach((card) => {
      // Only consider players who actually batted (faced at least 1 ball OR got out).
      if (card.status === 'YET_TO_BAT' && card.ballsFaced === 0 && card.runs === 0) return
      playersThatBatted.add(card.uid)
      battingByUid.set(card.uid, card)
    })
    Object.values(innings.bowlingCards).forEach((card) => {
      if (card.ballsBowled === 0 && card.wides === 0 && card.noBalls === 0) return
      playersThatBowled.add(card.uid)
      bowlingByUid.set(card.uid, card)
    })
  }
  collect(live.innings1)
  collect(live.innings2)

  const allUids = new Set<string>([...playersThatBatted, ...playersThatBowled])

  await Promise.all(
    Array.from(allUids).map(async (uid) => {
      const existing = await getPlayerDataFromDb(uid)
      let next = ensurePlayerData(existing)

      const batCard = battingByUid.get(uid)
      if (batCard) next = applyBattingStats(next, batCard)
      const bowlCard = bowlingByUid.get(uid)
      if (bowlCard) next = applyBowlingStats(next, bowlCard)

      await setPlayerDataInDb(uid, next)
    }),
  )
}

/* ---------- man of the match ---------- */

function pickManOfTheMatch(
  live: LiveMatchRecord,
): { uid: string; name: string } | null {
  if (!live.innings1 || !live.innings2) return null
  const allBatting = [
    ...Object.values(live.innings1.battingCards),
    ...Object.values(live.innings2.battingCards),
  ]
  const allBowling = [
    ...Object.values(live.innings1.bowlingCards),
    ...Object.values(live.innings2.bowlingCards),
  ]

  const score = new Map<string, { name: string; pts: number }>()
  for (const c of allBatting) {
    const existing = score.get(c.uid) ?? { name: c.name, pts: 0 }
    existing.pts += c.runs
    score.set(c.uid, existing)
  }
  for (const c of allBowling) {
    const existing = score.get(c.uid) ?? { name: c.name, pts: 0 }
    existing.pts += c.wickets * 20
    score.set(c.uid, existing)
  }

  let best: { uid: string; name: string; pts: number } | null = null
  score.forEach((v, uid) => {
    if (!best || v.pts > best.pts) best = { uid, name: v.name, pts: v.pts }
  })
  if (!best || best.pts === 0) return null
  return { uid: best.uid, name: best.name }
}

/* ---------- public API ---------- */

/**
 * Finalises a completed/discarded LiveMatch:
 *   - Updates MatchRecord.result inside the tournament.
 *   - Advances knockout brackets if applicable.
 *   - Updates each participating player's PlayerData (only on COMPLETED).
 *   - Marks tournament COMPLETED if the final has been decided.
 */
export async function finalizeMatch(params: {
  liveMatchId: string
}): Promise<{ match: MatchRecord; tournamentClosed: boolean }> {
  const live = await getLiveMatchFromDb(params.liveMatchId)
  if (!live) throw new Error('Live match not found.')
  if (live.status !== 'COMPLETED' && live.status !== 'DISCARDED') {
    throw new Error('Match has not ended yet.')
  }

  const t = await getTournamentByIdFromDb(live.tournamentId)
  if (!t) throw new Error('Tournament not found.')

  const matches = normalizeMatches(t)
  const target = matches.find((m) => m.id === live.matchId)
  if (!target) throw new Error('Match record not found in tournament.')

  // Build MatchResult summary.
  const result: MatchResult = {
    winnerTeamId: live.result?.winnerTeamId ?? null,
    winnerLabel: live.result?.winnerLabel ?? '—',
    margin: live.result?.margin ?? 'discarded',
    marginValue: live.result?.marginValue ?? 0,
    innings1Summary: live.innings1 ? inningsToSummary(live.innings1) : undefined,
    innings2Summary: live.innings2 ? inningsToSummary(live.innings2) : undefined,
    finalisedAt: Date.now(),
  }

  if (live.status === 'COMPLETED') {
    const motm = pickManOfTheMatch(live)
    if (motm) {
      result.manOfTheMatchUid = motm.uid
      result.manOfTheMatchName = motm.name
      // also stash on the live record for the public match view
      await updateLiveMatchInDb(live.id, {
        result: {
          ...(live.result ?? {
            winnerTeamId: null,
            winnerLabel: '—',
            margin: 'tie',
            marginValue: 0,
            summary: '',
            finalisedAt: Date.now(),
          }),
          manOfTheMatchUid: motm.uid,
          manOfTheMatchName: motm.name,
        },
      })
    }
  }

  // Update the match record.
  let updated: MatchRecord = {
    ...target,
    status: 'COMPLETED',
    liveMatchId: live.id,
    result,
  }
  let nextMatches = matches.map((m) => (m.id === target.id ? updated : m))

  // Advance knockout slots only on a real completion.
  if (live.status === 'COMPLETED') {
    nextMatches = advanceKnockoutSlots(
      nextMatches,
      updated,
      result.winnerTeamId,
      result.winnerLabel,
    )
  }

  await setTournamentMatchesInDb({
    tournamentId: live.tournamentId,
    matches: nextMatches,
  })

  // Player stats ONLY for non-discarded matches.
  let tournamentClosed = false
  if (live.status === 'COMPLETED') {
    await applyPlayerStatsForMatch(live)

    // Tournament completion: if the FINAL just ended.
    if (target.stage === 'FINAL') {
      await setTournamentStatusInDb({
        tournamentId: live.tournamentId,
        status: 'COMPLETED',
      })
      tournamentClosed = true
    }
  }

  // refresh `updated` reference so the caller has the post-mutation match
  updated = nextMatches.find((m) => m.id === target.id) ?? updated
  return { match: updated, tournamentClosed }
}
