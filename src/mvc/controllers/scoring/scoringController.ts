/**
 * Cricket scoring engine. Implements ICC scoring rules used in T20/ODI:
 *
 * Legal vs illegal deliveries
 *   - WIDE / NO_BALL: illegal. They DO NOT count toward the over and the
 *     ball is re-bowled. Both add a 1-run penalty + any additional runs
 *     taken between the wickets (and bat-runs on no-balls go to the
 *     batsman). Both are charged to the bowler.
 *   - RUN, BYE, LEG_BYE, WICKET (caught/bowled/lbw/stumped/hit-wicket/
 *     run-out on a regular ball): legal. They count toward the over.
 *
 * Strike rotation
 *   - Strike rotates whenever an *odd* number of batsmen-runs is taken on
 *     a delivery (off the bat, off byes/leg-byes, or completed runs on
 *     a run-out / on a wide).
 *   - At the end of every over the strike swaps automatically.
 *   - On non run-out wickets, the striker is dismissed; the new batsman
 *     comes in as striker (no strike rotation on that ball).
 *
 * Maidens
 *   - An over counts as a maiden for the bowler when 0 runs are charged
 *     to the bowler in that over (byes/leg-byes do not break a maiden,
 *     but wides, no-balls and any bat-runs/boundaries do).
 *
 * Innings end
 *   - All 10 wickets fall (i.e. only 1 batsman remains undismissed), or
 *   - The over limit is reached, or
 *   - In the second innings: target is reached.
 */

import {
  ballsToOversText,
  type BallEvent,
  type BatsmanCard,
  type BowlerCard,
  type DismissalType,
  type InningsState,
  type LiveMatchRecord,
  type LiveMatchTeam,
} from '../../models/scoring/Scoring'
import {
  getLiveMatchFromDb,
  liveMatchIdFor,
  setLiveMatchInDb,
  updateLiveMatchInDb,
} from '../../models/firebase/liveMatchRepository'

/* ---------- helpers ---------- */

function nameOf(team: LiveMatchTeam, uid: string): string {
  return team.players.find((p) => p.uid === uid)?.name ?? 'Player'
}

function blankBatsman(
  uid: string,
  name: string,
  battingOrder: number,
  status: BatsmanCard['status'] = 'YET_TO_BAT',
): BatsmanCard {
  return {
    uid,
    name,
    runs: 0,
    ballsFaced: 0,
    fours: 0,
    sixes: 0,
    status,
    battingOrder,
  }
}

function blankBowler(
  uid: string,
  name: string,
  bowlingOrder: number,
): BowlerCard {
  return {
    uid,
    name,
    ballsBowled: 0,
    runsConceded: 0,
    wickets: 0,
    maidens: 0,
    dotBalls: 0,
    fours: 0,
    sixes: 0,
    noBalls: 0,
    wides: 0,
    bowlingOrder,
  }
}

function ensureBowler(
  innings: InningsState,
  bowlerId: string,
  bowlingTeam: LiveMatchTeam,
): BowlerCard {
  if (innings.bowlingCards[bowlerId]) return innings.bowlingCards[bowlerId]
  const order = Object.keys(innings.bowlingCards).length + 1
  const card = blankBowler(bowlerId, nameOf(bowlingTeam, bowlerId), order)
  innings.bowlingCards[bowlerId] = card
  return card
}

function activateBatsman(
  innings: InningsState,
  uid: string,
  battingTeam: LiveMatchTeam,
): BatsmanCard {
  let card = innings.battingCards[uid]
  if (!card) {
    const order = Object.keys(innings.battingCards).length + 1
    card = blankBatsman(uid, nameOf(battingTeam, uid), order, 'NOT_OUT')
    innings.battingCards[uid] = card
  } else if (card.status === 'YET_TO_BAT') {
    card.status = 'NOT_OUT'
  }
  return card
}

function rotateStrike(innings: InningsState) {
  const tmp = innings.strikerId
  innings.strikerId = innings.nonStrikerId
  innings.nonStrikerId = tmp
}

