import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  liveMatchIdFor,
  subscribeLiveMatch,
} from '../../models/firebase/liveMatchRepository'
import {
  ballsToOversText,
  safeRunRate,
  type BallEvent,
  type InningsState,
  type LiveMatchRecord,
  type LiveMatchTeam,
} from '../../models/scoring/Scoring'
import {
  getLivePrediction,
  type LivePrediction,
} from '../../controllers/scoring/predictionController'

export default function MatchViewPage() {
  const { tournamentId, matchId } = useParams<{
    tournamentId: string
    matchId: string
  }>()

  const liveMatchId = useMemo(
    () => (tournamentId && matchId ? liveMatchIdFor(tournamentId, matchId) : null),
    [tournamentId, matchId],
  )

  const [match, setMatch] = useState<LiveMatchRecord | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [prediction, setPrediction] = useState<LivePrediction | null>(null)

  useEffect(() => {
    if (!liveMatchId) return
    const unsub = subscribeLiveMatch(liveMatchId, (rec) => {
      setMatch(rec)
      setLoaded(true)
    })
    return unsub
  }, [liveMatchId])

  // Recompute prediction whenever match state changes (debounced via the
  // realtime callback). We deliberately don't recompute on EVERY ball — only
  // every parent update from the scorer, which is what the user sees.
  useEffect(() => {
    let active = true
    if (!match) return
    ;(async () => {
      const p = await getLivePrediction(match)
      if (active) setPrediction(p)
    })()
    return () => {
      active = false
    }
  }, [match])

  if (!loaded) return <div className="admin-page">Loading match...</div>
  if (!match) {
    return (
      <div className="admin-page">
        <h1 className="admin-title">Match not started</h1>
        <p className="admin-muted">
          The admin hasn't begun scoring this match yet. Check back when the
          match starts.
        </p>
      </div>
    )
  }

  return (
    <div className="admin-page match-view">
      <MatchViewHeader match={match} />
      <MatchPrediction prediction={prediction} match={match} />

      <div className="match-view-grid">
        {match.innings1 ? (
          <InningsView
            inningsLabel="Innings 1"
            innings={match.innings1}
            match={match}
            isLive={match.status === 'INNINGS_1'}
          />
        ) : null}
        {match.innings2 ? (
          <InningsView
            inningsLabel="Innings 2"
            innings={match.innings2}
            match={match}
            isLive={match.status === 'INNINGS_2'}
          />
        ) : null}
      </div>

      {match.status === 'COMPLETED' || match.status === 'DISCARDED' ? (
        <ResultPanel match={match} />
      ) : null}

      <p className="admin-muted match-view-feed-note">
        This view updates in real time as the scorer records each ball. Live
        scoreboard data is exposed at{' '}
        <code>/liveMatches/{match.id}</code> in the realtime database — any
        downstream broadcast tool can consume it directly.
      </p>
    </div>
  )
}

/* ---------- header ---------- */

function MatchViewHeader({ match }: { match: LiveMatchRecord }) {
  const statusBadge = (() => {
    if (match.status === 'COMPLETED') return { cls: 'completed', label: 'Completed' }
    if (match.status === 'DISCARDED') return { cls: 'past', label: 'Discarded' }
    if (match.status === 'INNINGS_1' || match.status === 'INNINGS_2') {
      return { cls: 'live-now', label: 'LIVE' }
    }
    if (match.status === 'BREAK') return { cls: 'ongoing', label: 'Innings break' }
    return { cls: 'upcoming', label: 'Yet to start' }
  })()

  return (
    <div
      style={{
        display: 'flex',
        gap: 14,
        flexWrap: 'wrap',
        alignItems: 'center',
      }}
    >
      <div className="tournament-logo" style={{ width: 64, height: 64 }}>
        {match.matchLabel.slice(0, 2).toUpperCase()}
      </div>
      <div style={{ flex: 1, minWidth: 240 }}>
        <h1 className="admin-title">{match.matchLabel}</h1>
        <p className="admin-muted">
          {match.tournamentName} · {match.oversPerInnings} overs
        </p>
      </div>
      <span className={`status-badge ${statusBadge.cls}`}>{statusBadge.label}</span>
      <Link
        to={`/tournaments/${match.tournamentId}`}
        className="admin-button outline-brand"
      >
        Tournament
      </Link>
    </div>
  )
}

