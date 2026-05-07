import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  addTeamToTournament,
  getTournamentForManagement,
  kickTeamFromTournament,
  startTournament,
} from '../../controllers/tournaments/tournamentManagementController'
import type { MatchRecord, TeamRecord, TournamentRecord } from '../../models/tournament/Tournament'

function stageLabel(stage: MatchRecord['stage']): string {
  if (stage === 'GROUP') return 'Group Stage'
  if (stage === 'QUARTER_FINAL') return 'Quarter Final'
  if (stage === 'SEMI_FINAL') return 'Semi Final'
  return 'Final'
}

export default function TournamentManagementPage() {
  const { tournamentId } = useParams<{ tournamentId: string }>()
  const [tournament, setTournament] = useState<TournamentRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [teamName, setTeamName] = useState('')
  const [busy, setBusy] = useState(false)

  const reload = async (withSpinner = false) => {
    if (!tournamentId) return
    if (withSpinner) setLoading(true)
    try {
      const t = await getTournamentForManagement(tournamentId)
      setTournament(t)
      if (!t) setError('Tournament not found.')
      else setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tournament')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        if (!tournamentId) return
        const t = await getTournamentForManagement(tournamentId)
        if (!active) return
        setTournament(t)
        if (!t) setError('Tournament not found.')
        else setError(null)
      } catch (err) {
        if (!active) return
        setError(err instanceof Error ? err.message : 'Failed to load tournament')
      } finally {
        if (active) setLoading(false)
      }
    })()

    return () => {
      active = false
    }
  }, [tournamentId])

  const teams: TeamRecord[] = useMemo(() => tournament?.teams ?? [], [tournament?.teams])
  const matches = useMemo(() => tournament?.matches ?? [], [tournament?.matches])
  const groups = useMemo(() => tournament?.groups ?? [], [tournament?.groups])

  const canManageTeams = tournament?.status === 'UPCOMING'

  const onAddTeam = async (e: FormEvent) => {
    e.preventDefault()
    if (!tournamentId) return
    setBusy(true)
    setError(null)
    try {
      await addTeamToTournament({ tournamentId, teamName })
      setTeamName('')
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add team')
    } finally {
      setBusy(false)
    }
  }

  const onKickTeam = async (teamId: string) => {
    if (!tournamentId) return
    setBusy(true)
    setError(null)
    try {
      await kickTeamFromTournament({ tournamentId, teamId })
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove team')
    } finally {
      setBusy(false)
    }
  }

  const onStartTournament = async () => {
    if (!tournamentId) return
    setBusy(true)
    setError(null)
    try {
      await startTournament({ tournamentId })
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start tournament')
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <div>Loading tournament...</div>
  if (!tournament) return <div>{error ?? 'Tournament not found.'}</div>

  return (
    <div className="admin-page">
      <h1 className="admin-title">Tournament Management</h1>
      <p className="admin-muted">
        <b>{tournament.tournamentName}</b> | Status: <b>{tournament.status}</b>
      </p>

      {error ? <p className="admin-error">{error}</p> : null}

      <section className="admin-card admin-grid">
        <h2>Tournament Info</h2>
        <div className="admin-meta-row">
          <p>Dates: {tournament.startDate} to {tournament.endDate}</p>
          <p>Groups: {tournament.numberOfGroups}</p>
          <p>Max Teams: {tournament.maxTeams}</p>
        </div>
      </section>

      <section className="admin-card admin-grid">
        <h2>Team List ({teams.length}/{tournament.maxTeams})</h2>
        {canManageTeams ? (
          <form onSubmit={onAddTeam} className="admin-form-row">
            <input
              className="admin-input"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              placeholder="Team name"
              required
            />
            <button className="admin-button primary" type="submit" disabled={busy}>
              Add Team
            </button>
          </form>
        ) : null}

        {teams.length === 0 ? (
          <p>No teams added yet.</p>
        ) : (
          <div className="admin-list">
            {teams.map((team) => (
              <div key={team.id} className="admin-list-item">
                <span>{team.teamName}</span>
                {canManageTeams ? (
                  <button
                    className="admin-button danger"
                    type="button"
                    onClick={() => void onKickTeam(team.id)}
                    disabled={busy}
                  >
                    Kick Team
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="admin-card admin-grid">
        <h2>Tournament Actions</h2>
        {canManageTeams ? (
          <>
            <button
              className="admin-button primary"
              type="button"
              onClick={() => void onStartTournament()}
              disabled={busy}
            >
              Start Tournament
            </button>
            <p className="admin-muted">
              Once started, teams are divided into groups, group matches are generated,
              and knockout matches are prepared automatically.
            </p>
          </>
        ) : (
          <p className="admin-muted">
            Tournament already started. Match generation is locked.
          </p>
        )}
      </section>

      {groups.length > 0 ? (
        <section className="admin-card admin-grid">
          <h2>Groups</h2>
          <div className="admin-list">
            {groups.map((group) => {
              const names = group.teamIds
                .map((id) => teams.find((t) => t.id === id)?.teamName ?? id)
                .join(', ')
              return (
                <div key={group.id} className="admin-list-item">
                  <b>{group.groupName}</b>
                  <p>{names || 'No teams'}</p>
                </div>
              )
            })}
          </div>
        </section>
      ) : null}

      <section className="admin-card admin-grid">
        <h2>Matches</h2>
        {matches.length === 0 ? (
          <p>Matches will appear after the tournament starts.</p>
        ) : (
          <div className="admin-list">
            {matches
              .slice()
              .sort((a, b) => a.sequence - b.sequence)
              .map((match) => (
                <Link
                  className="admin-match-card"
                  key={match.id}
                  to={`/admin/tournaments/${tournament.id}/matches/${match.id}/score`}
                >
                  <div className="admin-match-top">
                    <b>{stageLabel(match.stage)}</b>
                    <span>Match #{match.sequence}</span>
                  </div>
                  <p>
                    {match.home.label} vs {match.away.label}
                  </p>
                </Link>
              ))}
          </div>
        )}
      </section>
    </div>
  )
}

