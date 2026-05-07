import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getTournamentInfoView } from '../../controllers/tournaments/publicTournamentController'
import type { MatchRecord } from '../../models/tournament/Tournament'

type SortKey = 'runs' | 'wickets' | 'averageRun' | 'economyRate'

const SORTS: { id: SortKey; label: string }[] = [
  { id: 'runs', label: 'Runs' },
  { id: 'wickets', label: 'Wickets' },
  { id: 'averageRun', label: 'Avg Runs' },
  { id: 'economyRate', label: 'Economy' },
]

function statusBadge(status: string) {
  if (status === 'ONGOING') return { cls: 'ongoing', label: 'Ongoing' }
  if (status === 'UPCOMING') return { cls: 'upcoming', label: 'Upcoming' }
  if (status === 'COMPLETED') return { cls: 'completed', label: 'Completed' }
  return { cls: 'past', label: status }
}

export default function TournamentInfoPage() {
  const { tournamentId } = useParams<{ tournamentId: string }>()
  const [view, setView] = useState<Awaited<ReturnType<typeof getTournamentInfoView>>>(null)
  const [loading, setLoading] = useState(true)
  const [sortBy, setSortBy] = useState<SortKey>('runs')

  useEffect(() => {
    let active = true
    ;(async () => {
      if (!tournamentId) return
      const data = await getTournamentInfoView(tournamentId)
      if (!active) return
      setView(data)
      setLoading(false)
    })()
    return () => {
      active = false
    }
  }, [tournamentId])

  const performanceRows = useMemo(() => {
    const rows = view?.performanceTable ?? []
    const sorted = rows.slice().sort((a, b) => {
      if (sortBy === 'economyRate') return a.economyRate - b.economyRate
      return b[sortBy] - a[sortBy]
    })
    return sorted
  }, [view?.performanceTable, sortBy])

  if (loading) return <div className="admin-page">Loading tournament information...</div>
  if (!view) return <div className="admin-page">Tournament not found.</div>

  const badge = statusBadge(view.tournament.status)

  return (
    <div className="admin-page">
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <div className="tournament-logo" style={{ width: 64, height: 64, fontSize: '1.15rem' }}>
          {view.tournament.tournamentName.slice(0, 2).toUpperCase()}
        </div>
        <div style={{ flex: 1, minWidth: 240 }}>
          <h1 className="admin-title">{view.tournament.tournamentName}</h1>
          <p className="admin-muted">
            {view.tournament.startDate} → {view.tournament.endDate}
          </p>
        </div>
        <span className={`status-badge ${badge.cls}`}>{badge.label}</span>
      </div>

      <section className="admin-grid">
        <div className="kpi-grid">
          <div className="kpi-card brand">
            <p className="kpi-label">Teams</p>
            <p className="kpi-value">{view.pointsTable.length}</p>
          </div>
          <div className="kpi-card">
            <p className="kpi-label">Tracked Players</p>
            <p className="kpi-value">{view.performanceTable.length}</p>
          </div>
          <div className="kpi-card">
            <p className="kpi-label">Format</p>
            <p className="kpi-value">Type {view.tournament.tournamentType}</p>
          </div>
        </div>
      </section>

      {view.tournament.status === 'COMPLETED' ? (
        <section className="admin-grid">
          <div className="section-head">
            <h2 className="section-title">Best performer of the tournament</h2>
          </div>
          {view.bestPerformer ? (
            <div className="best-performer">
              <div className="best-performer-avatar">
                {view.bestPerformer.playerName.slice(0, 1).toUpperCase()}
              </div>
              <div>
                <div className="best-performer-name">
                  {view.bestPerformer.playerName}
                </div>
                <div className="best-performer-stats">
                  {view.bestPerformer.runs} runs · {view.bestPerformer.wickets} wickets
                </div>
              </div>
            </div>
          ) : (
            <div className="empty-state">
              <p className="empty-title">Not enough data</p>
              <p>The best performer will appear once stats are available.</p>
            </div>
          )}
        </section>
      ) : null}

      <section className="admin-grid">
        <div className="section-head">
          <h2 className="section-title">Points table</h2>
        </div>
        {view.pointsTable.length === 0 ? (
          <div className="empty-state">
            <p className="empty-title">No teams to show</p>
            <p>Teams will appear here once they are added to the tournament.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="stat-table">
              <thead>
                <tr>
                  <th className="rank">#</th>
                  <th>Team</th>
                  <th className="num">P</th>
                  <th className="num">W</th>
                  <th className="num">L</th>
                  <th className="num">T</th>
                  <th className="num">Pts</th>
                </tr>
              </thead>
              <tbody>
                {view.pointsTable.map((row, idx) => (
                  <tr key={row.teamId}>
                    <td className="rank">{idx + 1}</td>
                    <td><b>{row.teamName}</b></td>
                    <td className="num">{row.played}</td>
                    <td className="num">{row.won}</td>
                    <td className="num">{row.lost}</td>
                    <td className="num">{row.tied}</td>
                    <td className="num"><b>{row.points}</b></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="admin-grid">
        <div className="section-head">
          <h2 className="section-title">Player performance</h2>
        </div>
        <div className="sort-bar">
          {SORTS.map((s) => (
            <button
              key={s.id}
              type="button"
              className={`sort-chip ${sortBy === s.id ? 'active' : ''}`}
              onClick={() => setSortBy(s.id)}
            >
              {s.label}
            </button>
          ))}
        </div>
        {performanceRows.length === 0 ? (
          <div className="empty-state">
            <p className="empty-title">No player stats yet</p>
            <p>Performance metrics will appear here as matches are scored.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="stat-table">
              <thead>
                <tr>
                  <th className="rank">#</th>
                  <th>Player</th>
                  <th className="num">Runs</th>
                  <th className="num">Wickets</th>
                  <th className="num">Avg Runs</th>
                  <th className="num">Economy</th>
                </tr>
              </thead>
              <tbody>
                {performanceRows.map((row, idx) => (
                  <tr key={row.uid}>
                    <td className="rank">{idx + 1}</td>
                    <td><b>{row.playerName}</b></td>
                    <td className="num">{row.runs}</td>
                    <td className="num">{row.wickets}</td>
                    <td className="num">{row.averageRun}</td>
                    <td className="num">{row.economyRate}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <MatchesSection tournamentId={view.tournament.id} />
    </div>
  )
}

function stageLabel(stage: MatchRecord['stage']): string {
  if (stage === 'GROUP') return 'Group Stage'
  if (stage === 'QUARTER_FINAL') return 'Quarter Final'
  if (stage === 'SEMI_FINAL') return 'Semi Final'
  return 'Final'
}

function MatchesSection({ tournamentId }: { tournamentId: string }) {
  const [view, setView] = useState<Awaited<ReturnType<typeof getTournamentInfoView>>>(null)
  useEffect(() => {
    let active = true
    ;(async () => {
      const v = await getTournamentInfoView(tournamentId)
      if (active) setView(v)
    })()
    return () => {
      active = false
    }
  }, [tournamentId])

  if (!view) return null
  const matches = (view.tournament.matches ?? [])
    .slice()
    .sort((a: MatchRecord, b: MatchRecord) => a.sequence - b.sequence)
  if (matches.length === 0) return null

  return (
    <section className="admin-grid">
      <div className="section-head">
        <h2 className="section-title">Matches</h2>
      </div>
      <div className="match-grid">
        {matches.map((m: MatchRecord) => (
          <Link
            key={m.id}
            to={`/tournaments/${view.tournament.id}/matches/${m.id}`}
            className="match-card"
          >
            <div className="match-card-top">
              <span>{stageLabel(m.stage)}</span>
              <span className="status-badge {m.status === 'COMPLETED' ? 'completed' : 'upcoming'}">
                {m.status === 'COMPLETED'
                  ? 'Completed'
                  : m.status === 'IN_PROGRESS'
                  ? 'Live'
                  : 'Scheduled'}
              </span>
            </div>
            <p className="match-card-team">{m.home.label}</p>
            <p className="match-card-vs">vs</p>
            <p className="match-card-team">{m.away.label}</p>
            {m.result ? (
              <p className="admin-soft" style={{ marginTop: 8 }}>
                {m.result.winnerLabel}
              </p>
            ) : null}
          </Link>
        ))}
      </div>
    </section>
  )
}
