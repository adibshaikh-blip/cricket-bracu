import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../controllers/auth/useAuth'
import { getTournamentForManagement } from '../../controllers/tournaments/tournamentManagementController'
import {
  buildScoringSetup,
  type ScoringSetup,
} from '../../controllers/scoring/scoringSetupController'
import {
  createLiveMatch,
  discardLiveMatch,
  getYetToBatList,
  maxWicketsFor,
  recordBall,
  selectNewBatsman,
  selectNextBowler,
  setBattingFirst,
  setOpeningBatsmen,
  setOpeningBowler,
  startInnings2,
  type RecordBallInput,
} from '../../controllers/scoring/scoringController'
import { finalizeMatch } from '../../controllers/scoring/matchFinalizationController'
import {
  ballsToOversText,
  DISMISSAL_LABELS,
  safeRunRate,
  type BallEvent,
  type DismissalType,
  type InningsState,
  type LiveMatchRecord,
  type LiveMatchTeam,
} from '../../models/scoring/Scoring'
import { subscribeLiveMatch } from '../../models/firebase/liveMatchRepository'

type ModalState =
  | null
  | { kind: 'wide'; runs: number }
  | { kind: 'noball'; runs: number }
  | { kind: 'bye'; runs: number }
  | { kind: 'legbye'; runs: number }
  | {
      kind: 'wicket'
      dismissalType: DismissalType
      batsmanOutId: string
      fielderId: string
      runsCompleted: number
    }
  | { kind: 'newBatsman' }
  | { kind: 'newBowler' }
  | { kind: 'discard' }

export default function MatchScoringPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { tournamentId, matchId } = useParams<{
    tournamentId: string
    matchId: string
  }>()

  const [setup, setSetup] = useState<ScoringSetup | null>(null)
  const [match, setMatch] = useState<LiveMatchRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [modal, setModal] = useState<ModalState>(null)

  /* ---------- bootstrap ---------- */

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        if (!tournamentId || !matchId || !user) return
        const t = await getTournamentForManagement(tournamentId)
        if (!t) throw new Error('Tournament not found.')
        const matchRec = (t.matches ?? []).find((m) => m.id === matchId)
        if (!matchRec) throw new Error('Match not found.')

        const s = await buildScoringSetup({ tournament: t, match: matchRec })
        if (!active) return
        setSetup(s)

        const live = await createLiveMatch({
          tournamentId: t.id,
          tournamentName: t.tournamentName,
          matchId: matchRec.id,
          matchLabel: s.matchLabel,
          oversPerInnings: s.oversPerInnings,
          teamA: s.teamA,
          teamB: s.teamB,
          scorerAdminUid: user.uid,
        })
        if (!active) return
        setMatch(live)
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : 'Failed to load match')
        }
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => {
      active = false
    }
  }, [tournamentId, matchId, user])

  /* ---------- realtime subscription ---------- */

  useEffect(() => {
    if (!setup) return
    const unsub = subscribeLiveMatch(setup.liveMatchId, (rec) => {
      if (rec) setMatch(rec)
    })
    return unsub
  }, [setup])

  /* ---------- generic action wrapper ---------- */

  const action = useCallback(
    async (fn: () => Promise<unknown>) => {
      setBusy(true)
      setError(null)
      try {
        await fn()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Action failed.')
      } finally {
        setBusy(false)
      }
    },
    [],
  )

  /* ---------- derived state ---------- */

  const inningsNumber: 1 | 2 | null = useMemo(() => {
    if (!match) return null
    if (
      match.status === 'INNINGS_1' ||
      match.status === 'NEED_OPENERS_1' ||
      match.status === 'NEED_OPENING_BOWLER_1'
    ) {
      return 1
    }
    if (
      match.status === 'INNINGS_2' ||
      match.status === 'NEED_OPENERS_2' ||
      match.status === 'NEED_OPENING_BOWLER_2'
    ) {
      return 2
    }
    return null
  }, [match])

  const innings: InningsState | null = useMemo(() => {
    if (!match || !inningsNumber) return null
    return inningsNumber === 1 ? match.innings1 ?? null : match.innings2 ?? null
  }, [match, inningsNumber])

  const battingTeam: LiveMatchTeam | null = useMemo(() => {
    if (!match || !innings) return null
    return innings.battingTeamId === match.teamA.id ? match.teamA : match.teamB
  }, [match, innings])

  const bowlingTeam: LiveMatchTeam | null = useMemo(() => {
    if (!match || !innings) return null
    return innings.bowlingTeamId === match.teamA.id ? match.teamA : match.teamB
  }, [match, innings])

  /* ---------- rendering helpers ---------- */

  if (loading) return <div className="admin-page">Loading match...</div>
  if (error && !match) {
    return (
      <div className="admin-page">
        <h1 className="admin-title">Match Scoring</h1>
        <p className="admin-error">{error}</p>
        <Link to={`/admin/tournaments/${tournamentId}/manage`} className="admin-button">
          Back to tournament
        </Link>
      </div>
    )
  }
  if (!match || !setup) return <div className="admin-page">Match not available.</div>

  return (
    <div className="admin-page scoring-page">
      <ScoringHeader
        match={match}
        onDiscard={() => setModal({ kind: 'discard' })}
        onBack={() =>
          navigate(`/admin/tournaments/${match.tournamentId}/manage`)
        }
      />

      {error ? <p className="admin-error">{error}</p> : null}

      {match.status === 'TOSS' ? (
        <TossPanel match={match} action={action} />
      ) : null}

      {match.status === 'NEED_OPENERS_1' || match.status === 'NEED_OPENERS_2' ? (
        <OpenersPanel
          match={match}
          inningsNumber={match.status === 'NEED_OPENERS_1' ? 1 : 2}
          action={action}
          busy={busy}
        />
      ) : null}

      {match.status === 'NEED_OPENING_BOWLER_1' ||
      match.status === 'NEED_OPENING_BOWLER_2' ? (
        <OpeningBowlerPanel
          match={match}
          inningsNumber={match.status === 'NEED_OPENING_BOWLER_1' ? 1 : 2}
          action={action}
          busy={busy}
        />
      ) : null}

      {match.status === 'BREAK' ? (
        <InningsBreakPanel match={match} action={action} busy={busy} />
      ) : null}

      {(match.status === 'INNINGS_1' || match.status === 'INNINGS_2') &&
      innings &&
      battingTeam &&
      bowlingTeam ? (
        <ScoringLivePanel
          match={match}
          innings={innings}
          battingTeam={battingTeam}
          bowlingTeam={bowlingTeam}
          busy={busy}
          modal={modal}
          setModal={setModal}
          action={action}
        />
      ) : null}

      {(match.status === 'COMPLETED' || match.status === 'DISCARDED') ? (
        <FinalizePanel match={match} action={action} busy={busy} />
      ) : null}

      {modal?.kind === 'discard' ? (
        <ConfirmModal
          title="Discard match?"
          message="Discarding will end the match without updating player stats. This cannot be undone."
          confirmLabel="Discard match"
          danger
          onCancel={() => setModal(null)}
          onConfirm={async () => {
            setModal(null)
            await action(async () => {
              await discardLiveMatch({ liveMatchId: match.id })
            })
          }}
        />
      ) : null}
    </div>
  )
}

