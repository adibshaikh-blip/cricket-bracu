import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../controllers/auth/useAuth'
import {
  bookSlot,
  cancelMyBooking,
  getDaySchedule,
  getEligibleBookingDays,
  getMyBookingsMap,
  type DayView,
} from '../../controllers/booking/bookingController'
import {
  WEEKDAY_LABELS,
  type SlotId,
} from '../../models/booking/Booking'
import { getPlayerProfileFromDb } from '../../models/firebase/playerRepository'

function formatDateLabel(dateKey: string): { weekday: string; day: string; month: string } {
  const [y, m, d] = dateKey.split('-').map(Number)
  const date = new Date(y, (m ?? 1) - 1, d ?? 1)
  return {
    weekday: WEEKDAY_LABELS[date.getDay()] ?? '',
    day: String(date.getDate()).padStart(2, '0'),
    month: date.toLocaleString('en-US', { month: 'short' }),
  }
}

export default function FieldBookingPage() {
  const navigate = useNavigate()
  const { user, signOut } = useAuth()

  const eligibleDays = useMemo(() => getEligibleBookingDays(), [])
  const [selectedDate, setSelectedDate] = useState<string>(eligibleDays[0])
  const [day, setDay] = useState<DayView | null>(null)
  const [myBookings, setMyBookings] = useState<Record<string, SlotId>>({})
  const [playerName, setPlayerName] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = async () => {
    if (!user) return
    setLoading(true)
    setError(null)
    try {
      const [daySchedule, bookingsMap] = await Promise.all([
        getDaySchedule(selectedDate),
        getMyBookingsMap(user.uid, eligibleDays),
      ])
      setDay(daySchedule)
      setMyBookings(bookingsMap)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load schedule')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let active = true
    ;(async () => {
      if (!user) return
      try {
        const profile = await getPlayerProfileFromDb(user.uid)
        if (active) setPlayerName(profile?.name ?? user.email ?? 'Player')
      } catch {
        if (active) setPlayerName(user.email ?? 'Player')
      }
    })()
    return () => {
      active = false
    }
  }, [user])

  useEffect(() => {
    let active = true
    ;(async () => {
      if (!user) return
      setLoading(true)
      setError(null)
      try {
        const [daySchedule, bookingsMap] = await Promise.all([
          getDaySchedule(selectedDate),
          getMyBookingsMap(user.uid, eligibleDays),
        ])
        if (!active) return
        setDay(daySchedule)
        setMyBookings(bookingsMap)
      } catch (err) {
        if (!active) return
        setError(err instanceof Error ? err.message : 'Failed to load schedule')
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => {
      active = false
    }
  }, [selectedDate, user, eligibleDays])

  const onBook = async (slotId: SlotId) => {
    if (!user) return
    setBusy(true)
    setError(null)
    try {
      await bookSlot({
        uid: user.uid,
        playerName,
        playerEmail: user.email ?? '',
        date: selectedDate,
        slotId,
      })
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to book slot')
    } finally {
      setBusy(false)
    }
  }

  const onCancel = async (slotId: SlotId) => {
    if (!user) return
    setBusy(true)
    setError(null)
    try {
      await cancelMyBooking({ uid: user.uid, date: selectedDate, slotId })
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel slot')
    } finally {
      setBusy(false)
    }
  }

  const initials = user?.email?.slice(0, 2).toUpperCase() ?? 'ME'
  const myBookingHere = myBookings[selectedDate] ?? null

  return (
    <div className="admin-page">
      <div className="admin-header">
        <div>
          <h1 className="admin-title">Field Booking</h1>
          <p className="admin-muted">
            Book a 2-hour slot at the BRAC University cricket field.
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
        <div className="section-head">
          <h2 className="section-title">Pick a day</h2>
          <span className="admin-soft">Sun – Thu • 5 days ahead</span>
        </div>
        <div className="day-tabs">
          {eligibleDays.map((d) => {
            const meta = formatDateLabel(d)
            const isActive = selectedDate === d
            const myBookingForDay = myBookings[d]
            return (
              <button
                key={d}
                type="button"
                className={`day-tab ${isActive ? 'active' : ''}`}
                onClick={() => setSelectedDate(d)}
              >
                <span className="day-tab-weekday">{meta.weekday.slice(0, 3)}</span>
                <span className="day-tab-day">{meta.day}</span>
                <span className="day-tab-month">{meta.month}</span>
                {myBookingForDay ? (
                  <span className="day-tab-marker" title="You have a booking">
                    •
                  </span>
                ) : null}
              </button>
            )
          })}
        </div>
      </section>

      {error ? <p className="admin-error">{error}</p> : null}

      <section className="admin-grid">
        <div className="section-head">
          <h2 className="section-title">
            {day ? `${day.weekdayLabel} · ${selectedDate}` : 'Slots'}
          </h2>
          {myBookingHere ? (
            <span className="status-badge ongoing">You're booked today</span>
          ) : null}
        </div>

        {loading || !day ? (
          <p className="admin-muted">Loading slots...</p>
        ) : (
          <div className="slot-grid">
            {day.slots.map((s) => {
              const booked = !!s.booking
              const mine = booked && s.booking?.uid === user?.uid
              const past = s.isPast
              const otherDayBooking = !mine && myBookingHere && !booked
              const disableBook = busy || past || booked || !!myBookingHere

              return (
                <div
                  key={s.slot.id}
                  className={`slot-card ${booked ? 'booked' : 'available'} ${past ? 'is-past' : ''} ${mine ? 'is-mine' : ''}`}
                >
                  <div className="slot-card-top">
                    <div>
                      <div className="slot-card-label">{s.slot.label}</div>
                      <div className="slot-card-time">
                        {s.slot.startTime} – {s.slot.endTime}
                      </div>
                    </div>
                    <span
                      className={`status-badge ${
                        past
                          ? 'past'
                          : mine
                            ? 'ongoing'
                            : booked
                              ? 'completed'
                              : 'upcoming'
                      }`}
                    >
                      {past
                        ? 'Past'
                        : mine
                          ? 'Your booking'
                          : booked
                            ? 'Booked'
                            : 'Available'}
                    </span>
                  </div>

                  <div className="slot-card-body">
                    {booked ? (
                      <>
                        <div className="slot-meta">
                          <span className="slot-meta-label">Booked by</span>
                          <b>{s.booking?.playerName ?? '—'}</b>
                        </div>
                        <div className="slot-meta">
                          <span className="slot-meta-label">Email</span>
                          <span className="admin-muted">{s.booking?.playerEmail}</span>
                        </div>
                      </>
                    ) : (
                      <p className="admin-muted">
                        Open for booking. One slot per day per player.
                      </p>
                    )}
                  </div>

                  <div className="slot-card-foot">
                    {mine ? (
                      <button
                        className="admin-button danger"
                        type="button"
                        disabled={busy || past}
                        onClick={() => void onCancel(s.slot.id)}
                      >
                        {past ? 'Slot started' : 'Cancel my booking'}
                      </button>
                    ) : booked ? (
                      <button className="admin-button" type="button" disabled>
                        Slot taken
                      </button>
                    ) : (
                      <button
                        className="admin-button primary"
                        type="button"
                        disabled={disableBook}
                        onClick={() => void onBook(s.slot.id)}
                        title={
                          past
                            ? 'This slot has already started.'
                            : otherDayBooking
                              ? 'You already booked another slot today.'
                              : 'Book this slot'
                        }
                      >
                        {past
                          ? 'Past'
                          : otherDayBooking
                            ? 'Already booked today'
                            : 'Book slot'}
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      <section className="admin-card admin-grid">
        <h2>My upcoming bookings</h2>
        {Object.keys(myBookings).length === 0 ? (
          <p className="admin-muted">You have no upcoming bookings.</p>
        ) : (
          <div className="admin-list">
            {Object.entries(myBookings)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([date, slotId]) => {
                const meta = formatDateLabel(date)
                return (
                  <button
                    key={`${date}-${slotId}`}
                    type="button"
                    className="admin-list-item"
                    onClick={() => setSelectedDate(date)}
                    style={{ background: 'transparent', cursor: 'pointer' }}
                  >
                    <div>
                      <b>
                        {meta.weekday}, {meta.day} {meta.month}
                      </b>
                      <p className="admin-muted">Slot: {slotId.replace('SLOT_', 'Slot ')}</p>
                    </div>
                    <span className="status-badge ongoing">Booked</span>
                  </button>
                )
              })}
          </div>
        )}
      </section>
    </div>
  )
}
