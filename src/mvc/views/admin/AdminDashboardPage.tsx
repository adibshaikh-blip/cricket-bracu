import { useAuth } from '../../controllers/auth/useAuth'
import TournamentCreateForm from './TournamentCreateForm'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getAllTournamentsFromDb } from '../../models/firebase/tournamentRepository'
import type { TournamentRecord } from '../../models/tournament/Tournament'
import {
  createTestTournament,
  type TestTournamentProgress,
} from '../../controllers/testing/testingTournamentController'

export default function AdminDashboardPage() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [tournaments, setTournaments] = useState<TournamentRecord[]>([])
  const [testProgress, setTestProgress] = useState<TestTournamentProgress | null>(null)
  const [testError, setTestError] = useState<string | null>(null)
  const [confirmTest, setConfirmTest] = useState(false)

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

  const onCreateTest = async () => {
    if (!user) return
    setConfirmTest(false)
    setTestError(null)
    setTestProgress({ phase: 'creating-tournament' })
    try {
      const tournamentId = await createTestTournament({
        adminUid: user.uid,
        onProgress: (p) => setTestProgress(p),
      })
      setTestProgress(null)
      navigate(`/admin/tournaments/${tournamentId}/manage`)
    } catch (err) {
      setTestError(err instanceof Error ? err.message : 'Failed to create test tournament')
      setTestProgress(null)
    }
  }

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

      {testError ? <p className="admin-error">{testError}</p> : null}

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

        <button
          className="admin-card admin-create-card"
          type="button"
          onClick={() => setConfirmTest(true)}
          disabled={testProgress !== null}
          style={{ textAlign: 'left' }}
        >
          <div className="section-head">
            <h2>Create Testing Tournament</h2>
            <span className="status-badge upcoming">Dev tool</span>
          </div>
          <p className="admin-muted">
            One-click setup: spawns a tournament (type 1, 8 overs, 2 groups,
            8 teams × 11 players) with all player data seeded so you can
            score matches end-to-end immediately.
          </p>
        </button>

        <Link
          to="/admin/bookings"
          className="admin-card admin-create-card"
          style={{ display: 'block', textDecoration: 'none', color: 'inherit' }}
        >
          <div className="section-head">
            <h2>Field Bookings</h2>
            <span className="status-badge ongoing">Manage</span>
          </div>
          <p className="admin-muted">
            View all reserved slots, see who booked them, and cancel any
            booking if needed.
          </p>
        </Link>

        <Link
          to="/admin/complaints"
          className="admin-card admin-create-card"
          style={{ display: 'block', textDecoration: 'none', color: 'inherit' }}
        >
          <div className="section-head">
            <h2>Complaint Resolver</h2>
            <span className="status-badge ongoing">Resolve</span>
          </div>
          <p className="admin-muted">
            Review player complaints, set status, write resolution notes, and
            close cases.
          </p>
        </Link>

        <Link
          to="/admin/club"
          className="admin-card admin-create-card"
          style={{ display: 'block', textDecoration: 'none', color: 'inherit' }}
        >
          <div className="section-head">
            <h2>Club Management</h2>
            <span className="status-badge ongoing">Members</span>
          </div>
          <p className="admin-muted">
            Add players to the club, assign designations and departments,
            promote panel members, or remove members.
          </p>
        </Link>

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

      {confirmTest ? (
        <div
          className="admin-modal-backdrop"
          role="presentation"
          onClick={() => setConfirmTest(false)}
        >
          <div
            className="admin-modal"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="admin-modal-header">
              <h2>Create Testing Tournament?</h2>
              <button
                className="admin-close"
                type="button"
                onClick={() => setConfirmTest(false)}
              >
                ×
              </button>
            </div>
            <p>
              This will write the following to the database:
            </p>
            <ul className="admin-muted" style={{ paddingLeft: 20 }}>
              <li>1 tournament (type 1 · 8 overs · 2 groups · 8 max teams)</li>
              <li>88 synthetic players (profile + stats + role + membership)</li>
              <li>8 teams of 11 players, divided into 2 groups</li>
              <li>Group-stage + knockout matches scheduled</li>
            </ul>
            <p className="admin-muted">
              The tournament will be marked <b>ONGOING</b> immediately and you'll
              be redirected to its management page.
            </p>
            <div className="admin-form-row">
              <button
                className="admin-button"
                type="button"
                onClick={() => setConfirmTest(false)}
              >
                Cancel
              </button>
              <button
                className="admin-button primary"
                type="button"
                onClick={() => void onCreateTest()}
              >
                Create test tournament
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {testProgress ? (
        <div
          className="admin-modal-backdrop"
          role="presentation"
          onClick={() => undefined}
        >
          <div
            className="admin-modal"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="admin-modal-header">
              <h2>Building test tournament…</h2>
            </div>
            <TestProgressView progress={testProgress} />
          </div>
        </div>
      ) : null}
    </div>
  )
}

function TestProgressView({ progress }: { progress: TestTournamentProgress }) {
  let label = ''
  let pct = 0
  switch (progress.phase) {
    case 'creating-tournament':
      label = 'Creating tournament record…'
      pct = 5
      break
    case 'creating-players':
      label = `Seeding players (${progress.done} / ${progress.total})`
      pct = 5 + Math.round((progress.done / progress.total) * 70)
      break
    case 'creating-teams':
      label = `Creating teams (${progress.done} / ${progress.total})`
      pct = 75 + Math.round((progress.done / progress.total) * 15)
      break
    case 'starting-tournament':
      label = 'Starting tournament & generating matches…'
      pct = 95
      break
    case 'done':
      label = 'Done!'
      pct = 100
      break
  }
  return (
    <div className="admin-grid" style={{ gap: 10 }}>
      <p>{label}</p>
      <div
        style={{
          height: 10,
          borderRadius: 999,
          background: 'var(--surface-muted)',
          overflow: 'hidden',
          border: '1px solid var(--border)',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${pct}%`,
            background:
              'linear-gradient(135deg, var(--brand) 0%, var(--brand-dark) 100%)',
            transition: 'width 200ms ease',
          }}
        />
      </div>
      <p className="admin-soft">
        Don't close this tab — writing 250+ records to Firebase Realtime
        Database. Usually takes 5–15 seconds.
      </p>
    </div>
  )
}

