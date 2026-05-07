import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  getPublicTournamentBuckets,
  type TournamentGroupBuckets,
} from '../../controllers/tournaments/publicTournamentController'
import type { TournamentRecord } from '../../models/tournament/Tournament'

type Filter = 'all' | 'ongoing' | 'upcoming' | 'past'

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'ongoing', label: 'Ongoing' },
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'past', label: 'Past' },
]

function badgeFor(t: TournamentRecord) {
  if (t.status === 'ONGOING') return { cls: 'ongoing', label: 'Ongoing' }
  if (t.status === 'UPCOMING') return { cls: 'upcoming', label: 'Upcoming' }
  return { cls: 'past', label: 'Past' }
}

function TournamentCard({ t }: { t: TournamentRecord }) {
  const badge = badgeFor(t)
  return (
    <Link to={`/tournaments/${t.id}`} className="tournament-card">
      <div className="tournament-logo">
        {t.tournamentName.slice(0, 2).toUpperCase()}
      </div>
      <div className="tournament-card-body">
        <span className={`status-badge ${badge.cls}`}>{badge.label}</span>
        <div className="tournament-card-name" style={{ marginTop: 6 }}>
          {t.tournamentName}
        </div>
        <div className="tournament-card-meta">
          {t.startDate} → {t.endDate}
        </div>
        <div className="tournament-card-foot">
          <span>Type {t.tournamentType}</span>
          <span>•</span>
          <span>BRAC University</span>
        </div>
      </div>
    </Link>
  )
}

export default function PublicTournamentPage() {
  const [buckets, setBuckets] = useState<TournamentGroupBuckets>({
    active: [],
    upcoming: [],
    past: [],
  })
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<Filter>('all')

  useEffect(() => {
    let active = true
    ;(async () => {
      const data = await getPublicTournamentBuckets()
      if (!active) return
      setBuckets(data)
      setLoading(false)
    })()
    return () => {
      active = false
    }
  }, [])

  const counts = useMemo(
    () => ({
      all: buckets.active.length + buckets.upcoming.length + buckets.past.length,
      ongoing: buckets.active.length,
      upcoming: buckets.upcoming.length,
      past: buckets.past.length,
    }),
    [buckets],
  )

  const filtered = useMemo(() => {
    if (filter === 'ongoing') return buckets.active
    if (filter === 'upcoming') return buckets.upcoming
    if (filter === 'past') return buckets.past
    return [...buckets.active, ...buckets.upcoming, ...buckets.past]
  }, [filter, buckets])

  return (
    <div className="admin-page">
      <h1 className="admin-title">All university cricket tournaments</h1>
      <p className="admin-muted">
        Browse ongoing, upcoming and past tournaments across the club.
      </p>

      <div className="with-sidebar">
        <aside className="sidebar">
          <div className="sidebar-group">
            <h3>Status</h3>
            {FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                className={`sidebar-option ${filter === f.id ? 'active' : ''}`}
                onClick={() => setFilter(f.id)}
              >
                {f.label}
                <span className="admin-soft" style={{ marginLeft: 6 }}>
                  ({counts[f.id]})
                </span>
              </button>
            ))}
          </div>
        </aside>

        <main>
          {loading ? (
            <p className="admin-muted">Loading tournaments...</p>
          ) : filtered.length === 0 ? (
            <div className="empty-state">
              <p className="empty-title">No tournaments here yet</p>
              <p>New tournaments will show up as soon as admins create them.</p>
            </div>
          ) : (
            <div className="tournament-grid">
              {filtered.map((t) => (
                <TournamentCard key={t.id} t={t} />
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
