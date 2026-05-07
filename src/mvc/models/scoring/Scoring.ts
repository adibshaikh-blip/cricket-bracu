/**
 * ICC-compliant cricket match scoring data model.
 *
 * Conventions:
 * - Each over has 6 *legal* deliveries. Wides and No-balls are illegal and
 *   are re-bowled (do not increment legal-ball counters).
 * - Byes and Leg-byes are legal deliveries (count toward the over and the
 *   batsman's balls-faced) but the runs are credited to extras, not the
 *   batsman.
 * - Strike rotates whenever an odd number of batsmen-runs is taken, and
 *   automatically swaps at the end of every over (provided the innings
 *   continues).
 */

export type DismissalType =
  | 'BOWLED'
  | 'CAUGHT'
  | 'LBW'
  | 'RUN_OUT'
  | 'STUMPED'
  | 'HIT_WICKET'

export const DISMISSAL_LABELS: Record<DismissalType, string> = {
  BOWLED: 'Bowled',
  CAUGHT: 'Caught',
  LBW: 'LBW',
  RUN_OUT: 'Run out',
  STUMPED: 'Stumped',
  HIT_WICKET: 'Hit wicket',
}

/**
 * The kind of ball the admin recorded.
 *
 * - RUN: a normal legal delivery, runs go to the batsman (incl. boundaries).
 * - WIDE: illegal delivery, 1 penalty run + any additional batsmen-runs are
 *         all extras.
 * - NO_BALL: illegal delivery, 1 penalty run; runs off the bat (if any) go
 *            to the batsman; extra-runs (bye/leg-bye style) on a no-ball
 *            are treated as extras here for simplicity.
 * - BYE: legal delivery, ball missed everything, runs go to extras (NOT
 *        batsman), counts toward the over.
 * - LEG_BYE: legal delivery, ball off body, runs go to extras (NOT batsman),
 *            counts toward the over.
 * - WICKET: a dismissal recorded against the current striker (or a run-out
 *           against either batsman). Run-out can carry runs completed before
 *           the dismissal.
 */
export type BallEventType =
  | 'RUN'
  | 'WIDE'
  | 'NO_BALL'
  | 'BYE'
  | 'LEG_BYE'
  | 'WICKET'

export type BallEvent = {
  id: string
  innings: 1 | 2
  battingTeamId: string
  bowlingTeamId: string
  /** 1-based over number this ball belongs to. */
  overNumber: number
  /**
   * Position within the over for this ball. For legal deliveries this is
   * 1..6. For illegal deliveries (wide/no-ball) it stays at the current
   * legal-ball count (i.e. shares the position with the "next" legal ball).
   */
  ballInOverDisplay: number
  /** True for RUN/BYE/LEG_BYE/WICKET (unless the wicket is on a wide/NB), false for WIDE/NO_BALL. */
  isLegal: boolean
  bowlerId: string
  strikerId: string
  nonStrikerId: string
  type: BallEventType
  /** Runs off the bat for RUN; additional batsmen-runs taken on a wide/NB/bye/leg-bye; runs completed before run-out. */
  runs: number
  /** Total runs added to the team's score for this delivery (including penalties). */
  totalRunsThisBall: number
  wicket?: {
    type: DismissalType
    batsmanOutId: string
    fielderId?: string
  }
  /** Did strike rotate after this ball (excluding end-of-over swap). */
  rotatedStrike: boolean
  /** Human-readable summary, e.g. "1", "FOUR", "WD+2", "W (bowled)". */
  display: string
  timestamp: number
}

export type BatsmanCard = {
  uid: string
  name: string
  runs: number
  ballsFaced: number
  fours: number
  sixes: number
  status: 'YET_TO_BAT' | 'NOT_OUT' | 'OUT' | 'RETIRED_HURT'
  dismissal?: {
    type: DismissalType
    bowlerId?: string
    bowlerName?: string
    fielderId?: string
    fielderName?: string
    text: string
  }
  battingOrder: number
}

