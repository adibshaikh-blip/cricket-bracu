import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../controllers/auth/useAuth'
import {
  acceptInvitation,
  createTeamForTournament,
  getJoinableTournaments,
  getMyMembership,
  getMyPendingInvitations,
  rejectInvitation,
} from '../../controllers/teams/teamController'
import type { TeamInvitationRecord } from '../../models/team/Team'
import type { TournamentRecord } from '../../models/tournament/Tournament'

export default function PlayerDashboardPage() {
  const navigate = useNavigate()
  const { user, signOut } = useAuth()
  const [tournaments, setTournaments] = useState<TournamentRecord[]>([])
  const [invitations, setInvitations] = useState<TeamInvitationRecord[]>([])
  const [membership, setMembership] = useState<{
    tournamentId: string
    teamId: string
    role: 'MANAGER' | 'MEMBER'
  } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  const [showCreatePopup, setShowCreatePopup] = useState(false)
  const [selectedTournamentId, setSelectedTournamentId] = useState('')
  const [teamName, setTeamName] = useState('')

  const refresh = async () => {
    if (!user) return
    setLoading(true)
    setError(null)
    try {
      const [joinable, pending, myMembership] = await Promise.all([
        getJoinableTournaments(),
        getMyPendingInvitations(user.uid),
        getMyMembership(user.uid),
      ])
      setTournaments(joinable)
      setInvitations(pending)
      setMembership(myMembership)
      if (!selectedTournamentId && joinable.length > 0) {
        setSelectedTournamentId(joinable[0].id)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load player dashboard')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let active = true
    ;(async () => {
      if (!user) return
      try {
        const [joinable, pending, myMembership] = await Promise.all([
          getJoinableTournaments(),
          getMyPendingInvitations(user.uid),
          getMyMembership(user.uid),
        ])
        if (!active) return
        setTournaments(joinable)
        setInvitations(pending)
        setMembership(myMembership)
        if (joinable.length > 0) {
          setSelectedTournamentId((prev) => prev || joinable[0].id)
        }
      } catch (err) {
        if (!active) return
        setError(err instanceof Error ? err.message : 'Failed to load player dashboard')
      } finally {
        if (active) setLoading(false)
      }
    })()

    return () => {
      active = false
    }
  }, [user])

  const canCreateTeam = useMemo(() => !membership && tournaments.length > 0, [membership, tournaments.length])

  const onCreateTeam = async () => {
    if (!user || !selectedTournamentId) return
    setBusy(true)
    setError(null)
    try {
      const team = await createTeamForTournament({
        managerUid: user.uid,
        tournamentId: selectedTournamentId,
        teamName,
      })
      setShowCreatePopup(false)
      navigate(`/player/tournaments/${selectedTournamentId}/teams/${team.id}/manage`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create team')
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <div>Loading...</div>

  const initials = user?.email?.slice(0, 2).toUpperCase() ?? 'ME'

  return (
    <div className="admin-page">
      <div className="admin-header">
        <h1 className="admin-title">Player Dashboard</h1>
        <div className="admin-header-actions">
          {user ? (
            <Link className="profile-icon" to={`/players/${user.uid}`} title="My profile">
              {initials}
            </Link>
          ) : null}
          <button
            className="admin-button"
            type="button"
            onClick={async () => {
              await signOut()
              navigate('/player/login')
            }}
          >
            Sign out
          </button>
        </div>
      </div>

      <p className="admin-muted">
        Signed in as: <b>{user?.email ?? 'Unknown'}</b>
      </p>
      {user ? <p className="admin-muted">Use the profile icon to view/edit your profile.</p> : null}

      {error ? <p className="admin-error">{error}</p> : null}

      <section className="admin-grid">
        <Link
          to="/player/bookings"
          className="admin-card admin-create-card"
          style={{ display: 'block', textDecoration: 'none', color: 'inherit' }}
        >
          <div className="section-head">
            <h2>Book the Field</h2>
            <span className="status-badge ongoing">New</span>
          </div>
          <p className="admin-muted">
            Reserve a 2-hour cricket field slot. 3 slots available per day,
            Sunday to Thursday. One booking per player per day.
          </p>
        </Link>

        <Link
          to="/player/complaints"
          className="admin-card admin-create-card"
          style={{ display: 'block', textDecoration: 'none', color: 'inherit' }}
        >
          <div className="section-head">
            <h2>Submit a Complaint</h2>
            <span className="status-badge ongoing">Voice your concern</span>
          </div>
          <p className="admin-muted">
            Report an issue privately or anonymously. Track the status and any
            admin response on this page.
          </p>
        </Link>
      </section>

      <section className="admin-card admin-grid">
        <h2>Join Tournament by Creating Team</h2>
        <p className="admin-muted">
          You can create one team and become its manager.
        </p>
        {tournaments.length > 0 ? (
          <div className="admin-list">
            {tournaments.map((t) => (
              <div key={t.id} className="admin-list-item">
                <div>
                  <b>{t.tournamentName}</b>
                  <p className="admin-muted">
                    {t.startDate} to {t.endDate} | Max teams: {t.maxTeams}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="admin-muted">No active tournaments available yet.</p>
        )}
        <button
          className="admin-button primary"
          type="button"
          disabled={!canCreateTeam}
          onClick={() => setShowCreatePopup(true)}
        >
          Create Team
        </button>
        {!canCreateTeam ? (
          <p className="admin-muted">
            {membership
              ? 'You are already in a team.'
              : 'No joinable tournaments are currently available.'}
          </p>
        ) : null}
      </section>

      {membership ? (
        <section className="admin-card admin-grid">
          <h2>My Team</h2>
          <p>
            Role: <b>{membership.role}</b>
          </p>
          <Link
            className="admin-button"
            to={`/player/tournaments/${membership.tournamentId}/teams/${membership.teamId}/manage`}
            style={{ display: 'inline-block', textDecoration: 'none', width: 'fit-content' }}
          >
            Open Team Management
          </Link>
        </section>
      ) : null}

      <section className="admin-card admin-grid">
        <h2>Invitations</h2>
        {invitations.length === 0 ? (
          <p className="admin-muted">No pending invitations.</p>
        ) : (
          <div className="admin-list">
            {invitations.map((inv) => (
              <div key={inv.id} className="admin-list-item">
                <div>
                  <b>{inv.teamName}</b>
                  <p className="admin-muted">Tournament ID: {inv.tournamentId}</p>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    className="admin-button"
                    type="button"
                    disabled={busy}
                    onClick={async () => {
                      if (!user) return
                      setBusy(true)
                      try {
                        await acceptInvitation({ invitationId: inv.id, playerUid: user.uid })
                        await refresh()
                      } catch (err) {
                        setError(err instanceof Error ? err.message : 'Accept failed')
                      } finally {
                        setBusy(false)
                      }
                    }}
                  >
                    Accept
                  </button>
                  <button
                    className="admin-button danger"
                    type="button"
                    disabled={busy}
                    onClick={async () => {
                      if (!user) return
                      setBusy(true)
                      try {
                        await rejectInvitation({ invitationId: inv.id, playerUid: user.uid })
                        await refresh()
                      } catch (err) {
                        setError(err instanceof Error ? err.message : 'Reject failed')
                      } finally {
                        setBusy(false)
                      }
                    }}
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {showCreatePopup ? (
        <div className="admin-modal-backdrop" role="presentation" onClick={() => setShowCreatePopup(false)}>
          <div className="admin-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h2>Create Team</h2>
              <button className="admin-close" type="button" onClick={() => setShowCreatePopup(false)}>
                ×
              </button>
            </div>

            <div className="admin-form-grid">
              <label className="admin-label">
                Tournament
                <select
                  className="admin-select"
                  value={selectedTournamentId}
                  onChange={(e) => setSelectedTournamentId(e.target.value)}
                >
                  {tournaments.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.tournamentName}
                    </option>
                  ))}
                </select>
              </label>

              <label className="admin-label">
                Team Name
                <input
                  className="admin-input"
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                />
              </label>
            </div>

            <button
              className="admin-button primary"
              type="button"
              style={{ marginTop: 16 }}
              disabled={busy || !teamName.trim() || !selectedTournamentId}
              onClick={() => void onCreateTeam()}
            >
              Create Team
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