/* ---------- prediction ---------- */

function MatchPrediction({
  prediction,
  match,
}: {
  prediction: LivePrediction | null
  match: LiveMatchRecord
}) {
  if (!prediction) return null
  const a = Math.round(prediction.teamAWinProb * 100)
  const b = 100 - a
  return (
    <section className="admin-card admin-grid prediction-card">
      <div className="section-head">
        <h2 className="section-title">
          Live prediction <span className="accent">(beta)</span>
        </h2>
        <span className="admin-soft">Auto-updates with each ball</span>
      </div>
      <div className="prediction-bar">
        <div
          className="prediction-bar-team team-a"
          style={{ flex: a }}
          title={`${prediction.teamAName}: ${a}%`}
        >
          {a}%
        </div>
        <div
          className="prediction-bar-team team-b"
          style={{ flex: b }}
          title={`${prediction.teamBName}: ${b}%`}
        >
          {b}%
        </div>
      </div>
      <div className="prediction-legend">
        <span>
          <b>{prediction.teamAName}</b> {a}%
        </span>
        <span>
          <b>{prediction.teamBName}</b> {b}%
        </span>
      </div>
      <p className="admin-muted">{prediction.caption}</p>
      <div className="prediction-meta">
        {prediction.requiredRunRate !== null ? (
          <span>RRR: <b>{prediction.requiredRunRate}</b></span>
        ) : null}
        <span>CRR: <b>{prediction.currentRunRate}</b></span>
        {prediction.projectedScore !== null ? (
          <span>Projected: <b>{prediction.projectedScore}</b></span>
        ) : null}
        {match.target ? <span>Target: <b>{match.target}</b></span> : null}
      </div>
    </section>
  )
}

/* ---------- innings view ---------- */

function InningsView({
  inningsLabel,
  innings,
  match,
  isLive,
}: {
  inningsLabel: string
  innings: InningsState
  match: LiveMatchRecord
  isLive: boolean
}) {
  const battingTeam =
    innings.battingTeamId === match.teamA.id ? match.teamA : match.teamB
  const bowlingTeam =
    innings.bowlingTeamId === match.teamA.id ? match.teamA : match.teamB

  return (
    <section className="admin-card admin-grid innings-card">
      <div className="section-head">
        <h2 className="section-title">
          {inningsLabel} — {battingTeam.name}
        </h2>
        {isLive ? <span className="status-badge live-now">LIVE</span> : null}
      </div>

      <div className="scoreboard">
        <div className="scoreboard-team">{battingTeam.name}</div>
        <div className="scoreboard-runs">
          {innings.runs}/{innings.wickets}
        </div>
        <div className="scoreboard-overs">
          ({ballsToOversText(innings.legalBalls)}/{innings.oversLimit})
        </div>
      </div>
      <div className="scoreboard-meta">
        <span>CRR {safeRunRate(innings.runs, innings.legalBalls)}</span>
        <span>
          Extras {innings.extras.total} (W {innings.extras.wides}, NB{' '}
          {innings.extras.noBalls}, B {innings.extras.byes}, LB{' '}
          {innings.extras.legByes})
        </span>
      </div>

      <BattingScorecard innings={innings} battingTeam={battingTeam} />
      <BowlingScorecard innings={innings} />
      {innings.events.length > 0 ? (
        <RecentBalls innings={innings} />
      ) : null}
      {innings.fallOfWickets.length > 0 ? (
        <FallOfWickets innings={innings} />
      ) : null}
    </section>
  )
}

