import { useMemo, useState, type FormEvent } from 'react'
import { useAuth } from '../../controllers/auth/useAuth'
import { TournamentType, tournamentTypeLabel } from '../../models/tournament/Tournament'
import { createTournament } from '../../controllers/tournaments/createTournamentController'
import type { TournamentCreateInput } from '../../models/tournament/Tournament'

export default function TournamentCreateForm({
  onSuccess,
}: {
  onSuccess?: (tournamentId: string) => void
}) {
  const { user } = useAuth()

  const [tournamentName, setTournamentName] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [numberOfGroups, setNumberOfGroups] = useState<number>(2)
  const [maxTeams, setMaxTeams] = useState<number>(8)
  const [tournamentType, setTournamentType] = useState<TournamentCreateInput['tournamentType']>(1)

  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const currentTypeLabel = useMemo(
    () => tournamentTypeLabel(tournamentType),
    [tournamentType],
  )

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!user) return

    setError(null)
    setLoading(true)

    try {
      const input: TournamentCreateInput = {
        tournamentName,
        startDate,
        endDate,
        numberOfGroups,
        maxTeams,
        tournamentType,
      }

      const tournamentId = await createTournament({
        createdByUid: user.uid,
        input,
      })

      onSuccess?.(tournamentId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create tournament')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={onSubmit}>
      <div className="admin-form-grid">
        <label className="admin-label">
          Tournament Name
          <input
            className="admin-input"
            required
            value={tournamentName}
            onChange={(e) => setTournamentName(e.target.value)}
          />
        </label>

        <div className="admin-form-row">
          <label className="admin-label">
            Start Date
            <input
              className="admin-input"
              required
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              type="date"
            />
          </label>
          <label className="admin-label">
            End Date
            <input
              className="admin-input"
              required
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              type="date"
            />
          </label>
        </div>

        <div className="admin-form-row">
          <label className="admin-label">
            Number of Groups
            <input
              className="admin-input"
              required
              value={numberOfGroups}
              onChange={(e) => setNumberOfGroups(Number(e.target.value))}
              type="number"
              min={1}
              step={1}
            />
          </label>
          <label className="admin-label">
            Max Number of teams
            <input
              className="admin-input"
              required
              value={maxTeams}
              onChange={(e) => setMaxTeams(Number(e.target.value))}
              type="number"
              min={1}
              step={1}
            />
          </label>
        </div>

        <label className="admin-label">
          Tournament Type
          <select
            className="admin-select"
            value={tournamentType}
            onChange={(e) => setTournamentType(Number(e.target.value) as TournamentCreateInput['tournamentType'])}
          >
            <option value={TournamentType.GROUP_QUARTER_SEMI_FINAL_FINAL}>
              {tournamentTypeLabel(TournamentType.GROUP_QUARTER_SEMI_FINAL_FINAL)}
            </option>
            <option value={TournamentType.GROUP_SEMI_FINAL_FINAL}>
              {tournamentTypeLabel(TournamentType.GROUP_SEMI_FINAL_FINAL)}
            </option>
          </select>
          <p className="admin-muted">
            Selected: <b>{currentTypeLabel}</b>
          </p>
        </label>
      </div>

      <button
        className="admin-button primary"
        disabled={loading}
        type="submit"
        style={{ marginTop: 16 }}
      >
        {loading ? 'Creating...' : 'Create Tournament'}
      </button>

      {error ? <p className="admin-error">{error}</p> : null}
    </form>
  )
}