export type BowlerCard = {
  uid: string
  name: string
  ballsBowled: number
  runsConceded: number
  wickets: number
  maidens: number
  dotBalls: number
  fours: number
  sixes: number
  noBalls: number
  wides: number
  /** 1-based order in which this bowler first bowled in the innings. */
  bowlingOrder: number
}

export type FallOfWicket = {
  wicketNumber: number
  totalRuns: number
  oversText: string
  batsmanOutId: string
  batsmanOutName: string
}

export type InningsState = {
  inningsNumber: 1 | 2
  battingTeamId: string
  battingTeamName: string
  bowlingTeamId: string
  bowlingTeamName: string
  oversLimit: number
  /** Total runs scored. */
  runs: number
  wickets: number
  /** Total *legal* balls bowled in this innings. */
  legalBalls: number
  /** Number of legal balls already bowled in the over currently in progress (0..5). */
  ballsInCurrentOver: number
  /** 1-based over number currently in progress. */
  currentOverNumber: number
  extras: {
    wides: number
    noBalls: number
    byes: number
    legByes: number
    /** wides + noBalls + byes + legByes; cached for display. */
    total: number
  }
  strikerId: string | null
  nonStrikerId: string | null
  currentBowlerId: string | null
  /** Bowler of the previous over; cannot bowl two consecutive overs. */
  previousBowlerId: string | null
  battingCards: Record<string, BatsmanCard>
  bowlingCards: Record<string, BowlerCard>
  fallOfWickets: FallOfWicket[]
  /** All deliveries this innings, in order. Used for both display and replay. */
  events: BallEvent[]
  closed: boolean
  /** Set when innings is closed; explains why. */
  closedReason?: 'OVERS_OUT' | 'ALL_OUT' | 'TARGET_REACHED'
}

export type LiveMatchStatus =
  | 'TOSS'
  | 'NEED_OPENERS_1'
  | 'NEED_OPENING_BOWLER_1'
  | 'INNINGS_1'
  | 'BREAK'
  | 'NEED_OPENERS_2'
  | 'NEED_OPENING_BOWLER_2'
  | 'INNINGS_2'
  | 'COMPLETED'
  | 'DISCARDED'

export type LiveMatchPlayer = {
  uid: string
  name: string
}

export type LiveMatchTeam = {
  id: string
  name: string
  players: LiveMatchPlayer[]
}

export type LiveMatchResult = {
  winnerTeamId: string | null
  winnerLabel: string
  margin: 'runs' | 'wickets' | 'tie' | 'discarded'
  marginValue: number
  manOfTheMatchUid?: string
  manOfTheMatchName?: string
  summary: string
  finalisedAt: number
}

export type LiveMatchRecord = {
  /** liveMatch id; convention is `${tournamentId}__${matchId}`. */
  id: string
  tournamentId: string
  tournamentName: string
  matchId: string
  matchLabel: string
  oversPerInnings: number
  teamA: LiveMatchTeam
  teamB: LiveMatchTeam
  status: LiveMatchStatus
  battingFirstTeamId?: string
  /** Target the chasing team must reach (= innings1.runs + 1). */
  target?: number
  innings1?: InningsState
  innings2?: InningsState
  result?: LiveMatchResult
  startedAt: number
  endedAt?: number
  scorerAdminUid: string
}

/* ---------- Helpers (pure) ---------- */

/** Format a legal-ball count as cricket overs string, e.g. 13 → "2.1". */
export function ballsToOversText(legalBalls: number): string {
  const overs = Math.floor(legalBalls / 6)
  const balls = legalBalls % 6
  return `${overs}.${balls}`
}

/** Convert legal balls to overs as a decimal (cricket-style: 2.1 = 2 overs 1 ball). */
export function ballsToOversDecimal(legalBalls: number): number {
  const overs = Math.floor(legalBalls / 6)
  const balls = legalBalls % 6
  return Number(`${overs}.${balls}`)
}

export function safeRunRate(runs: number, legalBalls: number): number {
  if (legalBalls <= 0) return 0
  return Number(((runs * 6) / legalBalls).toFixed(2))
}