/* ============================================================
 *                     Component sub-views
 * ============================================================ */

function ScoringHeader({
  match,
  onDiscard,
  onBack,
}: {
  match: LiveMatchRecord
  onDiscard: () => void
  onBack: () => void
}) {
  return (
    <div className="admin-header">
      <div>
        <h1 className="admin-title">Match Scoring</h1>
        <p className="admin-muted">
          <b>{match.matchLabel}</b> · {match.oversPerInnings} overs · {match.tournamentName}
        </p>
      </div>
      <div className="admin-header-actions">
        <button className="admin-button" type="button" onClick={onBack}>
          Back
        </button>
        {match.status !== 'COMPLETED' && match.status !== 'DISCARDED' ? (
          <button className="admin-button danger" type="button" onClick={onDiscard}>
            Discard match
          </button>
        ) : null}
      </div>
    </div>
  )
}

function TossPanel({
  match,
  action,
}: {
  match: LiveMatchRecord
  action: (fn: () => Promise<unknown>) => Promise<void>
}) {
  return (
    <section className="admin-card admin-grid">
      <h2 className="section-title">Toss — who bats first?</h2>
      <p className="admin-muted">
        Pick the team that will bat first. The other team will bowl.
      </p>
      <div className="toss-grid">
        {[match.teamA, match.teamB].map((team) => (
          <button
            key={team.id}
            type="button"
            className="toss-card"
            onClick={() =>
              void action(async () => {
                await setBattingFirst({
                  liveMatchId: match.id,
                  battingFirstTeamId: team.id,
                })
              })
            }
          >
            <div className="toss-card-name">{team.name}</div>
            <div className="toss-card-meta">{team.players.length} players</div>
            <span className="status-badge ongoing">Bat first</span>
          </button>
        ))}
      </div>
    </section>
  )
}

