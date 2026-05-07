import { Link } from 'react-router-dom'
import { useEffect, useMemo, useState } from 'react'
import { getPublicTournamentBuckets } from '../../controllers/tournaments/publicTournamentController'
import {
  RANKING_CATEGORIES,
  getPlayerRankingRows,
  metricValueFor,
  rankRows,
  type PlayerRankingRow,
  type RankingCategoryId,
} from '../../controllers/rankings/playerRankingController'
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

function formatMetric(value: number, categoryId: RankingCategoryId): string {
  if (categoryId === 'economy' || categoryId === 'runRate') {
    return value.toFixed(2)
  }
  return String(value)
}

const HOME_RANKING_CATEGORIES: RankingCategoryId[] = [
  'runs',
  'wickets',
  'sixes',
  'fours',
  'economy',
]

export default function HomePage() {
  const [active, setActive] = useState<TournamentRecord[]>([])
  const [upcoming, setUpcoming] = useState<TournamentRecord[]>([])
  const [rankingRows, setRankingRows] = useState<PlayerRankingRow[]>([])
  const [rankingCategory, setRankingCategory] = useState<RankingCategoryId>('runs')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let activeFlag = true
    ;(async () => {
      const [buckets, rows] = await Promise.all([
        getPublicTournamentBuckets(),
        getPlayerRankingRows(),
      ])
      if (!activeFlag) return
      setActive(buckets.active)
      setUpcoming(buckets.upcoming)
      setRankingRows(rows)
      setLoading(false)
    })()
    return () => {
      activeFlag = false
    }
  }, [])

  const liveMatches = useMemo(() => collectLiveMatches(active), [active])
  const topPlayers = useMemo(
    () => rankRows(rankingRows, rankingCategory).slice(0, 5),
    [rankingRows, rankingCategory],
  )

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
            <Link className="admin-button ghost" to="/rankings">
              View Rankings
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

      <div className="home-split">
        <div className="home-main">
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

        <aside className="home-aside">
          <div className="ranking-panel">
            <div className="ranking-panel-head">
              <h3 className="ranking-panel-title">Player Rankings</h3>
              <Link to="/rankings" className="ranking-panel-link">
                See all
              </Link>
            </div>

            <div className="ranking-tabs">
              {HOME_RANKING_CATEGORIES.map((id) => {
                const cat = RANKING_CATEGORIES.find((c) => c.id === id)!
                return (
                  <button
                    key={id}
                    type="button"
                    className={`ranking-tab ${rankingCategory === id ? 'active' : ''}`}
                    onClick={() => setRankingCategory(id)}
                  >
                    {cat.label.replace('Highest ', '').replace('Most ', '').replace('Best ', '')}
                  </button>
                )
              })}
            </div>

            {loading ? (
              <p className="admin-muted">Loading rankings...</p>
            ) : topPlayers.length === 0 ? (
              <div className="empty-state" style={{ padding: 16 }}>
                <p className="empty-title">No data yet</p>
              </div>
            ) : (
              <ol className="ranking-list">
                {topPlayers.map((row, idx) => (
                  <li key={row.uid} className="ranking-row">
                    <span className={`ranking-pos pos-${idx + 1}`}>{idx + 1}</span>
                    <div className="ranking-info">
                      <Link
                        to={`/players/${row.uid}`}
                        className="ranking-name"
                      >
                        {row.name}
                      </Link>
                      <span className="ranking-sub">
                        {row.department || 'BRAC University'}
                      </span>
                    </div>
                    <span className="ranking-value">
                      {formatMetric(metricValueFor(row, rankingCategory), rankingCategory)}
                    </span>
                  </li>
                ))}
              </ol>
            )}

            <Link to="/rankings" className="admin-button outline-brand ranking-cta">
              View Full Leaderboard
            </Link>
          </div>
        </aside>
      </div>
    </div>
  )
}
