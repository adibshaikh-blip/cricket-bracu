/**
 * Live win-probability for a match in progress.
 *
 * Inputs:
 *   - LiveMatchRecord (current scoreboard / state)
 *   - Player career stats from /playerData (used to compute team strength)
 *
 * Approach:
 *
 *   teamStrength(team)
 *     = avgBattingStrength * 0.55 + avgBowlingStrength * 0.45
 *
 *   battingStrength(player)
 *     = 0.6 * average + 0.4 * (strikeRate / 100 * 30)
 *
 *   bowlingStrength(player)
 *     = 0.6 * (career wickets per match * 10)
 *     + 0.4 * (max(0, 12 - economy) * 4)
 *
 *   1st innings:
 *     parScore = max(120 * (oversPerInnings/20), strengthAdjustedPar)
 *     projected = currentRunRate * oversPerInnings
 *     P(team batting first wins) = sigmoid( (projected - parScore) / 25 )
 *
 *   2nd innings (chasing team):
 *     If wickets >= max OR ballsRemaining == 0 → result deterministic.
 *     Else, combine:
 *       wicketResource    = wicketsRemaining / maxWickets (0..1)
 *       runRateGap        = currentRR - requiredRR
 *       strengthDelta     = (chasingStrength - defendingStrength) / 10
 *     P(chase wins) = sigmoid( runRateGap * 0.6 + (wicketResource - 0.5) * 4 + strengthDelta )
 */

import { getPlayerDataFromDb } from '../../models/firebase/playerDataRepository'
import {
  ballsToOversDecimal,
  type LiveMatchRecord,
  type LiveMatchTeam,
  safeRunRate,
} from '../../models/scoring/Scoring'
import { maxWicketsFor } from './scoringController'

export type LivePrediction = {
  teamAName: string
  teamBName: string
  teamAWinProb: number // 0..1
  teamBWinProb: number // 0..1
  /** Required run rate (innings 2 only). */
  requiredRunRate: number | null
  /** Live current run rate of the batting side. */
  currentRunRate: number
  /** Projected score for the batting side at this rate (innings 1 only). */
  projectedScore: number | null
  /** A short narrative caption. */
  caption: string
}

const sigmoid = (x: number): number => 1 / (1 + Math.exp(-x))

async function computeTeamStrength(team: LiveMatchTeam): Promise<number> {
  if (team.players.length === 0) return 50
  const profiles = await Promise.all(
    team.players.map((p) => getPlayerDataFromDb(p.uid)),
  )
  let battingTotal = 0
  let bowlingTotal = 0
  let battingCount = 0
  let bowlingCount = 0
  for (const d of profiles) {
    if (!d) continue
    const outs = d.batting.outs
    const balls = d.batting.ballsFaced
    const avg = outs > 0 ? d.batting.runs / outs : d.batting.runs
    const sr = balls > 0 ? (d.batting.runs / balls) * 100 : 0
    if (d.batting.matches > 0) {
      battingTotal += 0.6 * avg + 0.4 * ((sr / 100) * 30)
      battingCount += 1
    }
    const matches = d.bowling.matches
    if (matches > 0) {
      const wktsPerMatch = d.bowling.wickets / Math.max(1, matches)
      const econ = d.bowling.economy
      bowlingTotal += 0.6 * (wktsPerMatch * 10) + 0.4 * Math.max(0, 12 - econ) * 4
      bowlingCount += 1
    }
  }
  const battingAvg = battingCount > 0 ? battingTotal / battingCount : 25
  const bowlingAvg = bowlingCount > 0 ? bowlingTotal / bowlingCount : 25
  return battingAvg * 0.55 + bowlingAvg * 0.45
}