function BattingScorecard({
  innings,
  battingTeam,
}: {
  innings: InningsState
  battingTeam: LiveMatchTeam
}) {
  const cards = battingTeam.players
    .map((p) => innings.battingCards[p.uid])
    .filter(Boolean)
    .sort((a, b) => a.battingOrder - b.battingOrder)
  return (
    <div>
      <h3 className="section-title">Batting</h3>
      <div style={{ overflowX: 'auto' }}>
        <table className="stat-table compact">
          <thead>
            <tr>
              <th>Batsman</th>
              <th>Status</th>
              <th className="num">R</th>
              <th className="num">B</th>
              <th className="num">4s</th>
              <th className="num">6s</th>
              <th className="num">SR</th>
            </tr>
          </thead>
          <tbody>
            {cards.length === 0 ? (
              <tr>
                <td colSpan={7}>No batsmen yet.</td>
              </tr>
            ) : (
              cards.map((c) => {
                const sr =
                  c.ballsFaced > 0
                    ? ((c.runs / c.ballsFaced) * 100).toFixed(1)
                    : '0.0'
                const isOnStrike = innings.strikerId === c.uid
                const isAtNonStrike = innings.nonStrikerId === c.uid
                return (
                  <tr key={c.uid}>
                    <td>
                      <b>{c.name}</b>
                      {isOnStrike ? ' *' : ''}
                      {isAtNonStrike ? ' †' : ''}
                    </td>
                    <td>
                      {c.status === 'OUT' && c.dismissal
                        ? c.dismissal.text
                        : c.status === 'NOT_OUT'
                        ? 'not out'
                        : 'yet to bat'}
                    </td>
                    <td className="num">{c.runs}</td>
                    <td className="num">{c.ballsFaced}</td>
                    <td className="num">{c.fours}</td>
                    <td className="num">{c.sixes}</td>
                    <td className="num">{sr}</td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function BowlingScorecard({ innings }: { innings: InningsState }) {
  const cards = Object.values(innings.bowlingCards).sort(
    (a, b) => a.bowlingOrder - b.bowlingOrder,
  )
  return (
    <div>
      <h3 className="section-title">Bowling</h3>
      <div style={{ overflowX: 'auto' }}>
        <table className="stat-table compact">
          <thead>
            <tr>
              <th>Bowler</th>
              <th className="num">O</th>
              <th className="num">M</th>
              <th className="num">R</th>
              <th className="num">W</th>
              <th className="num">Econ</th>
            </tr>
          </thead>
          <tbody>
            {cards.length === 0 ? (
              <tr>
                <td colSpan={6}>No bowler yet.</td>
              </tr>
            ) : (
              cards.map((c) => {
                const econ =
                  c.ballsBowled > 0
                    ? ((c.runsConceded * 6) / c.ballsBowled).toFixed(2)
                    : '0.00'
                const isCurrent = innings.currentBowlerId === c.uid
                return (
                  <tr key={c.uid}>
                    <td>
                      <b>{c.name}</b>
                      {isCurrent ? ' (bowling)' : ''}
                    </td>
                    <td className="num">{ballsToOversText(c.ballsBowled)}</td>
                    <td className="num">{c.maidens}</td>
                    <td className="num">{c.runsConceded}</td>
                    <td className="num">{c.wickets}</td>
                    <td className="num">{econ}</td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function RecentBalls({ innings }: { innings: InningsState }) {
  // Show last 12 deliveries, newest last (most recent on the right).
  const tail: BallEvent[] = innings.events.slice(-12)
  return (
    <div>
      <h3 className="section-title">Recent balls</h3>
      <div className="ball-strip">
        {tail.map((e) => {
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
          return (
            <span key={e.id} className={`ball-chip ${cls}`}>
              {e.display}
            </span>
          )
        })}
      </div>
    </div>
  )
}

function FallOfWickets({ innings }: { innings: InningsState }) {
  return (
    <div>
      <h3 className="section-title">Fall of wickets</h3>
      <p className="admin-muted">
        {innings.fallOfWickets
          .map(
            (f) =>
              `${f.totalRuns}/${f.wicketNumber} (${f.batsmanOutName}, ${f.oversText})`,
          )
          .join(' · ')}
      </p>
    </div>
  )
}

function ResultPanel({ match }: { match: LiveMatchRecord }) {
  if (!match.result) return null
  return (
    <section className="admin-card admin-grid">
      <h2 className="section-title">Result</h2>
      <p>
        <b>{match.result.summary}</b>
      </p>
      {match.result.manOfTheMatchName ? (
        <p>
          Player of the Match: <b>{match.result.manOfTheMatchName}</b>
        </p>
      ) : null}
    </section>
  )
}
