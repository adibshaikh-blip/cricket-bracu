import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  getAllClubMembers,
  type ClubMemberView,
} from '../../controllers/club/clubController'
import {
  DEPARTMENTS,
  designationLabel,
  type DepartmentId,
} from '../../models/club/ClubMember'

function PanelCard({ m, large = false }: { m: ClubMemberView; large?: boolean }) {
  const initial = (m.playerName || '?').slice(0, 1).toUpperCase()
  return (
    <Link
      to={`/players/${m.uid}`}
      className={`panel-card ${large ? 'large' : ''}`}
    >
      <div className="panel-card-avatar">{initial}</div>
      <div className="panel-card-name">{m.playerName}</div>
      <div className="panel-card-role">{designationLabel(m.designation)}</div>
      <span className="status-badge ongoing">Panel</span>
    </Link>
  )
}

function MemberRow({ m }: { m: ClubMemberView }) {
  const initial = (m.playerName || '?').slice(0, 1).toUpperCase()
  return (
    <Link to={`/players/${m.uid}`} className="member-row">
      <div className="member-avatar small">{initial}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="member-name">{m.playerName}</div>
        <div className="member-role">{designationLabel(m.designation)}</div>
      </div>
    </Link>
  )
}

export default function ClubMembersPage() {
  const [members, setMembers] = useState<ClubMemberView[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const list = await getAllClubMembers()
        if (active) setMembers(list)
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => {
      active = false
    }
  }, [])

  const panel = useMemo(() => members.filter((m) => m.isPanel), [members])
  const president = panel.find((m) => m.designation === 'PRESIDENT') ?? null
  const otherPanel = panel.filter((m) => m.designation !== 'PRESIDENT')

  const byDepartment = useMemo(() => {
    const map = {} as Record<DepartmentId, ClubMemberView[]>
    for (const m of members.filter((x) => !x.isPanel)) {
      if (!map[m.department]) map[m.department] = []
      map[m.department].push(m)
    }
    return map
  }, [members])

  return (
    <div className="admin-page">
      <h1 className="admin-title">Club Members</h1>
      <p className="admin-muted">
        Meet the people who run BRAC University Cricket Club — from the panel
        to every department.
      </p>

      {loading ? (
        <p className="admin-muted">Loading members...</p>
      ) : members.length === 0 ? (
        <div className="empty-state">
          <p className="empty-title">No club members yet</p>
          <p>The admin hasn't added any members. Check back soon.</p>
        </div>
      ) : (
        <>
          <section className="admin-grid">
            <div className="section-head">
              <h2 className="section-title">
                Panel <span className="accent">(Leadership)</span>
              </h2>
              <span className="admin-soft">{panel.length} members</span>
            </div>

            {panel.length === 0 ? (
              <div className="empty-state">
                <p className="empty-title">No panel members yet</p>
              </div>
            ) : (
              <div className="panel-row">
                {president ? <PanelCard m={president} large /> : null}
                {otherPanel.length > 0 ? (
                  <div className="panel-grid">
                    {otherPanel.map((m) => (
                      <PanelCard key={m.uid} m={m} />
                    ))}
                  </div>
                ) : null}
              </div>
            )}
          </section>

          <section className="admin-grid">
            <div className="section-head">
              <h2 className="section-title">Departments</h2>
              <span className="admin-soft">
                {members.length - panel.length} members across {DEPARTMENTS.length} departments
              </span>
            </div>

            <div className="department-grid">
              {DEPARTMENTS.map((dep) => {
                const list = byDepartment[dep.id] ?? []
                return (
                  <div key={dep.id} className="admin-card admin-grid department-card">
                    <div className="section-head">
                      <h3 className="section-title">{dep.label}</h3>
                      <span className="admin-soft">{list.length}</span>
                    </div>
                    {list.length === 0 ? (
                      <p className="admin-muted">No members in this department.</p>
                    ) : (
                      <div className="member-list">
                        {list.map((m) => (
                          <MemberRow key={m.uid} m={m} />
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </section>
        </>
      )}
    </div>
  )
}
