import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../controllers/auth/useAuth'
import {
  disbandTeam,
  getMyMembership,
  getTeamManagementData,
  invitePlayerToTeam,
  kickMemberFromTeam,
  leaveTeam,
  searchPlayersForInvite,
} from '../../controllers/teams/teamController'
import type { PlayerSearchRecord } from '../../models/firebase/playerRepository'

export default function TeamManagementPage() {
  const { user } = useAuth()
  const { tournamentId, teamId } = useParams<{ tournamentId: string; teamId: string }>()
  const navigate = useNavigate()

  const [data, setData] = useState<Awaited<ReturnType<typeof getTeamManagementData>> | null>(null)
  const [membershipRole, setMembershipRole] = useState<'MANAGER' | 'MEMBER' | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [query, setQuery] = useState('')
  const [results, setResults] = useState<PlayerSearchRecord[]>([])

  const refresh = async () => {
    if (!user || !tournamentId || !teamId) return
    setLoading(true)
    setError(null)
    try {
      const [membership, mgmt] = await Promise.all([
        getMyMembership(user.uid),
        getTeamManagementData({ tournamentId, teamId }),
      ])
      if (!membership || membership.teamId !== teamId || membership.tournamentId !== tournamentId) {
        throw new Error('You do not have access to this team.')
      }
      setMembershipRole(membership.role)
      setData(mgmt)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load team')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let active = true
    ;(async () => {
      if (!user || !tournamentId || !teamId) return
      try {
        const [membership, mgmt] = await Promise.all([
          getMyMembership(user.uid),
          getTeamManagementData({ tournamentId, teamId }),
        ])
        if (!active) return
        if (!membership || membership.teamId !== teamId || membership.tournamentId !== tournamentId) {
          throw new Error('You do not have access to this team.')
        }
        setMembershipRole(membership.role)
        setData(mgmt)
      } catch (err) {
        if (!active) return
        setError(err instanceof Error ? err.message : 'Failed to load team')
      } finally {
        if (active) setLoading(false)
      }
    })()

    return () => {
      active = false
    }
  }, [user, tournamentId, teamId])

  const canManagerAct = useMemo(
    () => membershipRole === 'MANAGER' && data?.tournament.status === 'UPCOMING',
    [membershipRole, data?.tournament.status],
  )

  if (loading) return <div>Loading team...</div>
  if (!data) return <div>{error ?? 'Team data unavailable.'}</div>

  const initials = user?.email?.slice(0, 2).toUpperCase() ?? 'ME'

  return (
    <div className="admin-page">
      <div className="admin-header">
        <h1 className="admin-title">Team Management</h1>
        <div className="admin-header-actions">
          {user ? (
            <Link className="profile-icon" to={`/players/${user.uid}`} title="My profile">
              {initials}
            </Link>
          ) : null}
          <Link className="admin-button" to="/player/dashboard" style={{ textDecoration: 'none' }}>
            Dashboard
          </Link>
        </div>
      </div>
      <p className="admin-muted">
        Team: <b>{data.team.teamName}</b> | Tournament: <b>{data.tournament.tournamentName}</b>
      </p>
      <p className="admin-muted">
        Your role: <b>{membershipRole}</b>
      </p>
      {error ? <p className="admin-error">{error}</p> : null}

      <section className="admin-card admin-grid">
        <h2>Members</h2>
        <div className="admin-list">
          {data.memberProfiles.map((m) => (
            <div className="admin-list-item" key={m.uid}>
              <div>
                <Link to={`/players/${m.uid}`} style={{ textDecoration: 'none' }}>
                  <b>{m.name}</b>
                </Link>
                <p className="admin-muted">{m.email}</p>
              </div>
              {canManagerAct && m.uid !== user?.uid ? (
                <button
                  className="admin-button danger"
                  type="button"
                  disabled={busy}
                  onClick={async () => {
                    if (!user || !tournamentId || !teamId) return
                    setBusy(true)
                    setError(null)
                    try {
                      await kickMemberFromTeam({
                        managerUid: user.uid,
                        tournamentId,
                        teamId,
                        targetUid: m.uid,
                      })
                      await refresh()
                    } catch (err) {
                      setError(err instanceof Error ? err.message : 'Kick failed')
                    } finally {
                      setBusy(false)
                    }
                  }}
                >
                  Kick
                </button>
              ) : null}
            </div>
          ))}
        </div>
      </section>

      {membershipRole === 'MANAGER' ? (
        <section className="admin-card admin-grid">
          <h2>Invite Player</h2>
          <div className="admin-form-row">
            <input
              className="admin-input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name or email"
            />
            <button
              className="admin-button"
              type="button"
              onClick={async () => {
                const list = await searchPlayersForInvite({
                  query,
                  teamMemberUids: data.team.memberUids ?? [],
                })
                setResults(list)
              }}
            >
              Search
            </button>
          </div>

          <div className="admin-list">
            {results.map((player) => (
              <div key={player.uid} className="admin-list-item">
                <div>
                  <b>{player.name}</b>
                  <p className="admin-muted">{player.email}</p>
                </div>
                <button
                  className="admin-button"
                  type="button"
                  disabled={!canManagerAct || busy}
                  onClick={async () => {
                    if (!user || !tournamentId || !teamId) return
                    setBusy(true)
                    setError(null)
                    try {
                      await invitePlayerToTeam({
                        managerUid: user.uid,
                        tournamentId,
                        teamId,
                        targetPlayerUid: player.uid,
                      })
                      setResults([])
                      setQuery('')
                    } catch (err) {
                      setError(err instanceof Error ? err.message : 'Invite failed')
                    } finally {
                      setBusy(false)
                    }
                  }}
                >
                  Invite
                </button>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="admin-card admin-grid">
        <h2>Team Actions</h2>
        {membershipRole === 'MANAGER' ? (
          <button
            className="admin-button danger"
            type="button"
            disabled={!canManagerAct || busy}
            onClick={async () => {
              if (!user || !tournamentId || !teamId) return
              setBusy(true)
              setError(null)
              try {
                await disbandTeam({
                  managerUid: user.uid,
                  tournamentId,
                  teamId,
                })
                navigate('/player/dashboard')
              } catch (err) {
                setError(err instanceof Error ? err.message : 'Disband failed')
              } finally {
                setBusy(false)
              }
            }}
          >
            Disband Team
          </button>
        ) : (
          <button
            className="admin-button danger"
            type="button"
            disabled={data.tournament.status !== 'UPCOMING' || busy}
            onClick={async () => {
              if (!user || !tournamentId || !teamId) return
              setBusy(true)
              setError(null)
              try {
                await leaveTeam({
                  uid: user.uid,
                  tournamentId,
                  teamId,
                })
                navigate('/player/dashboard')
              } catch (err) {
                setError(err instanceof Error ? err.message : 'Leave failed')
              } finally {
                setBusy(false)
              }
            }}
          >
            Leave Team
          </button>
        )}
      </section>
    </div>
  )
}

