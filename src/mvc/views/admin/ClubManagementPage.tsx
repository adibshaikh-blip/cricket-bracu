import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../controllers/auth/useAuth'
import {
  addClubMember,
  getAllClubMembers,
  getEligiblePlayersForClub,
  removeClubMember,
  updateMemberDepartment,
  updateMemberDesignation,
  type ClubMemberView,
} from '../../controllers/club/clubController'
import {
  DEPARTMENTS,
  DESIGNATIONS,
  designationLabel,
  type DepartmentId,
  type DesignationId,
} from '../../models/club/ClubMember'
import type { PlayerSearchRecord } from '../../models/firebase/playerRepository'

export default function ClubManagementPage() {
  const navigate = useNavigate()
  const { user, signOut } = useAuth()

  const [members, setMembers] = useState<ClubMemberView[]>([])
  const [eligible, setEligible] = useState<PlayerSearchRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [showAdd, setShowAdd] = useState(false)
  const [newPlayerUid, setNewPlayerUid] = useState<string>('')
  const [newDesignation, setNewDesignation] = useState<DesignationId>('GENERAL_MEMBER')
  const [newDepartment, setNewDepartment] = useState<DepartmentId>('EVENT_MANAGEMENT')
  const [search, setSearch] = useState('')

  const refresh = async () => {
    setLoading(true)
    setError(null)
    try {
      const [list, eligibleList] = await Promise.all([
        getAllClubMembers(),
        getEligiblePlayersForClub(),
      ])
      setMembers(list)
      setEligible(eligibleList)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load club')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const [list, eligibleList] = await Promise.all([
          getAllClubMembers(),
          getEligiblePlayersForClub(),
        ])
        if (!active) return
        setMembers(list)
        setEligible(eligibleList)
      } catch (err) {
        if (!active) return
        setError(err instanceof Error ? err.message : 'Failed to load club')
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => {
      active = false
    }
  }, [])

  const filteredEligible = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return eligible
    return eligible.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.email.toLowerCase().includes(q),
    )
  }, [search, eligible])

  const onAdd = async () => {
    if (!user || !newPlayerUid) return
    setBusy(true)
    setError(null)
    try {
      await addClubMember({
        playerUid: newPlayerUid,
        designation: newDesignation,
        department: newDepartment,
        adminUid: user.uid,
      })
      setShowAdd(false)
      setNewPlayerUid('')
      setSearch('')
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add member')
    } finally {
      setBusy(false)
    }
  }

  const onChangeDesignation = async (uid: string, designation: DesignationId) => {
    setBusy(true)
    setError(null)
    try {
      await updateMemberDesignation({ uid, designation })
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed')
    } finally {
      setBusy(false)
    }
  }

  const onChangeDepartment = async (uid: string, department: DepartmentId) => {
    setBusy(true)
    setError(null)
    try {
      await updateMemberDepartment({ uid, department })
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed')
    } finally {
      setBusy(false)
    }
  }

  const onRemove = async (uid: string, name: string) => {
    if (!window.confirm(`Remove ${name} from the club?`)) return
    setBusy(true)
    setError(null)
    try {
      await removeClubMember(uid)
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Remove failed')
    } finally {
      setBusy(false)
    }
  }

  const panel = members.filter((m) => m.isPanel)
  const others = members.filter((m) => !m.isPanel)

  return (
    <div className="admin-page">
      <div className="admin-header">
        <div>
          <h1 className="admin-title">Club Management</h1>
          <p className="admin-muted">
            Add players to the club, assign designations and departments,
            promote, or remove members.
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
            <p className="kpi-label">Panel Members</p>
            <p className="kpi-value">{panel.length}</p>
          </div>
          <div className="kpi-card">
            <p className="kpi-label">Total Members</p>
            <p className="kpi-value">{members.length}</p>
          </div>
          <div className="kpi-card">
            <p className="kpi-label">Eligible Players</p>
            <p className="kpi-value">{eligible.length}</p>
          </div>
        </div>
      </section>

      {error ? <p className="admin-error">{error}</p> : null}

      <section className="admin-grid">
        <div className="section-head">
          <h2 className="section-title">Members</h2>
          <button
            className="admin-button primary"
            type="button"
            onClick={() => setShowAdd(true)}
            disabled={eligible.length === 0}
            title={
              eligible.length === 0
                ? 'No registered players left to add'
                : 'Add a club member'
            }
          >
            + Add Club Member
          </button>
        </div>

        {loading ? (
          <p className="admin-muted">Loading members...</p>
        ) : members.length === 0 ? (
          <div className="empty-state">
            <p className="empty-title">No club members yet</p>
            <p>Add registered players to start building your club.</p>
          </div>
        ) : (
          <>
            {panel.length > 0 ? (
              <div className="admin-card admin-grid">
                <h3 className="section-title" style={{ marginBottom: 4 }}>
                  Panel
                </h3>
                <div className="member-grid">
                  {panel.map((m) => (
                    <MemberAdminCard
                      key={m.uid}
                      m={m}
                      busy={busy}
                      onChangeDesignation={onChangeDesignation}
                      onChangeDepartment={onChangeDepartment}
                      onRemove={onRemove}
                    />
                  ))}
                </div>
              </div>
            ) : null}

            {others.length > 0 ? (
              <div className="admin-card admin-grid">
                <h3 className="section-title" style={{ marginBottom: 4 }}>
                  Other members
                </h3>
                <div className="member-grid">
                  {others.map((m) => (
                    <MemberAdminCard
                      key={m.uid}
                      m={m}
                      busy={busy}
                      onChangeDesignation={onChangeDesignation}
                      onChangeDepartment={onChangeDepartment}
                      onRemove={onRemove}
                    />
                  ))}
                </div>
              </div>
            ) : null}
          </>
        )}
      </section>

      {showAdd ? (
        <div
          className="admin-modal-backdrop"
          role="presentation"
          onClick={() => setShowAdd(false)}
        >
          <div
            className="admin-modal"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="admin-modal-header">
              <h2>Add Club Member</h2>
              <button
                className="admin-close"
                type="button"
                onClick={() => setShowAdd(false)}
              >
                ×
              </button>
            </div>

            <div className="admin-form-grid">
              <label className="admin-label">
                Search player
                <input
                  className="admin-input"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Name or email"
                />
              </label>

              <div className="player-pick-list">
                {filteredEligible.length === 0 ? (
                  <p className="admin-muted">No eligible players found.</p>
                ) : (
                  filteredEligible.slice(0, 10).map((p) => (
                    <button
                      key={p.uid}
                      type="button"
                      className={`player-pick-item ${newPlayerUid === p.uid ? 'active' : ''}`}
                      onClick={() => setNewPlayerUid(p.uid)}
                    >
                      <div>
                        <b>{p.name}</b>
                        <p className="admin-muted">{p.email}</p>
                      </div>
                      {newPlayerUid === p.uid ? (
                        <span className="status-badge ongoing">Selected</span>
                      ) : null}
                    </button>
                  ))
                )}
              </div>

              <div className="admin-form-row">
                <label className="admin-label">
                  Designation
                  <select
                    className="admin-select"
                    value={newDesignation}
                    onChange={(e) =>
                      setNewDesignation(e.target.value as DesignationId)
                    }
                  >
                    {DESIGNATIONS.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.label}
                        {d.isPanel ? ' (Panel)' : ''}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="admin-label">
                  Department
                  <select
                    className="admin-select"
                    value={newDepartment}
                    onChange={(e) =>
                      setNewDepartment(e.target.value as DepartmentId)
                    }
                  >
                    {DEPARTMENTS.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <button
                className="admin-button primary"
                type="button"
                disabled={busy || !newPlayerUid}
                onClick={() => void onAdd()}
                style={{ marginTop: 8 }}
              >
                Add to club
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function MemberAdminCard({
  m,
  busy,
  onChangeDesignation,
  onChangeDepartment,
  onRemove,
}: {
  m: ClubMemberView
  busy: boolean
  onChangeDesignation: (uid: string, d: DesignationId) => Promise<void>
  onChangeDepartment: (uid: string, d: DepartmentId) => Promise<void>
  onRemove: (uid: string, name: string) => Promise<void>
}) {
  const initial = (m.playerName || '?').slice(0, 1).toUpperCase()
  return (
    <div className={`member-card ${m.isPanel ? 'panel' : ''}`}>
      <div className="member-card-top">
        <div className="member-avatar">{initial}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <Link
            to={`/players/${m.uid}`}
            className="member-name"
            style={{ color: 'var(--text-h)', textDecoration: 'none' }}
          >
            {m.playerName}
          </Link>
          <div className="member-email">{m.playerEmail}</div>
          <div className="member-badges">
            <span className={`status-badge ${m.isPanel ? 'ongoing' : 'completed'}`}>
              {designationLabel(m.designation)}
            </span>
          </div>
        </div>
      </div>

      <div className="admin-form-row">
        <label className="admin-label">
          Designation
          <select
            className="admin-select"
            value={m.designation}
            disabled={busy}
            onChange={(e) =>
              void onChangeDesignation(m.uid, e.target.value as DesignationId)
            }
          >
            {DESIGNATIONS.map((d) => (
              <option key={d.id} value={d.id}>
                {d.label}
              </option>
            ))}
          </select>
        </label>

        <label className="admin-label">
          Department
          <select
            className="admin-select"
            value={m.department}
            disabled={busy}
            onChange={(e) =>
              void onChangeDepartment(m.uid, e.target.value as DepartmentId)
            }
          >
            {DEPARTMENTS.map((d) => (
              <option key={d.id} value={d.id}>
                {d.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="member-foot">
        <span className="admin-soft">
          Joined {new Date(m.joinedAt).toLocaleDateString()}
        </span>
        <button
          className="admin-button danger"
          type="button"
          disabled={busy}
          onClick={() => void onRemove(m.uid, m.playerName)}
        >
          Remove
        </button>
      </div>
    </div>
  )
}
