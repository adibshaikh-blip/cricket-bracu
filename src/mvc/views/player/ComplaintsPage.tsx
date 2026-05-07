import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../controllers/auth/useAuth'
import {
  getMyComplaints,
  submitComplaint,
} from '../../controllers/complaints/complaintController'
import {
  COMPLAINT_CATEGORIES,
  type ComplaintCategory,
  type ComplaintRecord,
  type ComplaintStatus,
} from '../../models/complaint/Complaint'
import { getPlayerProfileFromDb } from '../../models/firebase/playerRepository'

function statusBadgeClass(status: ComplaintStatus) {
  switch (status) {
    case 'OPEN':
      return 'upcoming'
    case 'IN_REVIEW':
      return 'ongoing'
    case 'RESOLVED':
      return 'completed'
    case 'REJECTED':
      return 'past'
    default:
      return 'past'
  }
}

function statusLabel(status: ComplaintStatus): string {
  switch (status) {
    case 'OPEN':
      return 'Open'
    case 'IN_REVIEW':
      return 'In Review'
    case 'RESOLVED':
      return 'Resolved'
    case 'REJECTED':
      return 'Rejected'
    default:
      return status
  }
}

export default function ComplaintsPage() {
  const navigate = useNavigate()
  const { user, signOut } = useAuth()

  const [subject, setSubject] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState<ComplaintCategory>('GENERAL')
  const [isAnonymous, setIsAnonymous] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [playerName, setPlayerName] = useState<string>('')
  const [myComplaints, setMyComplaints] = useState<ComplaintRecord[]>([])
  const [loadingList, setLoadingList] = useState(true)

  useEffect(() => {
    let active = true
    ;(async () => {
      if (!user) return
      try {
        const profile = await getPlayerProfileFromDb(user.uid)
        if (!active) return
        setPlayerName(profile?.name ?? user.email ?? 'Player')
      } catch {
        if (active) setPlayerName(user.email ?? 'Player')
      }
    })()
    return () => {
      active = false
    }
  }, [user])

  const refreshList = async () => {
    if (!user) return
    setLoadingList(true)
    try {
      const list = await getMyComplaints(user.uid)
      setMyComplaints(list)
    } finally {
      setLoadingList(false)
    }
  }

  useEffect(() => {
    let active = true
    ;(async () => {
      if (!user) return
      try {
        const list = await getMyComplaints(user.uid)
        if (active) setMyComplaints(list)
      } finally {
        if (active) setLoadingList(false)
      }
    })()
    return () => {
      active = false
    }
  }, [user])

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!user) return
    setBusy(true)
    setError(null)
    setSuccess(null)
    try {
      const id = await submitComplaint({
        subject,
        description,
        category,
        isAnonymous,
        submitterUid: isAnonymous ? undefined : user.uid,
        submitterName: isAnonymous ? undefined : playerName,
        submitterEmail: isAnonymous ? undefined : user.email ?? '',
      })
      setSuccess(
        isAnonymous
          ? `Anonymous complaint submitted (#${id.slice(0, 6)}). It is not linked to your account.`
          : `Complaint submitted (#${id.slice(0, 6)}). You can track its progress below.`,
      )
      setSubject('')
      setDescription('')
      setCategory('GENERAL')
      setIsAnonymous(false)
      await refreshList()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit complaint')
    } finally {
      setBusy(false)
    }
  }

  const initials = user?.email?.slice(0, 2).toUpperCase() ?? 'ME'

  return (
    <div className="admin-page">
      <div className="admin-header">
        <div>
          <h1 className="admin-title">Submit a Complaint</h1>
          <p className="admin-muted">
            Help us keep the club fair. Submit an issue privately or
            anonymously.
          </p>
        </div>
        <div className="admin-header-actions">
          <Link className="admin-button" to="/player/dashboard">
            Dashboard
          </Link>
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

      <section className="admin-card admin-grid">
        <h2>New Complaint</h2>

        <form onSubmit={onSubmit} className="admin-form-grid">
          <label className="admin-label">
            Subject
            <input
              className="admin-input"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Short title for your complaint"
              required
              maxLength={120}
            />
          </label>

          <label className="admin-label">
            Category
            <select
              className="admin-select"
              value={category}
              onChange={(e) => setCategory(e.target.value as ComplaintCategory)}
            >
              {COMPLAINT_CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>

          <label className="admin-label">
            Description
            <textarea
              className="admin-textarea"
              rows={6}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe what happened, when, and any context that helps the admin investigate."
              required
              minLength={10}
              maxLength={2000}
            />
          </label>

          <label className="anonymous-toggle">
            <input
              type="checkbox"
              checked={isAnonymous}
              onChange={(e) => setIsAnonymous(e.target.checked)}
            />
            <span>
              <b>Submit anonymously</b>
              <span className="admin-soft" style={{ display: 'block', marginTop: 4 }}>
                {isAnonymous
                  ? 'Your name and email will NOT be saved with this complaint.'
                  : `Your identity (${playerName || user?.email}) will be visible to admins.`}
              </span>
            </span>
          </label>

          {error ? <p className="admin-error">{error}</p> : null}
          {success ? <p className="admin-success">{success}</p> : null}

          <button
            className="admin-button primary"
            type="submit"
            disabled={busy}
            style={{ width: 'fit-content' }}
          >
            {busy ? 'Submitting…' : 'Submit Complaint'}
          </button>
        </form>
      </section>

      <section className="admin-grid">
        <div className="section-head">
          <h2 className="section-title">My complaints</h2>
          <span className="admin-soft">
            Anonymous complaints are not listed here, by design.
          </span>
        </div>

        {loadingList ? (
          <p className="admin-muted">Loading...</p>
        ) : myComplaints.length === 0 ? (
          <div className="empty-state">
            <p className="empty-title">You haven't submitted any complaints</p>
            <p>Use the form above when you need to report an issue.</p>
          </div>
        ) : (
          <div className="admin-list">
            {myComplaints.map((c) => (
              <div key={c.id} className="complaint-card">
                <div className="complaint-card-top">
                  <div>
                    <div className="complaint-card-id">
                      #{c.id.slice(0, 6)} • {COMPLAINT_CATEGORIES.find((x) => x.id === c.category)?.label}
                    </div>
                    <div className="complaint-card-subject">{c.subject}</div>
                  </div>
                  <span className={`status-badge ${statusBadgeClass(c.status)}`}>
                    {statusLabel(c.status)}
                  </span>
                </div>
                <p className="complaint-card-desc">{c.description}</p>
                {c.resolutionNote ? (
                  <div className="complaint-resolution">
                    <span className="slot-meta-label">Admin note</span>
                    <p>{c.resolutionNote}</p>
                  </div>
                ) : null}
                <div className="complaint-card-foot">
                  <span>Submitted {new Date(c.createdAt).toLocaleString()}</span>
                  {c.updatedAt !== c.createdAt ? (
                    <span>• Updated {new Date(c.updatedAt).toLocaleString()}</span>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
