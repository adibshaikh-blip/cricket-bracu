import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../controllers/auth/useAuth'
import {
  adminCancelBooking,
  getAdminBookingsView,
  getAllBookingsFlat,
} from '../../controllers/booking/bookingController'
import type {
  AdminBookingRow,
} from '../../controllers/booking/bookingController'
import type { BookingRecord } from '../../models/booking/Booking'

type DayGroup = {
  date: string
  weekdayLabel: string
  rows: AdminBookingRow[]
}

function formatDate(dateKey: string) {
  const [y, m, d] = dateKey.split('-').map(Number)
  const date = new Date(y, (m ?? 1) - 1, d ?? 1)
  return date.toLocaleString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
}

export default function FieldBookingsAdminPage() {
  const navigate = useNavigate()
  const { signOut } = useAuth()
  const [days, setDays] = useState<DayGroup[]>([])
  const [history, setHistory] = useState<BookingRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = async () => {
    setLoading(true)
    setError(null)
    try {
      const [view, all] = await Promise.all([
        getAdminBookingsView(10),
        getAllBookingsFlat(),
      ])
      setDays(view)
      setHistory(all)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load bookings')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const [view, all] = await Promise.all([
          getAdminBookingsView(10),
          getAllBookingsFlat(),
        ])
        if (!active) return
        setDays(view)
        setHistory(all)
      } catch (err) {
        if (!active) return
        setError(err instanceof Error ? err.message : 'Failed to load bookings')
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => {
      active = false
    }
  }, [])

  const onCancel = async (date: string, slotId: AdminBookingRow['slotId']) => {
    if (!window.confirm('Cancel this booking?')) return
    setBusy(true)
    setError(null)
    try {
      await adminCancelBooking({ date, slotId })
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Cancel failed')
    } finally {
      setBusy(false)
    }
  }

  const totalBooked = days.reduce(
    (acc, d) => acc + d.rows.filter((r) => r.booking).length,
    0,
  )
  const totalSlots = days.reduce((acc, d) => acc + d.rows.length, 0)

  return (
    <div className="admin-page">
      <div className="admin-header">
        <div>
          <h1 className="admin-title">Field Bookings</h1>
          <p className="admin-muted">
            Review and manage cricket field reservations.
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
            <p className="kpi-label">Booked / Total Slots</p>
            <p className="kpi-value">
              {totalBooked} / {totalSlots}
            </p>
          </div>
          <div className="kpi-card">
            <p className="kpi-label">Days In View</p>
            <p className="kpi-value">{days.length}</p>
          </div>
          <div className="kpi-card">
            <p className="kpi-label">All-time Bookings</p>
            <p className="kpi-value">{history.length}</p>
          </div>
        </div>
      </section>

      {error ? <p className="admin-error">{error}</p> : null}

      <section className="admin-grid">
        <div className="section-head">
          <h2 className="section-title">Upcoming days</h2>
          <span className="admin-soft">Next 10 bookable weekdays</span>
        </div>

        {loading ? (
          <p className="admin-muted">Loading...</p>
        ) : (
          <div className="admin-grid">
            {days.map((d) => (
              <div key={d.date} className="admin-card">
                <div className="section-head">
                  <h3>
                    {formatDate(d.date)}{' '}
                    <span className="admin-soft">({d.date})</span>
                  </h3>
                  <span className="admin-soft">
                    {d.rows.filter((r) => r.booking).length} / {d.rows.length} booked
                  </span>
                </div>

                <div className="slot-grid">
                  {d.rows.map((r) => {
                    const booked = !!r.booking
                    return (
                      <div
                        key={r.slotId}
                        className={`slot-card ${booked ? 'booked' : 'available'} ${r.isPast ? 'is-past' : ''}`}
                      >
                        <div className="slot-card-top">
                          <div>
                            <div className="slot-card-label">{r.slot.label}</div>
                            <div className="slot-card-time">
                              {r.slot.startTime} – {r.slot.endTime}
                            </div>
                          </div>
                          <span
                            className={`status-badge ${r.isPast ? 'past' : booked ? 'completed' : 'upcoming'}`}
                          >
                            {r.isPast ? 'Past' : booked ? 'Booked' : 'Available'}
                          </span>
                        </div>

                        <div className="slot-card-body">
                          {booked ? (
                            <>
                              <div className="slot-meta">
                                <span className="slot-meta-label">Player</span>
                                <Link
                                  to={`/players/${r.booking?.uid}`}
                                  style={{
                                    fontWeight: 700,
                                    color: 'var(--text-h)',
                                    textDecoration: 'none',
                                  }}
                                >
                                  {r.booking?.playerName}
                                </Link>
                              </div>
                              <div className="slot-meta">
                                <span className="slot-meta-label">Email</span>
                                <span className="admin-muted">
                                  {r.booking?.playerEmail}
                                </span>
                              </div>
                            </>
                          ) : (
                            <p className="admin-muted">No booking yet.</p>
                          )}
                        </div>

                        <div className="slot-card-foot">
                          {booked ? (
                            <button
                              className="admin-button danger"
                              type="button"
                              disabled={busy}
                              onClick={() => void onCancel(r.date, r.slotId)}
                            >
                              Cancel booking
                            </button>
                          ) : (
                            <button className="admin-button" type="button" disabled>
                              Nothing to manage
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="admin-grid">
        <div className="section-head">
          <h2 className="section-title">Booking history</h2>
          <span className="admin-soft">{history.length} total</span>
        </div>

        {history.length === 0 ? (
          <div className="empty-state">
            <p className="empty-title">No bookings yet</p>
            <p>Once players book slots, they'll appear here.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="stat-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Slot</th>
                  <th>Player</th>
                  <th>Email</th>
                  <th>Booked at</th>
                </tr>
              </thead>
              <tbody>
                {history.map((b) => (
                  <tr key={`${b.date}-${b.slotId}-${b.bookedAt}`}>
                    <td><b>{b.date}</b></td>
                    <td>{b.slotId.replace('SLOT_', 'Slot ')}</td>
                    <td>
                      <Link
                        to={`/players/${b.uid}`}
                        style={{
                          color: 'var(--text-h)',
                          fontWeight: 700,
                          textDecoration: 'none',
                        }}
                      >
                        {b.playerName}
                      </Link>
                    </td>
                    <td className="admin-muted">{b.playerEmail}</td>
                    <td className="admin-muted">
                      {new Date(b.bookedAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
