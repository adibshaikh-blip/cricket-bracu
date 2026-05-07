import { useEffect, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  getPlayerPublicProfile,
  updatePlayerPersonalInfo,
} from '../../controllers/playerProfile/playerProfileController'
import { useAuth } from '../../controllers/auth/useAuth'
import type { PlayerProfile } from '../../models/firebase/playerRepository'
import type { PlayerDataRecord } from '../../models/playerData/PlayerData'
import { defaultPlayerData } from '../../models/playerData/PlayerData'

export default function PlayerProfilePage() {
  const { playerUid } = useParams<{ playerUid: string }>()
  const { user, role } = useAuth()
  const [profile, setProfile] = useState<PlayerProfile | null>(null)
  const [playerData, setPlayerData] = useState<PlayerDataRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const [name, setName] = useState('')
  const [department, setDepartment] = useState('')
  const [studentId, setStudentId] = useState('')
  const [batch, setBatch] = useState('')
  const [phone, setPhone] = useState('')
  const [bio, setBio] = useState('')

  const isSelf = !!user && user.uid === playerUid && role === 'player'

  function normalizeData(input: PlayerDataRecord): PlayerDataRecord {
    return {
      ...defaultPlayerData,
      ...input,
      batting: { ...defaultPlayerData.batting, ...(input as Partial<PlayerDataRecord>).batting },
      bowling: { ...defaultPlayerData.bowling, ...(input as Partial<PlayerDataRecord>).bowling },
      tournamentHistory: Array.isArray((input as Partial<PlayerDataRecord>).tournamentHistory)
        ? (input as Partial<PlayerDataRecord>).tournamentHistory!
        : [],
    }
  }

  const refresh = async () => {
    if (!playerUid) return
    setLoading(true)
    setError(null)
    try {
      const result = await getPlayerPublicProfile(playerUid)
      setProfile(result.profile)
      setPlayerData(normalizeData(result.data))
      setName(result.profile.name ?? '')
      setDepartment(result.profile.department ?? '')
      setStudentId(result.profile.studentId ?? '')
      setBatch(result.profile.batch ?? '')
      setPhone(result.profile.phone ?? '')
      setBio(result.profile.bio ?? '')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load player profile')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let active = true
    ;(async () => {
      if (!playerUid) return
      try {
        const result = await getPlayerPublicProfile(playerUid)
        if (!active) return
        setProfile(result.profile)
        setPlayerData(normalizeData(result.data))
        setName(result.profile.name ?? '')
        setDepartment(result.profile.department ?? '')
        setStudentId(result.profile.studentId ?? '')
        setBatch(result.profile.batch ?? '')
        setPhone(result.profile.phone ?? '')
        setBio(result.profile.bio ?? '')
      } catch (err) {
        if (!active) return
        setError(err instanceof Error ? err.message : 'Failed to load player profile')
      } finally {
        if (active) setLoading(false)
      }
    })()

    return () => {
      active = false
    }
  }, [playerUid])

  const onSave = async (e: FormEvent) => {
    e.preventDefault()
    if (!isSelf || !playerUid) return
    setSaving(true)
    setError(null)
    try {
      await updatePlayerPersonalInfo({
        uid: playerUid,
        name,
        department,
        studentId,
        batch,
        phone,
        bio,
      })
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update profile')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div>Loading profile...</div>
  if (!profile || !playerData) return <div>{error ?? 'Profile unavailable.'}</div>

  const history = Array.isArray(playerData.tournamentHistory) ? playerData.tournamentHistory : []

  return (
    <div className="admin-page">
      <h1 className="admin-title">Player Profile</h1>
      {error ? <p className="admin-error">{error}</p> : null}

      <section className="admin-card admin-grid">
        <h2>Personal Information</h2>
        <p>
          Name: <b>{profile.name}</b>
        </p>
        <p>Email: {profile.email}</p>
        <p>Department: {profile.department || 'N/A'}</p>
        <p>Student ID: {profile.studentId || 'N/A'}</p>
        <p>Batch: {profile.batch || 'N/A'}</p>
        <p>Phone: {profile.phone || 'N/A'}</p>
        <p>Bio: {profile.bio || 'N/A'}</p>
      </section>

      <section className="admin-card admin-grid">
        <h2>Batting Statistics</h2>
        <p>Matches: {playerData.batting.matches}</p>
        <p>Innings: {playerData.batting.innings}</p>
        <p>Runs: {playerData.batting.runs}</p>
        <p>Balls Faced: {playerData.batting.ballsFaced}</p>
        <p>Outs: {playerData.batting.outs}</p>
        <p>4s / 6s: {playerData.batting.fours} / {playerData.batting.sixes}</p>
        <p>Highest Score: {playerData.batting.highestScore}</p>
      </section>

      <section className="admin-card admin-grid">
        <h2>Bowling Statistics</h2>
        <p>Matches: {playerData.bowling.matches}</p>
        <p>Overs: {playerData.bowling.overs}</p>
        <p>Runs Conceded: {playerData.bowling.runsConceded}</p>
        <p>Wickets: {playerData.bowling.wickets}</p>
        <p>Maidens: {playerData.bowling.maidens}</p>
        <p>Best Figures: {playerData.bowling.bestFigures}</p>
        <p>Economy: {playerData.bowling.economy}</p>
      </section>

      <section className="admin-card admin-grid">
        <h2>Tournament Participation History</h2>
        {history.length === 0 ? (
          <p className="admin-muted">No tournament history yet.</p>
        ) : (
          <div className="admin-list">
            {history.map((item) => (
              <div key={`${item.tournamentId}-${item.teamName}-${item.year}`} className="admin-list-item">
                <div>
                  <b>{item.tournamentName}</b>
                  <p className="admin-muted">
                    Team: {item.teamName} | Role: {item.role} | Year: {item.year}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {isSelf ? (
        <section className="admin-card admin-grid">
          <h2>Update Personal Information</h2>
          <p className="admin-muted">
            Email and password updates are disabled here.
          </p>
          <form className="admin-form-grid" onSubmit={onSave}>
            <label className="admin-label">
              Name
              <input className="admin-input" value={name} onChange={(e) => setName(e.target.value)} />
            </label>
            <div className="admin-form-row">
              <label className="admin-label">
                Department
                <input className="admin-input" value={department} onChange={(e) => setDepartment(e.target.value)} />
              </label>
              <label className="admin-label">
                Student ID
                <input className="admin-input" value={studentId} onChange={(e) => setStudentId(e.target.value)} />
              </label>
            </div>
            <div className="admin-form-row">
              <label className="admin-label">
                Batch
                <input className="admin-input" value={batch} onChange={(e) => setBatch(e.target.value)} />
              </label>
              <label className="admin-label">
                Phone
                <input className="admin-input" value={phone} onChange={(e) => setPhone(e.target.value)} />
              </label>
            </div>
            <label className="admin-label">
              Bio
              <textarea
                className="admin-input"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                rows={4}
              />
            </label>
            <button className="admin-button primary" type="submit" disabled={saving}>
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </form>
        </section>
      ) : (
        <section className="admin-card admin-grid">
          <Link className="admin-button" to="/player/dashboard" style={{ textDecoration: 'none', width: 'fit-content' }}>
            Back to Dashboard
          </Link>
        </section>
      )}
    </div>
  )
}

