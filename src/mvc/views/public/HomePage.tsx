import { Link } from 'react-router-dom'
import { useEffect, useMemo, useState } from 'react'
import { getPublicTournamentBuckets } from '../../controllers/tournaments/publicTournamentController'
import type { MatchRecord, TournamentRecord } from '../../models/tournament/Tournament'

type LiveMatchView = {
  tournament: TournamentRecord
  match: MatchRecord
}

function stageLabel(stage: MatchRecord['stage']): string {
  switch (stage) {
    case 'GROUP':
      return 'Group Stage'
    case 'QUARTER_FINAL':
      return 'Quarter Final'
    case 'SEMI_FINAL':
      return 'Semi Final'
    case 'FINAL':
      return 'Final'
    default:
      return stage
  }
}

function collectLiveMatches(tournaments: TournamentRecord[]): LiveMatchView[] {
  const out: LiveMatchView[] = []
  for (const t of tournaments) {
    const matches = t.matches
    if (!matches) continue
    const list = Array.isArray(matches)
      ? matches.filter(Boolean)
      : Object.values(matches as unknown as Record<string, MatchRecord>)
    for (const m of list) {
      if (m.status === 'IN_PROGRESS' || m.status === 'SCHEDULED') {
        out.push({ tournament: t, match: m })
      }
    }
  }
  return out.slice(0, 6)
}

export default function HomePage() {
  const [active, setActive] = useState<TournamentRecord[]>([])
  const [upcoming, setUpcoming] = useState<TournamentRecord[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let activeFlag = true
    ;(async () => {
      const buckets = await getPublicTournamentBuckets()
      if (!activeFlag) return
      setActive(buckets.active)
      setUpcoming(buckets.upcoming)
      setLoading(false)
    })()
    return () => {
      activeFlag = false
    }
  }, [])

  const liveMatches = useMemo(() => collectLiveMatches(active), [active])

  return (
    <div className="admin-page">
      <section className="hero">
        <div className="hero-content">
          <span className="hero-eyebrow">BRAC University Cricket Club</span>
          <h1 className="hero-title">
            We make <span className="underline">campus cricketers</span> heroes,
            one match at a time.
          </h1>
          <p className="hero-sub">
            Live scores, tournament brackets, player rankings and team
            management — everything for university cricket, in one place.
          </p>
          <div className="hero-actions">
            <Link className="admin-button" to="/tournaments">
              Explore Tournaments
            </Link>
            <Link className="admin-button ghost" to="/player/register">
              Join as Player
            </Link>
          </div>
        </div>
      </section>

      <section className="admin-grid">
        <div className="kpi-grid cols-2">
          <div className="kpi-card brand">
            <p className="kpi-label">Ongoing Tournaments</p>
            <p className="kpi-value">{active.length}</p>
          </div>
          <div className="kpi-card">
            <p className="kpi-label">Live Matches</p>
            <p className="kpi-value">{liveMatches.length}</p>
          </div>
        </div>
      </section>

      <section className="admin-grid">
        <div className="section-head">
          <h2 className="section-title">
            Live cricket matches <span className="accent">(BracU)</span>
          </h2>
          <Link className="topbar-link" to="/tournaments">
            View all
          </Link>
        </div>

        {loading ? (
          <p className="admin-muted">Loading matches...</p>
        ) : liveMatches.length === 0 ? (
          <div className="empty-state">
            <p className="empty-title">No live matches right now</p>
            <p>Check back when a tournament is in play.</p>
          </div>
        ) : (
          <div className="match-grid">
            {liveMatches.map(({ tournament, match }) => (
              <Link
                key={`${tournament.id}-${match.id}`}
                to={`/tournaments/${tournament.id}`}
                className="match-card"
              >
                <div className="match-card-top">
                  <div>
                    <div className="match-card-tournament">
                      {tournament.tournamentName}
                    </div>
                    <div className="match-card-stage">
                      {stageLabel(match.stage)}
                    </div>
                  </div>
                  <span
                    className={`status-badge ${
                      match.status === 'IN_PROGRESS' ? 'live' : 'upcoming'
                    }`}
                  >
                    {match.status === 'IN_PROGRESS' ? 'Live' : 'Upcoming'}
                  </span>
                </div>

                <div className="match-card-team">
                  <span className="team-name">{match.home.label}</span>
                  <span className="yet">Yet to bat</span>
                </div>
                <div className="match-card-team">
                  <span className="team-name">{match.away.label}</span>
                  <span className="yet">Yet to bat</span>
                </div>

                <div className="match-card-foot">
                  Match {match.sequence} • {tournament.startDate} → {tournament.endDate}
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="admin-grid">
        <div className="section-head">
          <h2 className="section-title">Ongoing tournaments</h2>
          <Link className="topbar-link" to="/tournaments">
            View all
          </Link>
        </div>

        {loading ? (
          <p className="admin-muted">Loading tournaments...</p>
        ) : active.length === 0 ? (
          <div className="empty-state">
            <p className="empty-title">Nothing is running yet</p>
            <p>Upcoming tournaments will appear here once admins start them.</p>
          </div>
        ) : (
          <div className="tournament-grid">
            {active.map((t) => (
              <Link
                key={t.id}
                to={`/tournaments/${t.id}`}
                className="tournament-card"
              >
                <div className="tournament-logo">
                  {t.tournamentName.slice(0, 2).toUpperCase()}
                </div>
                <div className="tournament-card-body">
                  <div className="tournament-card-name">
                    {t.tournamentName}
                  </div>
                  <div className="tournament-card-meta">
                    {t.startDate} → {t.endDate}
                  </div>
                  <div className="tournament-card-foot">
                    <span className="status-badge ongoing">Ongoing</span>
                    <span>BRAC University</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {upcoming.length > 0 ? (
        <section className="admin-grid">
          <div className="section-head">
            <h2 className="section-title">Upcoming tournaments</h2>
          </div>
          <div className="tournament-grid">
            {upcoming.slice(0, 4).map((t) => (
              <Link
                key={t.id}
                to={`/tournaments/${t.id}`}
                className="tournament-card"
              >
                <div className="tournament-logo">
                  {t.tournamentName.slice(0, 2).toUpperCase()}
                </div>
                <div className="tournament-card-body">
                  <div className="tournament-card-name">
                    {t.tournamentName}
                  </div>
                  <div className="tournament-card-meta">
                    {t.startDate} → {t.endDate}
                  </div>
                  <div className="tournament-card-foot">
                    <span className="status-badge upcoming">Upcoming</span>
                    <span>BRAC University</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  )
}