function OpenersPanel({
  match,
  inningsNumber,
  action,
  busy,
}: {
  match: LiveMatchRecord
  inningsNumber: 1 | 2
  action: (fn: () => Promise<unknown>) => Promise<void>
  busy: boolean
}) {
  const battingTeam =
    match.battingFirstTeamId === undefined
      ? match.teamA
      : inningsNumber === 1
      ? match.teamA.id === match.battingFirstTeamId
        ? match.teamA
        : match.teamB
      : match.teamA.id === match.battingFirstTeamId
      ? match.teamB
      : match.teamA

  const [striker, setStriker] = useState<string>('')
  const [nonStriker, setNonStriker] = useState<string>('')

  return (
    <section className="admin-card admin-grid">
      <h2 className="section-title">
        Innings {inningsNumber} — pick openers ({battingTeam.name})
      </h2>
      <div className="admin-form-row">
        <label className="admin-label">
          Striker
          <select
            className="admin-select"
            value={striker}
            onChange={(e) => setStriker(e.target.value)}
          >
            <option value="">Select striker</option>
            {battingTeam.players.map((p) => (
              <option
                key={p.uid}
                value={p.uid}
                disabled={p.uid === nonStriker}
              >
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label className="admin-label">
          Non-striker
          <select
            className="admin-select"
            value={nonStriker}
            onChange={(e) => setNonStriker(e.target.value)}
          >
            <option value="">Select non-striker</option>
            {battingTeam.players.map((p) => (
              <option
                key={p.uid}
                value={p.uid}
                disabled={p.uid === striker}
              >
                {p.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <button
        className="admin-button primary"
        type="button"
        disabled={busy || !striker || !nonStriker || striker === nonStriker}
        onClick={() =>
          void action(async () => {
            await setOpeningBatsmen({
              liveMatchId: match.id,
              inningsNumber,
              strikerId: striker,
              nonStrikerId: nonStriker,
            })
          })
        }
      >
        Confirm openers
      </button>
    </section>
  )
}

function OpeningBowlerPanel({
  match,
  inningsNumber,
  action,
  busy,
}: {
  match: LiveMatchRecord
  inningsNumber: 1 | 2
  action: (fn: () => Promise<unknown>) => Promise<void>
  busy: boolean
}) {
  if (!match.battingFirstTeamId) return null
  const bowlingTeam =
    inningsNumber === 1
      ? match.teamA.id === match.battingFirstTeamId
        ? match.teamB
        : match.teamA
      : match.teamA.id === match.battingFirstTeamId
      ? match.teamA
      : match.teamB

  const [bowlerId, setBowlerId] = useState<string>('')

  return (
    <section className="admin-card admin-grid">
      <h2 className="section-title">
        Innings {inningsNumber} — pick opening bowler ({bowlingTeam.name})
      </h2>
      <div className="admin-form-row">
        <label className="admin-label">
          Opening bowler
          <select
            className="admin-select"
            value={bowlerId}
            onChange={(e) => setBowlerId(e.target.value)}
          >
            <option value="">Select bowler</option>
            {bowlingTeam.players.map((p) => (
              <option key={p.uid} value={p.uid}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <button
        className="admin-button primary"
        type="button"
        disabled={busy || !bowlerId}
        onClick={() =>
          void action(async () => {
            await setOpeningBowler({
              liveMatchId: match.id,
              inningsNumber,
              bowlerId,
            })
          })
        }
      >
        Start innings
      </button>
    </section>
  )
}

function InningsBreakPanel({
  match,
  action,
  busy,
}: {
  match: LiveMatchRecord
  action: (fn: () => Promise<unknown>) => Promise<void>
  busy: boolean
}) {
  const i1 = match.innings1
  return (
    <section className="admin-card admin-grid">
      <h2 className="section-title">Innings break</h2>
      {i1 ? (
        <div className="scoreboard">
          <div className="scoreboard-team">{i1.battingTeamName}</div>
          <div className="scoreboard-runs">
            {i1.runs}/{i1.wickets}
          </div>
          <div className="scoreboard-overs">
            ({ballsToOversText(i1.legalBalls)}/{i1.oversLimit})
          </div>
        </div>
      ) : null}
      <p className="admin-muted">
        Target: <b>{match.target}</b> for the chasing team to win.
      </p>
      <button
        className="admin-button primary"
        type="button"
        disabled={busy}
        onClick={() =>
          void action(async () => {
            await startInnings2({ liveMatchId: match.id })
          })
        }
      >
        Start 2nd innings
      </button>
    </section>
  )
}

function FinalizePanel({
  match,
  action,
  busy,
}: {
  match: LiveMatchRecord
  action: (fn: () => Promise<unknown>) => Promise<void>
  busy: boolean
}) {
  const [finalised, setFinalised] = useState(false)

  return (
    <section className="admin-card admin-grid">
      <h2 className="section-title">
        {match.status === 'COMPLETED' ? 'Match completed' : 'Match discarded'}
      </h2>
      {match.result ? (
        <p>
          <b>{match.result.summary}</b>
          {match.result.manOfTheMatchName ? (
            <>
              {' '}— Player of the Match:{' '}
              <b>{match.result.manOfTheMatchName}</b>
            </>
          ) : null}
        </p>
      ) : null}

      <FinalScoreboard match={match} />

      {finalised ? (
        <p className="admin-success">
          Match results saved. Player stats and points table have been updated.
        </p>
      ) : (
        <button
          className="admin-button primary"
          type="button"
          disabled={busy}
          onClick={() =>
            void action(async () => {
              await finalizeMatch({ liveMatchId: match.id })
              setFinalised(true)
            })
          }
        >
          {match.status === 'COMPLETED'
            ? 'Save results & update player stats'
            : 'Persist discarded result'}
        </button>
      )}
    </section>
  )
}

function FinalScoreboard({ match }: { match: LiveMatchRecord }) {
  return (
    <div className="final-scoreboard">
      {[match.innings1, match.innings2].map((inn, idx) =>
        inn ? (
          <div key={idx} className="scoreboard">
            <div className="scoreboard-team">{inn.battingTeamName}</div>
            <div className="scoreboard-runs">
              {inn.runs}/{inn.wickets}
            </div>
            <div className="scoreboard-overs">
              ({ballsToOversText(inn.legalBalls)})
            </div>
          </div>
        ) : null,
      )}
    </div>
  )
}

/* ---------- live scoring panel ---------- */

function ScoringLivePanel({
  match,
  innings,
  battingTeam,
  bowlingTeam,
  busy,
  modal,
  setModal,
  action,
}: {
  match: LiveMatchRecord
  innings: InningsState
  battingTeam: LiveMatchTeam
  bowlingTeam: LiveMatchTeam
  busy: boolean
  modal: ModalState
  setModal: (m: ModalState) => void
  action: (fn: () => Promise<unknown>) => Promise<void>
}) {
  const striker = innings.strikerId ? innings.battingCards[innings.strikerId] : null
  const nonStriker = innings.nonStrikerId
    ? innings.battingCards[innings.nonStrikerId]
    : null
  const bowler = innings.currentBowlerId
    ? innings.bowlingCards[innings.currentBowlerId]
    : null

  const recordBallSafe = async (input: RecordBallInput) => {
    await action(async () => {
      const r = await recordBall({ liveMatchId: match.id, input })
      // Modals are auto-opened by the parent based on resulting state. But
      // we can also open them explicitly for snappy UX.
      if (r.awaitingNewBatsman) setModal({ kind: 'newBatsman' })
      else if (r.awaitingNewBowler) setModal({ kind: 'newBowler' })
    })
  }

  const overEvents = innings.events.filter(
    (e) => e.overNumber === innings.currentOverNumber,
  )
  const lastOverEvents = innings.events.filter(
    (e) => e.overNumber === innings.currentOverNumber - 1,
  )

  return (
    <>
      <ScoringScoreboard match={match} innings={innings} />

      <BatsmenAndBowlerCards
        innings={innings}
        striker={striker ?? undefined}
        nonStriker={nonStriker ?? undefined}
        bowler={bowler ?? undefined}
      />

      <section className="admin-card admin-grid">
        <h2 className="section-title">This over · Over {innings.currentOverNumber}</h2>
        <div className="ball-strip">
          {overEvents.length === 0 ? (
            <span className="admin-muted">No balls bowled yet in this over.</span>
          ) : (
            overEvents.map((e) => <BallChip key={e.id} e={e} />)
          )}
        </div>
        {lastOverEvents.length > 0 ? (
          <>
            <h3 className="section-title" style={{ marginTop: 8, fontSize: '0.95rem' }}>
              Previous over
            </h3>
            <div className="ball-strip">
              {lastOverEvents.map((e) => (
                <BallChip key={e.id} e={e} />
              ))}
            </div>
          </>
        ) : null}
      </section>

      <section className="admin-card admin-grid">
        <h2 className="section-title">Score this delivery</h2>
        <div className="scoring-grid">
          {[0, 1, 2, 3, 4, 6].map((r) => (
            <button
              key={r}
              type="button"
              className={`score-btn ${r === 4 ? 'four' : ''} ${r === 6 ? 'six' : ''}`}
              disabled={busy || !striker || !nonStriker || !bowler}
              onClick={() =>
                void recordBallSafe({ type: 'RUN', runs: r as 0 | 1 | 2 | 3 | 4 | 5 | 6 })
              }
            >
              {r}
            </button>
          ))}

          <button
            type="button"
            className="score-btn extra"
            disabled={busy || !striker || !nonStriker || !bowler}
            onClick={() => setModal({ kind: 'wide', runs: 0 })}
          >
            WIDE
          </button>
          <button
            type="button"
            className="score-btn extra"
            disabled={busy || !striker || !nonStriker || !bowler}
            onClick={() => setModal({ kind: 'noball', runs: 0 })}
          >
            NO BALL
          </button>
          <button
            type="button"
            className="score-btn extra"
            disabled={busy || !striker || !nonStriker || !bowler}
            onClick={() => setModal({ kind: 'bye', runs: 1 })}
          >
            BYE
          </button>
          <button
            type="button"
            className="score-btn extra"
            disabled={busy || !striker || !nonStriker || !bowler}
            onClick={() => setModal({ kind: 'legbye', runs: 1 })}
          >
            LEG BYE
          </button>
          <button
            type="button"
            className="score-btn wicket"
            disabled={busy || !striker || !nonStriker || !bowler}
            onClick={() =>
              setModal({
                kind: 'wicket',
                dismissalType: 'BOWLED',
                batsmanOutId: striker?.uid ?? '',
                fielderId: '',
                runsCompleted: 0,
              })
            }
          >
            WICKET
          </button>
        </div>
        <p className="admin-muted">
          Strike rotation, end-of-over swap, maidens and innings closure are all
          handled automatically per ICC rules.
        </p>
      </section>

      {/* Modals for extras / wickets / replacements */}
      {modal?.kind === 'wide' || modal?.kind === 'noball' ? (
        <ExtraRunsModal
          kind={modal.kind}
          runs={modal.runs}
          onCancel={() => setModal(null)}
          onConfirm={async (runs) => {
            setModal(null)
            if (modal.kind === 'wide') {
              await recordBallSafe({ type: 'WIDE', additionalRuns: runs })
            } else {
              await recordBallSafe({ type: 'NO_BALL', batRuns: runs })
            }
          }}
        />
      ) : null}

      {modal?.kind === 'bye' || modal?.kind === 'legbye' ? (
        <ByeModal
          kind={modal.kind}
          runs={modal.runs}
          onCancel={() => setModal(null)}
          onConfirm={async (runs) => {
            setModal(null)
            if (modal.kind === 'bye') {
              await recordBallSafe({ type: 'BYE', runs })
            } else {
              await recordBallSafe({ type: 'LEG_BYE', runs })
            }
          }}
        />
      ) : null}

      {modal?.kind === 'wicket' && striker && nonStriker ? (
        <WicketModal
          striker={striker.uid}
          strikerName={striker.name}
          nonStriker={nonStriker.uid}
          nonStrikerName={nonStriker.name}
          fielders={bowlingTeam.players}
          initial={modal}
          onCancel={() => setModal(null)}
          onConfirm={async (data) => {
            setModal(null)
            await recordBallSafe({
              type: 'WICKET',
              dismissalType: data.dismissalType,
              batsmanOutId: data.batsmanOutId,
              fielderId: data.fielderId || undefined,
              runsCompletedBeforeOut: data.runsCompleted,
            })
          }}
        />
      ) : null}

      {modal?.kind === 'newBatsman' ? (
        <NewBatsmanModal
          choices={getYetToBatList(innings, battingTeam)}
          onCancel={() => setModal(null)}
          onConfirm={async (uid) => {
            await action(async () => {
              await selectNewBatsman({ liveMatchId: match.id, newBatsmanUid: uid })
            })
            // After picking the batsman, if an over also ended we still need a bowler.
            if (!innings.currentBowlerId) setModal({ kind: 'newBowler' })
            else setModal(null)
          }}
          maxWickets={maxWicketsFor(battingTeam)}
          currentWickets={innings.wickets}
        />
      ) : null}

      {modal?.kind === 'newBowler' ? (
        <NewBowlerModal
          choices={bowlingTeam.players.filter(
            (p) => p.uid !== innings.previousBowlerId,
          )}
          previousBowlerId={innings.previousBowlerId}
          onCancel={() => setModal(null)}
          onConfirm={async (uid) => {
            setModal(null)
            await action(async () => {
              await selectNextBowler({ liveMatchId: match.id, bowlerId: uid })
            })
          }}
        />
      ) : null}
    </>
  )
}

function ScoringScoreboard({
  match,
  innings,
}: {
  match: LiveMatchRecord
  innings: InningsState
}) {
  const target = match.target
  const i1 = match.innings1
  const ballsRemaining = innings.oversLimit * 6 - innings.legalBalls
  const runsNeeded =
    innings.inningsNumber === 2 && target ? Math.max(0, target - innings.runs) : null
  return (
    <section className="admin-card admin-grid scoreboard-section">
      <div className="scoreboard">
        <div className="scoreboard-team">{innings.battingTeamName}</div>
        <div className="scoreboard-runs">
          {innings.runs}/{innings.wickets}
        </div>
        <div className="scoreboard-overs">
          ({ballsToOversText(innings.legalBalls)}/{innings.oversLimit})
        </div>
      </div>
      <div className="scoreboard-meta">
        <span>CRR {safeRunRate(innings.runs, innings.legalBalls)}</span>
        {innings.inningsNumber === 2 && target ? (
          <>
            <span>Target {target}</span>
            <span>
              {runsNeeded} from {ballsRemaining} balls
            </span>
          </>
        ) : null}
        {innings.inningsNumber === 2 && i1 ? (
          <span>
            (1st innings: {i1.runs}/{i1.wickets})
          </span>
        ) : null}
        <span>Extras {innings.extras.total}</span>
      </div>
    </section>
  )
}

function BatsmenAndBowlerCards({
  innings,
  striker,
  nonStriker,
  bowler,
}: {
  innings: InningsState
  striker?: ReturnType<() => InningsState['battingCards'][string]> | undefined
  nonStriker?: ReturnType<() => InningsState['battingCards'][string]> | undefined
  bowler?: ReturnType<() => InningsState['bowlingCards'][string]> | undefined
}) {
  return (
    <section className="admin-card admin-grid bowler-batsmen-row">
      <div>
        <h3 className="section-title">Batsmen</h3>
        <table className="stat-table compact">
          <thead>
            <tr>
              <th>Batsman</th>
              <th className="num">R</th>
              <th className="num">B</th>
              <th className="num">4s</th>
              <th className="num">6s</th>
              <th className="num">SR</th>
            </tr>
          </thead>
          <tbody>
            {[striker, nonStriker].filter(Boolean).map((b) => {
              const card = b!
              const sr =
                card.ballsFaced > 0
                  ? ((card.runs / card.ballsFaced) * 100).toFixed(1)
                  : '0.0'
              return (
                <tr key={card.uid}>
                  <td>
                    <b>{card.name}</b>
                    {innings.strikerId === card.uid ? ' *' : ''}
                  </td>
                  <td className="num">{card.runs}</td>
                  <td className="num">{card.ballsFaced}</td>
                  <td className="num">{card.fours}</td>
                  <td className="num">{card.sixes}</td>
                  <td className="num">{sr}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div>
        <h3 className="section-title">Bowler</h3>
        <table className="stat-table compact">
          <thead>
            <tr>
              <th>Bowler</th>
              <th className="num">O</th>
              <th className="num">R</th>
              <th className="num">W</th>
              <th className="num">Econ</th>
            </tr>
          </thead>
          <tbody>
            {bowler ? (
              <tr>
                <td>
                  <b>{bowler.name}</b>
                </td>
                <td className="num">{ballsToOversText(bowler.ballsBowled)}</td>
                <td className="num">{bowler.runsConceded}</td>
                <td className="num">{bowler.wickets}</td>
                <td className="num">
                  {bowler.ballsBowled > 0
                    ? ((bowler.runsConceded * 6) / bowler.ballsBowled).toFixed(2)
                    : '0.00'}
                </td>
              </tr>
            ) : (
              <tr>
                <td colSpan={5}>No bowler assigned.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function BallChip({ e }: { e: BallEvent }) {
  const cls =
    e.type === 'WICKET'
      ? 'wicket'
      : e.type === 'WIDE' || e.type === 'NO_BALL'
      ? 'extra'
      : e.type === 'BYE' || e.type === 'LEG_BYE'
      ? 'bye'
      : e.totalRunsThisBall === 0
      ? 'dot'
      : e.totalRunsThisBall === 4
      ? 'four'
      : e.totalRunsThisBall === 6
      ? 'six'
      : 'run'
  return <span className={`ball-chip ${cls}`}>{e.display}</span>
}

/* ---------- modals ---------- */

function ConfirmModal({
  title,
  message,
  confirmLabel,
  danger,
  onCancel,
  onConfirm,
}: {
  title: string
  message: string
  confirmLabel: string
  danger?: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
    <div className="admin-modal-backdrop" role="presentation" onClick={onCancel}>
      <div
        className="admin-modal"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="admin-modal-header">
          <h2>{title}</h2>
          <button className="admin-close" type="button" onClick={onCancel}>
            ×
          </button>
        </div>
        <p>{message}</p>
        <div className="admin-form-row">
          <button className="admin-button" type="button" onClick={onCancel}>
            Cancel
          </button>
          <button
            className={`admin-button ${danger ? 'danger' : 'primary'}`}
            type="button"
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

function ExtraRunsModal({
  kind,
  runs,
  onCancel,
  onConfirm,
}: {
  kind: 'wide' | 'noball'
  runs: number
  onCancel: () => void
  onConfirm: (runs: number) => void
}) {
  const [val, setVal] = useState(runs)
  const label = kind === 'wide' ? 'Wide' : 'No-ball'
  const subLabel =
    kind === 'wide' ? 'Additional runs scored' : 'Runs off the bat'
  return (
    <div className="admin-modal-backdrop" role="presentation" onClick={onCancel}>
      <div
        className="admin-modal"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="admin-modal-header">
          <h2>{label} · 1 run penalty + extras</h2>
          <button className="admin-close" type="button" onClick={onCancel}>
            ×
          </button>
        </div>
        <label className="admin-label">
          {subLabel}
          <input
            className="admin-input"
            type="number"
            min={0}
            max={6}
            step={1}
            value={val}
            onChange={(e) => setVal(Math.max(0, Math.min(6, Number(e.target.value))))}
          />
        </label>
        <div className="quick-runs">
          {[0, 1, 2, 3, 4, 6].map((r) => (
            <button
              key={r}
              type="button"
              className={`score-btn small ${val === r ? 'active' : ''}`}
              onClick={() => setVal(r)}
            >
              {r}
            </button>
          ))}
        </div>
        <div className="admin-form-row">
          <button className="admin-button" type="button" onClick={onCancel}>
            Cancel
          </button>
          <button
            className="admin-button primary"
            type="button"
            onClick={() => onConfirm(val)}
          >
            Record {label.toLowerCase()}
          </button>
        </div>
      </div>
    </div>
  )
}

function ByeModal({
  kind,
  runs,
  onCancel,
  onConfirm,
}: {
  kind: 'bye' | 'legbye'
  runs: number
  onCancel: () => void
  onConfirm: (runs: number) => void
}) {
  const [val, setVal] = useState(runs)
  const label = kind === 'bye' ? 'Bye' : 'Leg Bye'
  return (
    <div className="admin-modal-backdrop" role="presentation" onClick={onCancel}>
      <div
        className="admin-modal"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="admin-modal-header">
          <h2>{label}</h2>
          <button className="admin-close" type="button" onClick={onCancel}>
            ×
          </button>
        </div>
        <p className="admin-muted">
          Goes to extras (not credited to batsman) but counts as a legal
          delivery.
        </p>
        <div className="quick-runs">
          {[1, 2, 3, 4].map((r) => (
            <button
              key={r}
              type="button"
              className={`score-btn small ${val === r ? 'active' : ''}`}
              onClick={() => setVal(r)}
            >
              {r}
            </button>
          ))}
        </div>
        <div className="admin-form-row">
          <button className="admin-button" type="button" onClick={onCancel}>
            Cancel
          </button>
          <button
            className="admin-button primary"
            type="button"
            onClick={() => onConfirm(val)}
          >
            Record {label}
          </button>
        </div>
      </div>
    </div>
  )
}

function WicketModal({
  striker,
  strikerName,
  nonStriker,
  nonStrikerName,
  fielders,
  initial,
  onCancel,
  onConfirm,
}: {
  striker: string
  strikerName: string
  nonStriker: string
  nonStrikerName: string
  fielders: { uid: string; name: string }[]
  initial: {
    dismissalType: DismissalType
    batsmanOutId: string
    fielderId: string
    runsCompleted: number
  }
  onCancel: () => void
  onConfirm: (data: {
    dismissalType: DismissalType
    batsmanOutId: string
    fielderId: string
    runsCompleted: number
  }) => void
}) {
  const [dismissalType, setDismissalType] = useState<DismissalType>(
    initial.dismissalType,
  )
  const [batsmanOutId, setBatsmanOutId] = useState<string>(
    initial.batsmanOutId || striker,
  )
  const [fielderId, setFielderId] = useState<string>(initial.fielderId)
  const [runsCompleted, setRunsCompleted] = useState<number>(initial.runsCompleted)

  const isRunOut = dismissalType === 'RUN_OUT'
  const needsFielder =
    dismissalType === 'CAUGHT' ||
    dismissalType === 'STUMPED' ||
    dismissalType === 'RUN_OUT'

  return (
    <div className="admin-modal-backdrop" role="presentation" onClick={onCancel}>
      <div
        className="admin-modal"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="admin-modal-header">
          <h2>Wicket!</h2>
          <button className="admin-close" type="button" onClick={onCancel}>
            ×
          </button>
        </div>

        <label className="admin-label">
          Dismissal type
          <select
            className="admin-select"
            value={dismissalType}
            onChange={(e) => {
              const t = e.target.value as DismissalType
              setDismissalType(t)
              if (t !== 'RUN_OUT') setBatsmanOutId(striker)
            }}
          >
            {(Object.keys(DISMISSAL_LABELS) as DismissalType[]).map((d) => (
              <option key={d} value={d}>
                {DISMISSAL_LABELS[d]}
              </option>
            ))}
          </select>
        </label>

        <label className="admin-label">
          Batsman out
          <select
            className="admin-select"
            value={batsmanOutId}
            onChange={(e) => setBatsmanOutId(e.target.value)}
            disabled={!isRunOut}
          >
            <option value={striker}>{strikerName} (striker)</option>
            <option value={nonStriker}>{nonStrikerName} (non-striker)</option>
          </select>
        </label>

        {needsFielder ? (
          <label className="admin-label">
            Fielder
            <select
              className="admin-select"
              value={fielderId}
              onChange={(e) => setFielderId(e.target.value)}
            >
              <option value="">— select —</option>
              {fielders.map((f) => (
                <option key={f.uid} value={f.uid}>
                  {f.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        {isRunOut ? (
          <label className="admin-label">
            Runs completed before run-out
            <input
              className="admin-input"
              type="number"
              min={0}
              max={6}
              step={1}
              value={runsCompleted}
              onChange={(e) =>
                setRunsCompleted(Math.max(0, Math.min(6, Number(e.target.value))))
              }
            />
          </label>
        ) : null}

        <div className="admin-form-row">
          <button className="admin-button" type="button" onClick={onCancel}>
            Cancel
          </button>
          <button
            className="admin-button danger"
            type="button"
            onClick={() =>
              onConfirm({ dismissalType, batsmanOutId, fielderId, runsCompleted })
            }
          >
            Record wicket
          </button>
        </div>
      </div>
    </div>
  )
}

function NewBatsmanModal({
  choices,
  onCancel,
  onConfirm,
  maxWickets,
  currentWickets,
}: {
  choices: { uid: string; name: string }[]
  onCancel: () => void
  onConfirm: (uid: string) => void
  maxWickets: number
  currentWickets: number
}) {
  return (
    <div className="admin-modal-backdrop" role="presentation" onClick={onCancel}>
      <div
        className="admin-modal"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="admin-modal-header">
          <h2>New batsman</h2>
          <button className="admin-close" type="button" onClick={onCancel}>
            ×
          </button>
        </div>
        <p className="admin-muted">
          {currentWickets}/{maxWickets} wickets fallen. Pick a player to come in.
        </p>
        {choices.length === 0 ? (
          <p className="admin-error">No more batsmen available — innings will end.</p>
        ) : (
          <div className="player-pick-list">
            {choices.map((p) => (
              <button
                key={p.uid}
                className="player-pick-item"
                type="button"
                onClick={() => onConfirm(p.uid)}
              >
                <b>{p.name}</b>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function NewBowlerModal({
  choices,
  previousBowlerId,
  onCancel,
  onConfirm,
}: {
  choices: { uid: string; name: string }[]
  previousBowlerId: string | null
  onCancel: () => void
  onConfirm: (uid: string) => void
}) {
  return (
    <div className="admin-modal-backdrop" role="presentation" onClick={onCancel}>
      <div
        className="admin-modal"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="admin-modal-header">
          <h2>Next bowler</h2>
          <button className="admin-close" type="button" onClick={onCancel}>
            ×
          </button>
        </div>
        <p className="admin-muted">
          Over completed. Choose the next bowler.
          {previousBowlerId
            ? ' The previous over\'s bowler cannot bowl two consecutive overs.'
            : ''}
        </p>
        <div className="player-pick-list">
          {choices.map((p) => (
            <button
              key={p.uid}
              className="player-pick-item"
              type="button"
              onClick={() => onConfirm(p.uid)}
            >
              <b>{p.name}</b>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
