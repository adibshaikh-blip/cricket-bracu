import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  RANKING_CATEGORIES,
  getPlayerRankingRows,
  metricValueFor,
  rankRows,
  type PlayerRankingRow,
  type RankingCategoryId,
} from '../../controllers/rankings/playerRankingController'

function formatMetric(value: number, categoryId: RankingCategoryId): string {
  if (categoryId === 'economy' || categoryId === 'runRate') {
    return value.toFixed(2)
  }
  return String(value)
}

export default function PlayerRankingsPage() {
  const [rows, setRows] = useState<PlayerRankingRow[]>([])
  const [loading, setLoading] = useState(true)
  const [category, setCategory] = useState<RankingCategoryId>('runs')

  useEffect(() => {
    let active = true
    ;(async () => {
      const data = await getPlayerRankingRows()
      if (!active) return
      setRows(data)
      setLoading(false)
    })()
    return () => {
      active = false
    }
  }, [])

  const ranked = useMemo(() => rankRows(rows, category), [rows, category])
  const activeCat = RANKING_CATEGORIES.find((c) => c.id === category)!

  const topThree = ranked.slice(0, 3)

  return (
    <div className="admin-page">
      <h1 className="admin-title">Player Rankings</h1>
      <p className="admin-muted">
        Discover the standout cricketers across BRAC University. Filter by your
        favorite metric to see who's leading.
      </p>

      <div className="with-sidebar">
        <aside className="sidebar">
          <div className="sidebar-group">
            <h3>Ranking Filters</h3>
            <div className="filter-list" role="radiogroup" aria-label="Ranking category">
              {RANKING_CATEGORIES.map((c) => {
                const checked = category === c.id
                return (
                  <button
                    key={c.id}
                    type="button"
                    role="radio"
                    aria-checked={checked}
                    className={`filter-option ${checked ? 'active' : ''}`}
                    onClick={() => setCategory(c.id)}
                  >
                    <span className="filter-radio" aria-hidden="true" />
                    <span className="filter-label">{c.label}</span>
                  </button>
                )
              })}
            </div>
          </div>
        </aside>

        <main>
          <section className="admin-grid">
            <div className="section-head">
              <h2 className="section-title">
                {activeCat.label}
                {activeCat.ascending ? (
                  <span className="accent">(lower is better)</span>
                ) : null}
              </h2>
              <span className="admin-soft">{ranked.length} players</span>
            </div>

            {loading ? (
              <p className="admin-muted">Loading rankings...</p>
            ) : ranked.length === 0 ? (
              <div className="empty-state">
                <p className="empty-title">No players to rank yet</p>
                <p>Once players register and stats are recorded, they will appear here.</p>
              </div>
            ) : (
              <>
                {topThree.length > 0 ? (
                  <div className="podium">
                    {topThree.map((row, idx) => (
                      <Link
                        key={row.uid}
                        to={`/players/${row.uid}`}
                        className={`podium-card rank-${idx + 1}`}
                      >
                        <div className="podium-rank">#{idx + 1}</div>
                        <div className="podium-avatar">
                          {row.name.slice(0, 1).toUpperCase()}
                        </div>
                        <div className="podium-name">{row.name}</div>
                        <div className="podium-metric">
                          <span className="podium-metric-value">
                            {formatMetric(metricValueFor(row, category), category)}
                          </span>
                          <span className="podium-metric-label">
                            {activeCat.label}
                          </span>
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : null}

                <div style={{ overflowX: 'auto' }}>
                  <table className="stat-table">
                    <thead>
                      <tr>
                        <th className="rank">#</th>
                        <th>Player</th>
                        <th>Department</th>
                        <th className="num">{activeCat.label}</th>
                        <th className="num">Matches</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ranked.map((row, idx) => (
                        <tr key={row.uid}>
                          <td className="rank">{idx + 1}</td>
                          <td>
                            <Link
                              to={`/players/${row.uid}`}
                              style={{
                                color: 'var(--text-h)',
                                fontWeight: 700,
                                textDecoration: 'none',
                              }}
                            >
                              {row.name}
                            </Link>
                          </td>
                          <td className="admin-muted">
                            {row.department || '—'}
                          </td>
                          <td className="num">
                            <b>{formatMetric(metricValueFor(row, category), category)}</b>
                          </td>
                          <td className="num">{row.matches}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </section>
        </main>
      </div>
    </div>
  )
}
