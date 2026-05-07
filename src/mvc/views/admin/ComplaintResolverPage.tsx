import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../controllers/auth/useAuth'
import {
  deleteComplaint,
  getAllComplaintsForAdmin,
  updateComplaintStatus,
} from '../../controllers/complaints/complaintController'
import {
  COMPLAINT_CATEGORIES,
  COMPLAINT_STATUSES,
  type ComplaintRecord,
  type ComplaintStatus,
} from '../../models/complaint/Complaint'

type StatusFilter = 'ALL' | ComplaintStatus

const STATUS_FILTERS: { id: StatusFilter; label: string }[] = [
  { id: 'ALL', label: 'All' },
  ...COMPLAINT_STATUSES.map((s) => ({ id: s.id as StatusFilter, label: s.label })),
]

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

function ComplaintEditor({
  complaint,
  busy,
  onUpdate,
  onDelete,
}: {
  complaint: ComplaintRecord
  busy: boolean
  onUpdate: (params: { status: ComplaintStatus; resolutionNote: string }) => Promise<void>
  onDelete: () => Promise<void>
}) {
  const [status, setStatus] = useState<ComplaintStatus>(complaint.status)
  const [note, setNote] = useState(complaint.resolutionNote ?? '')
  const dirty =
    status !== complaint.status || note !== (complaint.resolutionNote ?? '')

  return (
    <div className="complaint-editor">
      <div className="admin-form-row">
        <label className="admin-label">
          Status
          <select
            className="admin-select"
            value={status}
            onChange={(e) => setStatus(e.target.value as ComplaintStatus)}
          >
            {COMPLAINT_STATUSES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="admin-label">
        Admin note (visible to identified submitters)
        <textarea
          className="admin-textarea"
          rows={3}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Optional resolution explanation or next steps"
        />
      </label>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
        <button
          className="admin-button primary"
          type="button"
          disabled={busy || !dirty}
          onClick={() => void onUpdate({ status, resolutionNote: note })}
        >
          Save changes
        </button>
        <button
          className="admin-button danger"
          type="button"
          disabled={busy}
          onClick={() => void onDelete()}
        >
          Delete complaint
        </button>
      </div>
    </div>
  )
}

export default function ComplaintResolverPage() {
  const navigate = useNavigate()
  const { user, signOut } = useAuth()
  const [complaints, setComplaints] = useState<ComplaintRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<StatusFilter>('ALL')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const refresh = async () => {
    setLoading(true)
    setError(null)
    try {
      const list = await getAllComplaintsForAdmin()
      setComplaints(list)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load complaints')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const list = await getAllComplaintsForAdmin()
        if (!active) return
        setComplaints(list)
      } catch (err) {
        if (!active) return
        setError(err instanceof Error ? err.message : 'Failed to load complaints')
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => {
      active = false
    }
  }, [])

  const counts = useMemo(() => {
    const out: Record<StatusFilter, number> = {
      ALL: complaints.length,
      OPEN: 0,
      IN_REVIEW: 0,
      RESOLVED: 0,
      REJECTED: 0,
    }
    for (const c of complaints) out[c.status]++
    return out
  }, [complaints])

  const filtered = useMemo(() => {
    if (filter === 'ALL') return complaints
    return complaints.filter((c) => c.status === filter)
  }, [filter, complaints])

  const onUpdate = async (
    complaintId: string,
    params: { status: ComplaintStatus; resolutionNote: string },
  ) => {
    if (!user) return
    setBusy(true)
    setError(null)
    try {
      await updateComplaintStatus({
        complaintId,
        status: params.status,
        resolutionNote: params.resolutionNote,
        adminUid: user.uid,
      })
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed')
    } finally {
      setBusy(false)
    }
  }

  const onDelete = async (complaintId: string) => {
    if (!window.confirm('Permanently delete this complaint?')) return
    setBusy(true)
    setError(null)
    try {
      await deleteComplaint(complaintId)
      setExpandedId(null)
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="admin-page">
      <div className="admin-header">
        <div>
          <h1 className="admin-title">Complaint Resolver</h1>
          <p className="admin-muted">
            Review, triage, and resolve player complaints.
          </p>
        </div>
        <div className="admin-header-actions">
          <Link className="admin-button" to="/admin/dashboard">
            Dashboard
          </Link>
          <button
            className="admin-button"
            type="button"
            onClick={async () => {
              await signOut()
              navigate('/admin/login')
            }}
          >
            Sign out
          </button>
        </div>
      </div>

      <section className="admin-grid">
        <div className="kpi-grid">
          <div className="kpi-card brand">
            <p className="kpi-label">Open</p>
            <p className="kpi-value">{counts.OPEN}</p>
          </div>
          <div className="kpi-card">
            <p className="kpi-label">In Review</p>
            <p className="kpi-value">{counts.IN_REVIEW}</p>
          </div>
          <div className="kpi-card">
            <p className="kpi-label">Resolved</p>
            <p className="kpi-value">{counts.RESOLVED}</p>
          </div>
        </div>
      </section>

      {error ? <p className="admin-error">{error}</p> : null}

      <div className="with-sidebar">
        <aside className="sidebar">
          <div className="sidebar-group">
            <h3>Status</h3>
            <div className="filter-list" role="radiogroup" aria-label="Complaint status">
              {STATUS_FILTERS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  role="radio"
                  aria-checked={filter === f.id}
                  className={`filter-option ${filter === f.id ? 'active' : ''}`}
                  onClick={() => setFilter(f.id)}
                >
                  <span className="filter-radio" aria-hidden="true" />
                  <span className="filter-label">
                    {f.label}
                    <span className="admin-soft" style={{ marginLeft: 6 }}>
                      ({counts[f.id]})
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        </aside>

        <main>
          {loading ? (
            <p className="admin-muted">Loading complaints...</p>
          ) : filtered.length === 0 ? (
            <div className="empty-state">
              <p className="empty-title">No complaints in this view</p>
              <p>Once players submit issues, they'll appear here.</p>
            </div>
          ) : (
            <div className="admin-list">
              {filtered.map((c) => {
                const expanded = expandedId === c.id
                const submitterDisplay = c.isAnonymous
                  ? 'Anonymous'
                  : c.submitterName || c.submitterEmail || 'Unknown'
                return (
                  <div key={c.id} className="complaint-card">
                    <div className="complaint-card-top">
                      <div>
                        <div className="complaint-card-id">
                          #{c.id.slice(0, 6)} ·{' '}
                          {COMPLAINT_CATEGORIES.find((x) => x.id === c.category)?.label}{' '}
                          · {c.isAnonymous ? '🕶 Anonymous' : 'Identified'}
                        </div>
                        <div className="complaint-card-subject">{c.subject}</div>
                        <div className="complaint-card-meta">
                          <span>From: <b>{submitterDisplay}</b></span>
                          {!c.isAnonymous && c.submitterUid ? (
                            <Link
                              to={`/players/${c.submitterUid}`}
                              style={{
                                marginLeft: 6,
                                color: 'var(--brand)',
                                fontWeight: 600,
                              }}
                            >
                              (view profile)
                            </Link>
                          ) : null}
                        </div>
                      </div>
                      <span className={`status-badge ${statusBadgeClass(c.status)}`}>
                        {statusLabel(c.status)}
                      </span>
                    </div>

                    <p className="complaint-card-desc">{c.description}</p>

                    {c.resolutionNote ? (
                      <div className="complaint-resolution">
                        <span className="slot-meta-label">Current admin note</span>
                        <p>{c.resolutionNote}</p>
                      </div>
                    ) : null}

                    <div className="complaint-card-foot">
                      <span>Submitted {new Date(c.createdAt).toLocaleString()}</span>
                      {c.updatedAt !== c.createdAt ? (
                        <span>• Updated {new Date(c.updatedAt).toLocaleString()}</span>
                      ) : null}
                      <button
                        type="button"
                        className="admin-button"
                        style={{ marginLeft: 'auto' }}
                        onClick={() =>
                          setExpandedId((prev) => (prev === c.id ? null : c.id))
                        }
                      >
                        {expanded ? 'Close' : 'Resolve / Update'}
                      </button>
                    </div>

                    {expanded ? (
                      <ComplaintEditor
                        complaint={c}
                        busy={busy}
                        onUpdate={(p) => onUpdate(c.id, p)}
                        onDelete={() => onDelete(c.id)}
                      />
                    ) : null}
                  </div>
                )
              })}
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
