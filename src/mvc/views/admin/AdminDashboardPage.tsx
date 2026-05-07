import { useAuth } from '../../controllers/auth/useAuth'
import TournamentCreateForm from './TournamentCreateForm'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getAllTournamentsFromDb } from '../../models/firebase/tournamentRepository'
import type { TournamentRecord } from '../../models/tournament/Tournament'

export default function AdminDashboardPage() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [tournaments, setTournaments] = useState<TournamentRecord[]>([])

  useEffect(() => {
    let active = true
    ;(async () => {
      const all = await getAllTournamentsFromDb()
      if (!active || !user) return
      setTournaments(all)
    })()
    return () => {
      active = false
    }
  }, [user, showCreateModal])

  const myTournaments = useMemo(
    () => tournaments.filter((t) => t.createdByUid === user?.uid),
    [tournaments, user?.uid],
  )

  return (
    <div className="admin-page">
      <div className="admin-header">
        <h1 className="admin-title">Admin Dashboard</h1>
        <button
          className="admin-button"
          type="button"
          onClick={async () => {
            await signOut()
          }}
        >
          Sign out
        </button>
      </div>

      <p className="admin-muted">
        Signed in as: <b>{user?.email ?? 'Unknown'}</b>
      </p>

      <section className="admin-grid">
        <button
          className="admin-card admin-create-card"
          type="button"
          onClick={() => setShowCreateModal(true)}
        >
          <h2>Create Tournament</h2>
          <p className="admin-muted">
            Click to open the tournament creation form.
          </p>
        </button>

        <div className="admin-card">
          <h2>Created Tournaments</h2>
          {myTournaments.length === 0 ? (
            <p className="admin-muted">No tournaments created yet.</p>
          ) : (
            <div className="admin-list">
              {myTournaments
                .slice()
                .sort((a, b) => b.createdAt - a.createdAt)
                .map((t) => (
                  <div key={t.id} className="admin-list-item">
                    <div>
                      <b>{t.tournamentName}</b>
                      <p className="admin-muted">
                        Status: {t.status} | {t.startDate} to {t.endDate}
                      </p>
                    </div>
                    <Link
                      className="admin-button"
                      to={`/admin/tournaments/${t.id}/manage`}
                      style={{ textDecoration: 'none' }}
                    >
                      Open
                    </Link>
                  </div>
                ))}
            </div>
          )}
        </div>
      </section>

      {showCreateModal ? (
        <div
          className="admin-modal-backdrop"
          role="presentation"
          onClick={() => setShowCreateModal(false)}
        >
          <div
            className="admin-modal"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="admin-modal-header">
              <h2>Create Tournament</h2>
              <button
                className="admin-close"
                type="button"
                onClick={() => setShowCreateModal(false)}
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <TournamentCreateForm
              onSuccess={(tournamentId) => {
                setShowCreateModal(false)
                navigate(`/admin/tournaments/${tournamentId}/manage`)
              }}
            />
          </div>
        </div>
      ) : null}
    </div>
  )
}