export async function getLivePrediction(
  m: LiveMatchRecord,
): Promise<LivePrediction | null> {
  if (m.status === 'COMPLETED' || m.status === 'DISCARDED') return null
  if (
    m.status === 'TOSS' ||
    m.status === 'NEED_OPENERS_1' ||
    m.status === 'NEED_OPENING_BOWLER_1'
  ) {
    // Pre-toss / pre-first-ball: assume balanced, modulate by team strength.
    const [sa, sb] = await Promise.all([
      computeTeamStrength(m.teamA),
      computeTeamStrength(m.teamB),
    ])
    const delta = (sa - sb) / 30
    const pA = sigmoid(delta)
    return {
      teamAName: m.teamA.name,
      teamBName: m.teamB.name,
      teamAWinProb: pA,
      teamBWinProb: 1 - pA,
      requiredRunRate: null,
      currentRunRate: 0,
      projectedScore: null,
      caption: 'Match yet to begin — projection based on team strength.',
    }
  }

  const i1 = m.innings1
  const i2 = m.innings2

  if (m.status === 'INNINGS_1' || m.status === 'BREAK' || m.status === 'NEED_OPENERS_2' || m.status === 'NEED_OPENING_BOWLER_2') {
    if (!i1) return null
    const battingTeamId = i1.battingTeamId
    const battingTeam = m.teamA.id === battingTeamId ? m.teamA : m.teamB
    const bowlingTeam = m.teamA.id === battingTeamId ? m.teamB : m.teamA
    const [sBat, sBowl] = await Promise.all([
      computeTeamStrength(battingTeam),
      computeTeamStrength(bowlingTeam),
    ])

    const oversBowled = ballsToOversDecimal(i1.legalBalls)
    const crr = safeRunRate(i1.runs, i1.legalBalls)
    const projected = i1.legalBalls > 0
      ? Math.round((i1.runs * (m.oversPerInnings * 6)) / i1.legalBalls)
      : 0

    // Par score baseline scales with oversPerInnings; tweak by relative strength.
    const basePar = m.oversPerInnings * 7 // ~7 RPO baseline
    const strengthAdj = (sBat - sBowl) * 0.4
    const par = basePar + strengthAdj

    const battingFirstWinProb = sigmoid((projected - par) / 25)
    const teamAWin = battingTeamId === m.teamA.id
      ? battingFirstWinProb
      : 1 - battingFirstWinProb

    const caption =
      i1.legalBalls === 0
        ? `${battingTeam.name} batting — innings just starting.`
        : `${battingTeam.name} on track for ~${projected} (par ≈ ${Math.round(par)}). CRR ${crr}, overs ${oversBowled}.`

    return {
      teamAName: m.teamA.name,
      teamBName: m.teamB.name,
      teamAWinProb: teamAWin,
      teamBWinProb: 1 - teamAWin,
      requiredRunRate: null,
      currentRunRate: crr,
      projectedScore: projected,
      caption,
    }
  }

  // INNINGS_2
  if (!i1 || !i2 || !m.target) return null
  const chasingTeamId = i2.battingTeamId
  const chasingTeam = m.teamA.id === chasingTeamId ? m.teamA : m.teamB
  const defendingTeam = m.teamA.id === chasingTeamId ? m.teamB : m.teamA
  const [sChase, sDef] = await Promise.all([
    computeTeamStrength(chasingTeam),
    computeTeamStrength(defendingTeam),
  ])

  const ballsRemaining = m.oversPerInnings * 6 - i2.legalBalls
  const runsNeeded = Math.max(0, m.target - i2.runs)
  const wicketsRemaining = Math.max(0, maxWicketsFor(chasingTeam) - i2.wickets)
  const crr = safeRunRate(i2.runs, i2.legalBalls)
  const rrr = ballsRemaining > 0 ? Number(((runsNeeded * 6) / ballsRemaining).toFixed(2)) : 0

  let pChase: number
  if (runsNeeded === 0) pChase = 1
  else if (ballsRemaining === 0 || wicketsRemaining === 0) pChase = 0
  else {
    const runRateGap = crr - rrr
    const wicketResource =
      wicketsRemaining / Math.max(1, maxWicketsFor(chasingTeam))
    const strengthDelta = (sChase - sDef) / 30
    pChase = sigmoid(runRateGap * 0.6 + (wicketResource - 0.5) * 4 + strengthDelta)
  }

  const teamAWin =
    chasingTeamId === m.teamA.id ? pChase : 1 - pChase

  const caption =
    runsNeeded === 0
      ? `${chasingTeam.name} have completed the chase.`
      : ballsRemaining === 0
      ? `Innings ended — ${defendingTeam.name} defended ${m.target - 1}.`
      : `${chasingTeam.name} need ${runsNeeded} from ${ballsRemaining} balls (RRR ${rrr}). CRR ${crr}.`

  return {
    teamAName: m.teamA.name,
    teamBName: m.teamB.name,
    teamAWinProb: teamAWin,
    teamBWinProb: 1 - teamAWin,
    requiredRunRate: rrr,
    currentRunRate: crr,
    projectedScore: null,
    caption,
  }
}