function nextEventId(): string {
  return `b_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

/** Players from the batting side that have not batted yet AND are not on the field. */
export function getYetToBatList(
  innings: InningsState,
  battingTeam: LiveMatchTeam,
): { uid: string; name: string }[] {
  const onField = new Set(
    [innings.strikerId, innings.nonStrikerId].filter((x): x is string => Boolean(x)),
  )
  return battingTeam.players.filter((p) => {
    const card = innings.battingCards[p.uid]
    if (onField.has(p.uid)) return false
    if (!card) return true
    return card.status === 'YET_TO_BAT'
  })
}

/** Total wickets allowed to fall: team size - 1 (last man cannot bat alone). */
export function maxWicketsFor(team: LiveMatchTeam): number {
  return Math.max(0, team.players.length - 1)
}

function isInningsClosing(
  innings: InningsState,
  battingTeam: LiveMatchTeam,
  target: number | null,
): InningsState['closedReason'] | null {
  if (innings.runs >= (target ?? Infinity)) return 'TARGET_REACHED'
  if (innings.wickets >= maxWicketsFor(battingTeam)) return 'ALL_OUT'
  if (innings.legalBalls >= innings.oversLimit * 6) return 'OVERS_OUT'
  return null
}

/* ---------- create / setup ---------- */

export type CreateLiveMatchInput = {
  tournamentId: string
  tournamentName: string
  matchId: string
  matchLabel: string
  oversPerInnings: number
  teamA: LiveMatchTeam
  teamB: LiveMatchTeam
  scorerAdminUid: string
}

export async function createLiveMatch(
  input: CreateLiveMatchInput,
): Promise<LiveMatchRecord> {
  const id = liveMatchIdFor(input.tournamentId, input.matchId)
  const existing = await getLiveMatchFromDb(id)
  if (existing) return existing

  const record: LiveMatchRecord = {
    id,
    tournamentId: input.tournamentId,
    tournamentName: input.tournamentName,
    matchId: input.matchId,
    matchLabel: input.matchLabel,
    oversPerInnings: input.oversPerInnings,
    teamA: input.teamA,
    teamB: input.teamB,
    status: 'TOSS',
    startedAt: Date.now(),
    scorerAdminUid: input.scorerAdminUid,
  }
  await setLiveMatchInDb(record)
  return record
}

export async function setBattingFirst(params: {
  liveMatchId: string
  battingFirstTeamId: string
}): Promise<LiveMatchRecord> {
  const m = await getLiveMatchFromDb(params.liveMatchId)
  if (!m) throw new Error('Live match not found.')
  if (m.status !== 'TOSS') throw new Error('Toss already complete.')
  if (
    params.battingFirstTeamId !== m.teamA.id &&
    params.battingFirstTeamId !== m.teamB.id
  ) {
    throw new Error('Invalid team selected.')
  }

  m.battingFirstTeamId = params.battingFirstTeamId
  m.status = 'NEED_OPENERS_1'
  await setLiveMatchInDb(m)
  return m
}

function emptyInnings(
  inningsNumber: 1 | 2,
  oversLimit: number,
  battingTeam: LiveMatchTeam,
  bowlingTeam: LiveMatchTeam,
): InningsState {
  return {
    inningsNumber,
    battingTeamId: battingTeam.id,
    battingTeamName: battingTeam.name,
    bowlingTeamId: bowlingTeam.id,
    bowlingTeamName: bowlingTeam.name,
    oversLimit,
    runs: 0,
    wickets: 0,
    legalBalls: 0,
    ballsInCurrentOver: 0,
    currentOverNumber: 1,
    extras: { wides: 0, noBalls: 0, byes: 0, legByes: 0, total: 0 },
    strikerId: null,
    nonStrikerId: null,
    currentBowlerId: null,
    previousBowlerId: null,
    battingCards: {},
    bowlingCards: {},
    fallOfWickets: [],
    events: [],
    closed: false,
  }
}

function teamsForInnings(m: LiveMatchRecord, inningsNumber: 1 | 2) {
  if (!m.battingFirstTeamId) throw new Error('Toss not done yet.')
  const battingFirstIsA = m.battingFirstTeamId === m.teamA.id
  const battingFirst = battingFirstIsA ? m.teamA : m.teamB
  const bowlingFirst = battingFirstIsA ? m.teamB : m.teamA
  if (inningsNumber === 1) return { batting: battingFirst, bowling: bowlingFirst }
  return { batting: bowlingFirst, bowling: battingFirst }
}

export async function setOpeningBatsmen(params: {
  liveMatchId: string
  inningsNumber: 1 | 2
  strikerId: string
  nonStrikerId: string
}): Promise<LiveMatchRecord> {
  const m = await getLiveMatchFromDb(params.liveMatchId)
  if (!m) throw new Error('Live match not found.')

  const expectedStatus =
    params.inningsNumber === 1 ? 'NEED_OPENERS_1' : 'NEED_OPENERS_2'
  if (m.status !== expectedStatus) {
    throw new Error('Cannot set openers in current state.')
  }
  if (params.strikerId === params.nonStrikerId) {
    throw new Error('Striker and non-striker must be different players.')
  }

  const { batting, bowling } = teamsForInnings(m, params.inningsNumber)
  const teamUids = new Set(batting.players.map((p) => p.uid))
  if (!teamUids.has(params.strikerId) || !teamUids.has(params.nonStrikerId)) {
    throw new Error('Both openers must belong to the batting team.')
  }

  const innings =
    (params.inningsNumber === 1 ? m.innings1 : m.innings2) ??
    emptyInnings(params.inningsNumber, m.oversPerInnings, batting, bowling)

  const striker = activateBatsman(innings, params.strikerId, batting)
  const nonStriker = activateBatsman(innings, params.nonStrikerId, batting)
  // Force "NOT_OUT" for both openers.
  striker.status = 'NOT_OUT'
  nonStriker.status = 'NOT_OUT'
  innings.strikerId = striker.uid
  innings.nonStrikerId = nonStriker.uid

  if (params.inningsNumber === 1) m.innings1 = innings
  else m.innings2 = innings

  m.status =
    params.inningsNumber === 1 ? 'NEED_OPENING_BOWLER_1' : 'NEED_OPENING_BOWLER_2'

  await setLiveMatchInDb(m)
  return m
}

export async function setOpeningBowler(params: {
  liveMatchId: string
  inningsNumber: 1 | 2
  bowlerId: string
}): Promise<LiveMatchRecord> {
  const m = await getLiveMatchFromDb(params.liveMatchId)
  if (!m) throw new Error('Live match not found.')

  const expectedStatus =
    params.inningsNumber === 1
      ? 'NEED_OPENING_BOWLER_1'
      : 'NEED_OPENING_BOWLER_2'
  if (m.status !== expectedStatus) {
    throw new Error('Cannot set opening bowler in current state.')
  }

  const { batting, bowling } = teamsForInnings(m, params.inningsNumber)
  if (!bowling.players.some((p) => p.uid === params.bowlerId)) {
    throw new Error('Bowler must be from the bowling team.')
  }

  const innings = params.inningsNumber === 1 ? m.innings1 : m.innings2
  if (!innings) throw new Error('Innings not initialised.')

  ensureBowler(innings, params.bowlerId, bowling)
  innings.currentBowlerId = params.bowlerId

  void batting // referenced for type-narrowing intent / future use

  m.status = params.inningsNumber === 1 ? 'INNINGS_1' : 'INNINGS_2'
  await setLiveMatchInDb(m)
  return m
}

/* ---------- the ball processor ---------- */

export type RecordBallInput =
  | { type: 'RUN'; runs: 0 | 1 | 2 | 3 | 4 | 5 | 6 }
  | { type: 'WIDE'; additionalRuns: number }
  | { type: 'NO_BALL'; batRuns: number }
  | { type: 'BYE'; runs: number }
  | { type: 'LEG_BYE'; runs: number }
  | {
      type: 'WICKET'
      dismissalType: DismissalType
      /** Defaults to the current striker if omitted. Required for run-out off non-striker. */
      batsmanOutId?: string
      fielderId?: string
      /** Runs completed before the run-out (legal delivery only). Defaults to 0. */
      runsCompletedBeforeOut?: number
    }

export type RecordBallResult = {
  /** Updated match record (also persisted). */
  match: LiveMatchRecord
  /** Set when an event finished the over (admin must pick next bowler). */
  awaitingNewBowler: boolean
  /** Set when a wicket fell and a new batsman is needed. */
  awaitingNewBatsman: boolean
  /** Set when innings just closed. */
  inningsClosed: boolean
  /** Set when the entire match has just been decided (after applying this ball). */
  matchDecided: boolean
}

export async function recordBall(params: {
  liveMatchId: string
  input: RecordBallInput
}): Promise<RecordBallResult> {
  const m = await getLiveMatchFromDb(params.liveMatchId)
  if (!m) throw new Error('Live match not found.')

  if (m.status !== 'INNINGS_1' && m.status !== 'INNINGS_2') {
    throw new Error('Cannot record ball: match is not actively in play.')
  }

  const inningsNumber = m.status === 'INNINGS_1' ? 1 : 2
  const innings = inningsNumber === 1 ? m.innings1 : m.innings2
  if (!innings) throw new Error('Innings not initialised.')
  if (innings.closed) throw new Error('Innings already closed.')

  if (!innings.strikerId || !innings.nonStrikerId || !innings.currentBowlerId) {
    throw new Error('Striker, non-striker and bowler must all be assigned.')
  }

  const { batting, bowling } = teamsForInnings(m, inningsNumber)
  const target = inningsNumber === 2 && m.target ? m.target : null

  const striker = innings.battingCards[innings.strikerId]
  const nonStriker = innings.battingCards[innings.nonStrikerId]
  const bowler = ensureBowler(innings, innings.currentBowlerId, bowling)
  if (!striker || !nonStriker) throw new Error('Batsman cards missing.')

  /* ---------- compute deltas based on event type ---------- */

  let isLegal = true
  let runsToTeam = 0 // total runs added to team score (incl. extras)
  let runsToBat = 0 // runs credited to striker
  let runsToBowlerCharge = 0 // runs charged to bowler (for economy/maiden)
  let extrasWides = 0
  let extrasNoBalls = 0
  let extrasByes = 0
  let extrasLegByes = 0
  let isFour = false
  let isSix = false
  let willRotateStrike = false
  let display = ''
  let wicket: BallEvent['wicket'] | undefined
  let dismissalForCard: BatsmanCard['dismissal'] | undefined

  const input = params.input

  switch (input.type) {
    case 'RUN': {
      if (input.runs < 0 || input.runs > 6) throw new Error('Invalid runs.')
      isLegal = true
      runsToTeam = input.runs
      runsToBat = input.runs
      runsToBowlerCharge = input.runs
      isFour = input.runs === 4
      isSix = input.runs === 6
      willRotateStrike = input.runs % 2 === 1
      display =
        input.runs === 0
          ? '•'
          : input.runs === 4
          ? 'FOUR'
          : input.runs === 6
          ? 'SIX'
          : `${input.runs}`
      break
    }
    case 'WIDE': {
      if (input.additionalRuns < 0) throw new Error('Invalid wide.')
      isLegal = false
      const total = 1 + input.additionalRuns
      runsToTeam = total
      runsToBowlerCharge = total
      extrasWides = total
      // additionalRuns are runs the batsmen actually ran; odd → swap.
      willRotateStrike = input.additionalRuns % 2 === 1
      display = input.additionalRuns > 0 ? `WD+${input.additionalRuns}` : 'WD'
      break
    }
    case 'NO_BALL': {
      if (input.batRuns < 0 || input.batRuns > 6) throw new Error('Invalid no-ball.')
      isLegal = false
      const total = 1 + input.batRuns
      runsToTeam = total
      runsToBat = input.batRuns
      runsToBowlerCharge = total
      extrasNoBalls = 1
      isFour = input.batRuns === 4
      isSix = input.batRuns === 6
      willRotateStrike = input.batRuns % 2 === 1
      display = input.batRuns > 0 ? `NB+${input.batRuns}` : 'NB'
      break
    }
    case 'BYE': {
      if (input.runs <= 0) throw new Error('Bye must score at least 1 run.')
      isLegal = true
      runsToTeam = input.runs
      extrasByes = input.runs
      // Byes do NOT charge the bowler.
      willRotateStrike = input.runs % 2 === 1
      display = `B+${input.runs}`
      break
    }
    case 'LEG_BYE': {
      if (input.runs <= 0) throw new Error('Leg-bye must score at least 1 run.')
      isLegal = true
      runsToTeam = input.runs
      extrasLegByes = input.runs
      willRotateStrike = input.runs % 2 === 1
      display = `LB+${input.runs}`
      break
    }
    case 'WICKET': {
      // Wickets are recorded on legal deliveries here (run-out / bowled / etc).
      isLegal = true
      const runsCompleted = input.runsCompletedBeforeOut ?? 0
      if (runsCompleted < 0 || runsCompleted > 6) {
        throw new Error('Invalid runs completed.')
      }
      const outId = input.batsmanOutId ?? innings.strikerId
      if (outId !== innings.strikerId && outId !== innings.nonStrikerId) {
        throw new Error('Out batsman must be currently on field.')
      }
      if (
        input.dismissalType !== 'RUN_OUT' &&
        outId !== innings.strikerId
      ) {
        throw new Error('Only the striker can be dismissed by this method.')
      }
      // Runs completed go to team total (and to striker if not 0).
      runsToTeam = runsCompleted
      runsToBat = runsCompleted
      runsToBowlerCharge = runsCompleted
      isFour = false
      isSix = false
      willRotateStrike = runsCompleted % 2 === 1

      const fielderName = input.fielderId
        ? nameOf(bowling, input.fielderId)
        : undefined
      const text = buildDismissalText(
        input.dismissalType,
        bowler.name,
        fielderName,
      )
      wicket = {
        type: input.dismissalType,
        batsmanOutId: outId,
        fielderId: input.fielderId,
      }
      dismissalForCard = {
        type: input.dismissalType,
        bowlerId: input.dismissalType === 'RUN_OUT' ? undefined : bowler.uid,
        bowlerName:
          input.dismissalType === 'RUN_OUT' ? undefined : bowler.name,
        fielderId: input.fielderId,
        fielderName,
        text,
      }
      display = runsCompleted > 0 ? `W+${runsCompleted}` : 'W'
      break
    }
  }

  /* ---------- mutate state ---------- */

  innings.runs += runsToTeam
  innings.extras.wides += extrasWides
  innings.extras.noBalls += extrasNoBalls
  innings.extras.byes += extrasByes
  innings.extras.legByes += extrasLegByes
  innings.extras.total =
    innings.extras.wides +
    innings.extras.noBalls +
    innings.extras.byes +
    innings.extras.legByes

  // Striker stats
  if (input.type === 'RUN' || input.type === 'NO_BALL') {
    striker.runs += runsToBat
    if (isFour) striker.fours += 1
    if (isSix) striker.sixes += 1
  } else if (input.type === 'WICKET') {
    if (runsToBat > 0) striker.runs += runsToBat
  }
  // Batsman balls-faced: counts ONLY for legal deliveries that aren't byes/leg-byes/wides.
  // (No-balls do count as a ball faced; byes/leg-byes also count per ICC.)
  if (input.type === 'RUN' || input.type === 'BYE' || input.type === 'LEG_BYE') {
    striker.ballsFaced += 1
  }
  if (input.type === 'WICKET') {
    // Striker faces this delivery whether bowled / lbw / etc; for run-out
    // the striker still faced it.
    striker.ballsFaced += 1
  }

  // Bowler stats
  bowler.runsConceded += runsToBowlerCharge
  if (extrasWides > 0) bowler.wides += extrasWides
  if (extrasNoBalls > 0) bowler.noBalls += extrasNoBalls
  if (isLegal) bowler.ballsBowled += 1
  if (isFour) bowler.fours += 1
  if (isSix) bowler.sixes += 1
  if (input.type === 'RUN' && input.runs === 0) bowler.dotBalls += 1

  // Apply over-progression for legal deliveries.
  if (isLegal) {
    innings.legalBalls += 1
    innings.ballsInCurrentOver += 1
  }

  // Apply wicket bookkeeping (after striker stats so we capture last-ball runs).
  let wicketFell = false
  if (input.type === 'WICKET') {
    wicketFell = true
    innings.wickets += 1

    const outId = wicket!.batsmanOutId
    const outCard = innings.battingCards[outId]
    if (outCard) {
      outCard.status = 'OUT'
      outCard.dismissal = dismissalForCard
    }
    innings.fallOfWickets.push({
      wicketNumber: innings.wickets,
      totalRuns: innings.runs,
      oversText: ballsToOversText(innings.legalBalls),
      batsmanOutId: outId,
      batsmanOutName: outCard?.name ?? 'Player',
    })

    // Bowler credit: not credited for run-out.
    if (input.dismissalType !== 'RUN_OUT') {
      bowler.wickets += 1
    }

    // Replace the dismissed batsman immediately with a placeholder so
    // strike rotation is correct; the admin will provide the real new
    // batsman via selectNewBatsman.
    if (outId === innings.strikerId) {
      innings.strikerId = null
    } else {
      innings.nonStrikerId = null
    }
  }

  // Apply strike rotation (mid-ball, before end-of-over swap).
  if (willRotateStrike && !wicketFell) {
    rotateStrike(innings)
  }
  if (willRotateStrike && wicketFell) {
    // For run-out with odd runs completed, the surviving batsman ends up
    // at the dismissed batsman's end. The new batsman comes in at the
    // *other* end. Equivalent: swap "alive batsman" position.
    if (innings.strikerId === null && innings.nonStrikerId !== null) {
      innings.strikerId = innings.nonStrikerId
      innings.nonStrikerId = null
    } else if (
      innings.nonStrikerId === null &&
      innings.strikerId !== null
    ) {
      innings.nonStrikerId = innings.strikerId
      innings.strikerId = null
    }
  }

  // Push the ball event.
  const event: BallEvent = {
    id: nextEventId(),
    innings: inningsNumber,
    battingTeamId: batting.id,
    bowlingTeamId: bowling.id,
    overNumber: innings.currentOverNumber,
    ballInOverDisplay: innings.ballsInCurrentOver, // 0 if illegal
    isLegal,
    bowlerId: bowler.uid,
    strikerId: striker.uid,
    nonStrikerId: nonStriker.uid,
    type: input.type,
    runs:
      input.type === 'RUN'
        ? input.runs
        : input.type === 'WIDE'
        ? input.additionalRuns
        : input.type === 'NO_BALL'
        ? input.batRuns
        : input.type === 'BYE' || input.type === 'LEG_BYE'
        ? input.runs
        : input.type === 'WICKET'
        ? input.runsCompletedBeforeOut ?? 0
        : 0,
    totalRunsThisBall: runsToTeam,
    wicket,
    rotatedStrike: willRotateStrike,
    display,
    timestamp: Date.now(),
  }
  innings.events.push(event)

  /* ---------- end-of-over handling ---------- */

  let awaitingNewBowler = false
  let overEndedInClosingInnings = false
  if (innings.ballsInCurrentOver >= 6) {
    // Compute maiden: bowler's runs charged in this completed over === 0?
    const overEvents = innings.events.filter(
      (e) => e.overNumber === innings.currentOverNumber,
    )
    const bowlerRunsThisOver = overEvents.reduce((acc, e) => {
      // Bowler is charged for runs except byes/leg-byes.
      if (e.type === 'BYE' || e.type === 'LEG_BYE') return acc
      return acc + e.totalRunsThisBall
    }, 0)
    if (bowlerRunsThisOver === 0) {
      bowler.maidens += 1
    }

    // Move to next over.
    innings.previousBowlerId = innings.currentBowlerId
    innings.currentBowlerId = null
    innings.currentOverNumber += 1
    innings.ballsInCurrentOver = 0

    // End-of-over strike swap.
    rotateStrike(innings)

    awaitingNewBowler = true
    overEndedInClosingInnings = true
  }

  /* ---------- innings closure ---------- */

  const closingReason = isInningsClosing(innings, batting, target)
  let inningsClosed = false
  let matchDecided = false
  if (closingReason) {
    innings.closed = true
    innings.closedReason = closingReason
    inningsClosed = true
    awaitingNewBowler = false // no need; innings done

    if (inningsNumber === 1) {
      m.target = innings.runs + 1
      m.status = 'BREAK'
    } else {
      m.status = 'COMPLETED'
      m.endedAt = Date.now()
      matchDecided = true
      m.result = computeResult(m)
    }
  }

  // If after a wicket, no replacement batsman has been chosen yet AND innings
  // not closed, signal the admin to pick one.
  let awaitingNewBatsman =
    wicketFell &&
    !inningsClosed &&
    (innings.strikerId === null || innings.nonStrikerId === null)

  if (overEndedInClosingInnings && !inningsClosed) {
    awaitingNewBowler = true
  } else if (inningsClosed) {
    awaitingNewBowler = false
    awaitingNewBatsman = false
  }

  if (inningsNumber === 1) m.innings1 = innings
  else m.innings2 = innings

  await setLiveMatchInDb(m)

  return {
    match: m,
    awaitingNewBowler,
    awaitingNewBatsman,
    inningsClosed,
    matchDecided,
  }
}

function buildDismissalText(
  type: DismissalType,
  bowlerName: string,
  fielderName?: string,
): string {
  switch (type) {
    case 'BOWLED':
      return `b ${bowlerName}`
    case 'CAUGHT':
      return fielderName
        ? `c ${fielderName} b ${bowlerName}`
        : `c & b ${bowlerName}`
    case 'LBW':
      return `lbw b ${bowlerName}`
    case 'STUMPED':
      return fielderName ? `st ${fielderName} b ${bowlerName}` : `st b ${bowlerName}`
    case 'HIT_WICKET':
      return `hit wicket b ${bowlerName}`
    case 'RUN_OUT':
      return fielderName ? `run out (${fielderName})` : 'run out'
  }
}

/* ---------- post-ball follow-ups ---------- */

export async function selectNewBatsman(params: {
  liveMatchId: string
  newBatsmanUid: string
}): Promise<LiveMatchRecord> {
  const m = await getLiveMatchFromDb(params.liveMatchId)
  if (!m) throw new Error('Live match not found.')

  const inningsNumber = m.status === 'INNINGS_1' || m.status === 'NEED_OPENING_BOWLER_1' ? 1 : 2
  const innings = inningsNumber === 1 ? m.innings1 : m.innings2
  if (!innings) throw new Error('Innings not initialised.')
  if (innings.closed) throw new Error('Innings already closed.')

  const { batting } = teamsForInnings(m, inningsNumber)
  if (!batting.players.some((p) => p.uid === params.newBatsmanUid)) {
    throw new Error('New batsman must be from the batting team.')
  }
  if (innings.battingCards[params.newBatsmanUid]?.status === 'OUT') {
    throw new Error('That batsman is already out.')
  }
  if (
    innings.strikerId === params.newBatsmanUid ||
    innings.nonStrikerId === params.newBatsmanUid
  ) {
    throw new Error('Player is already on the field.')
  }

  activateBatsman(innings, params.newBatsmanUid, batting)

  if (innings.strikerId === null) {
    innings.strikerId = params.newBatsmanUid
  } else if (innings.nonStrikerId === null) {
    innings.nonStrikerId = params.newBatsmanUid
  } else {
    throw new Error('Both batsmen are already on the field.')
  }

  if (inningsNumber === 1) m.innings1 = innings
  else m.innings2 = innings
  await setLiveMatchInDb(m)
  return m
}

export async function selectNextBowler(params: {
  liveMatchId: string
  bowlerId: string
}): Promise<LiveMatchRecord> {
  const m = await getLiveMatchFromDb(params.liveMatchId)
  if (!m) throw new Error('Live match not found.')
  if (m.status !== 'INNINGS_1' && m.status !== 'INNINGS_2') {
    throw new Error('Cannot pick bowler in current state.')
  }
  const inningsNumber = m.status === 'INNINGS_1' ? 1 : 2
  const innings = inningsNumber === 1 ? m.innings1 : m.innings2
  if (!innings) throw new Error('Innings not initialised.')
  if (innings.closed) throw new Error('Innings already closed.')
  if (innings.currentBowlerId) {
    throw new Error('Current over still has an assigned bowler.')
  }

  const { bowling } = teamsForInnings(m, inningsNumber)
  if (!bowling.players.some((p) => p.uid === params.bowlerId)) {
    throw new Error('Bowler must be from the bowling team.')
  }
  if (params.bowlerId === innings.previousBowlerId) {
    throw new Error('A bowler cannot bowl two consecutive overs.')
  }

  ensureBowler(innings, params.bowlerId, bowling)
  innings.currentBowlerId = params.bowlerId

  if (inningsNumber === 1) m.innings1 = innings
  else m.innings2 = innings
  await setLiveMatchInDb(m)
  return m
}

/* ---------- innings-2 transition ---------- */

export async function startInnings2(params: {
  liveMatchId: string
}): Promise<LiveMatchRecord> {
  const m = await getLiveMatchFromDb(params.liveMatchId)
  if (!m) throw new Error('Live match not found.')
  if (m.status !== 'BREAK') throw new Error('Innings 1 has not closed yet.')

  const { batting, bowling } = teamsForInnings(m, 2)
  m.innings2 = emptyInnings(2, m.oversPerInnings, batting, bowling)
  m.status = 'NEED_OPENERS_2'

  await setLiveMatchInDb(m)
  return m
}

/* ---------- result + discard ---------- */

function computeResult(m: LiveMatchRecord): LiveMatchRecord['result'] {
  const i1 = m.innings1
  const i2 = m.innings2
  if (!i1 || !i2) {
    return {
      winnerTeamId: null,
      winnerLabel: 'No result',
      margin: 'tie',
      marginValue: 0,
      summary: 'Match could not be decided.',
      finalisedAt: Date.now(),
    }
  }

  if (i2.runs > i1.runs) {
    const wicketsRemaining = maxWicketsFor(
      teamsForInnings(m, 2).batting,
    ) - i2.wickets
    return {
      winnerTeamId: i2.battingTeamId,
      winnerLabel: i2.battingTeamName,
      margin: 'wickets',
      marginValue: wicketsRemaining,
      summary: `${i2.battingTeamName} won by ${wicketsRemaining} wicket${wicketsRemaining === 1 ? '' : 's'}.`,
      finalisedAt: Date.now(),
    }
  }
  if (i1.runs > i2.runs) {
    const margin = i1.runs - i2.runs
    return {
      winnerTeamId: i1.battingTeamId,
      winnerLabel: i1.battingTeamName,
      margin: 'runs',
      marginValue: margin,
      summary: `${i1.battingTeamName} won by ${margin} run${margin === 1 ? '' : 's'}.`,
      finalisedAt: Date.now(),
    }
  }
  return {
    winnerTeamId: null,
    winnerLabel: 'Match tied',
    margin: 'tie',
    marginValue: 0,
    summary: `Match tied at ${i1.runs} runs.`,
    finalisedAt: Date.now(),
  }
}

export async function discardLiveMatch(params: {
  liveMatchId: string
  reason?: string
}): Promise<LiveMatchRecord> {
  const m = await getLiveMatchFromDb(params.liveMatchId)
  if (!m) throw new Error('Live match not found.')
  if (m.status === 'COMPLETED' || m.status === 'DISCARDED') {
    throw new Error('Match is already finalised.')
  }
  m.status = 'DISCARDED'
  m.endedAt = Date.now()
  m.result = {
    winnerTeamId: null,
    winnerLabel: 'Discarded',
    margin: 'discarded',
    marginValue: 0,
    summary: params.reason
      ? `Match discarded by admin: ${params.reason}`
      : 'Match discarded by admin.',
    finalisedAt: Date.now(),
  }
  await updateLiveMatchInDb(m.id, {
    status: m.status,
    endedAt: m.endedAt,
    result: m.result,
  })
  return m
}
