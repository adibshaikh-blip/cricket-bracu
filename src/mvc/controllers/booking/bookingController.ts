import {
  deleteBookingInDb,
  deletePlayerBookingForDateInDb,
  getAllBookingsFromDb,
  getBookingFromDb,
  getBookingsForDateFromDb,
  getPlayerBookingForDateFromDb,
  setBookingInDb,
  setPlayerBookingForDateInDb,
} from '../../models/firebase/bookingRepository'
import {
  BOOKING_WEEKDAYS,
  FIELD_SLOTS,
  WEEKDAY_LABELS,
  type BookingRecord,
  type SlotDefinition,
  type SlotId,
} from '../../models/booking/Booking'

export type DaySlotView = {
  date: string
  slot: SlotDefinition
  booking: BookingRecord | null
  isPast: boolean
}

export type DayView = {
  date: string
  dayOfWeek: number
  weekdayLabel: string
  isBookable: boolean
  slots: DaySlotView[]
}

/* ---------- date helpers (local-time, no UTC drift) ---------- */

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

export function toDateKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function dateFromKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, (m ?? 1) - 1, d ?? 1)
}

function slotStartDateTime(dateKey: string, slot: SlotDefinition): Date {
  const d = dateFromKey(dateKey)
  const [hh, mm] = slot.startTime.split(':').map(Number)
  d.setHours(hh ?? 0, mm ?? 0, 0, 0)
  return d
}

export function isSlotInPast(dateKey: string, slot: SlotDefinition, now = new Date()): boolean {
  return slotStartDateTime(dateKey, slot).getTime() <= now.getTime()
}

export function isDateBookable(dateKey: string): boolean {
  const d = dateFromKey(dateKey)
  return BOOKING_WEEKDAYS.includes(d.getDay())
}

/* ---------- public reads ---------- */

/** Returns the next 5 bookable days (Sun–Thu only), starting from today. */
export function getEligibleBookingDays(referenceDate = new Date()): string[] {
  const out: string[] = []
  const cursor = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    referenceDate.getDate(),
  )
  while (out.length < 5) {
    if (BOOKING_WEEKDAYS.includes(cursor.getDay())) {
      out.push(toDateKey(cursor))
    }
    cursor.setDate(cursor.getDate() + 1)
  }
  return out
}

export async function getDaySchedule(date: string): Promise<DayView> {
  const bookings = await getBookingsForDateFromDb(date)
  const dayDate = dateFromKey(date)
  const dayOfWeek = dayDate.getDay()
  const slots: DaySlotView[] = FIELD_SLOTS.map((slot) => ({
    date,
    slot,
    booking: (bookings?.[slot.id] as BookingRecord | undefined) ?? null,
    isPast: isSlotInPast(date, slot),
  }))
  return {
    date,
    dayOfWeek,
    weekdayLabel: WEEKDAY_LABELS[dayOfWeek] ?? '',
    isBookable: BOOKING_WEEKDAYS.includes(dayOfWeek),
    slots,
  }
}

export async function getMyBookingsMap(uid: string, dates: string[]): Promise<Record<string, SlotId>> {
  const entries = await Promise.all(
    dates.map(async (d) => {
      const slot = await getPlayerBookingForDateFromDb(uid, d)
      return [d, slot] as const
    }),
  )
  const map: Record<string, SlotId> = {}
  for (const [d, s] of entries) {
    if (s) map[d] = s
  }
  return map
}

/* ---------- player actions ---------- */

export async function bookSlot(params: {
  uid: string
  playerName: string
  playerEmail: string
  date: string
  slotId: SlotId
}): Promise<void> {
  const { uid, playerName, playerEmail, date, slotId } = params

  if (!isDateBookable(date)) {
    throw new Error('The field is closed on this day. Please choose Sunday to Thursday.')
  }

  const slot = FIELD_SLOTS.find((s) => s.id === slotId)
  if (!slot) throw new Error('Invalid slot.')

  if (isSlotInPast(date, slot)) {
    throw new Error('This slot has already started or passed.')
  }

  const existingForSlot = await getBookingFromDb(date, slotId)
  if (existingForSlot) {
    throw new Error('This slot is already booked. Please pick another one.')
  }

  const existingForPlayer = await getPlayerBookingForDateFromDb(uid, date)
  if (existingForPlayer) {
    throw new Error('You already have a booking for this day.')
  }

  const record: BookingRecord = {
    date,
    slotId,
    uid,
    playerName,
    playerEmail,
    bookedAt: Date.now(),
  }

  await setBookingInDb(record)
  await setPlayerBookingForDateInDb(uid, date, slotId)
}

export async function cancelMyBooking(params: {
  uid: string
  date: string
  slotId: SlotId
}): Promise<void> {
  const { uid, date, slotId } = params
  const slot = FIELD_SLOTS.find((s) => s.id === slotId)
  if (!slot) throw new Error('Invalid slot.')

  const existing = await getBookingFromDb(date, slotId)
  if (!existing) throw new Error('Booking no longer exists.')
  if (existing.uid !== uid) throw new Error('You can only cancel your own booking.')

  if (isSlotInPast(date, slot)) {
    throw new Error('Cannot cancel a slot that has already started.')
  }

  await deleteBookingInDb(date, slotId)
  await deletePlayerBookingForDateInDb(uid, date)
}

/* ---------- admin actions ---------- */

export type AdminBookingRow = {
  date: string
  slotId: SlotId
  slot: SlotDefinition
  isPast: boolean
  booking: BookingRecord | null
}

/** Returns a flat day-by-day, slot-by-slot view of the next `days` eligible weekdays. */
export async function getAdminBookingsView(days = 10): Promise<{
  date: string
  weekdayLabel: string
  rows: AdminBookingRow[]
}[]> {
  const today = new Date()
  const cursor = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const daysOut: { date: string; weekdayLabel: string; rows: AdminBookingRow[] }[] = []

  while (daysOut.length < days) {
    if (BOOKING_WEEKDAYS.includes(cursor.getDay())) {
      const dateKey = toDateKey(cursor)
      const day = await getDaySchedule(dateKey)
      daysOut.push({
        date: dateKey,
        weekdayLabel: day.weekdayLabel,
        rows: day.slots.map((s) => ({
          date: dateKey,
          slotId: s.slot.id,
          slot: s.slot,
          isPast: s.isPast,
          booking: s.booking,
        })),
      })
    }
    cursor.setDate(cursor.getDate() + 1)
  }
  return daysOut
}

/** All bookings ever (used as a fallback / history table on admin page). */
export async function getAllBookingsFlat(): Promise<BookingRecord[]> {
  const all = await getAllBookingsFromDb()
  const list: BookingRecord[] = []
  for (const slots of Object.values(all)) {
    for (const b of Object.values(slots)) {
      if (b) list.push(b)
    }
  }
  // newest first
  list.sort((a, b) => b.bookedAt - a.bookedAt)
  return list
}

export async function adminCancelBooking(params: {
  date: string
  slotId: SlotId
}): Promise<void> {
  const { date, slotId } = params
  const existing = await getBookingFromDb(date, slotId)
  if (!existing) throw new Error('Booking no longer exists.')

  await deleteBookingInDb(date, slotId)
  await deletePlayerBookingForDateInDb(existing.uid, date)
}
