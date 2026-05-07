import { get, ref, remove, set } from 'firebase/database'
import { db } from './firebase'
import type {
  BookingRecord,
  PlayerDailyBookingValue,
  SlotId,
} from '../booking/Booking'

function bookingRef(date: string, slotId: SlotId) {
  return ref(db, `/bookings/${date}/${slotId}`)
}

function bookingsForDateRef(date: string) {
  return ref(db, `/bookings/${date}`)
}

function bookingsRootRef() {
  return ref(db, '/bookings')
}

function playerDailyRef(uid: string, date: string) {
  return ref(db, `/playerDailyBookings/${uid}/${date}`)
}

export async function getBookingFromDb(
  date: string,
  slotId: SlotId,
): Promise<BookingRecord | null> {
  const snap = await get(bookingRef(date, slotId))
  return snap.val() as BookingRecord | null
}

export async function setBookingInDb(record: BookingRecord): Promise<void> {
  await set(bookingRef(record.date, record.slotId), record)
}

export async function deleteBookingInDb(
  date: string,
  slotId: SlotId,
): Promise<void> {
  await remove(bookingRef(date, slotId))
}

export async function getBookingsForDateFromDb(
  date: string,
): Promise<Record<SlotId, BookingRecord> | null> {
  const snap = await get(bookingsForDateRef(date))
  return snap.val() as Record<SlotId, BookingRecord> | null
}

export async function getAllBookingsFromDb(): Promise<
  Record<string, Record<SlotId, BookingRecord>>
> {
  const snap = await get(bookingsRootRef())
  const value = snap.val() as Record<string, Record<SlotId, BookingRecord>> | null
  return value ?? {}
}

export async function getPlayerBookingForDateFromDb(
  uid: string,
  date: string,
): Promise<PlayerDailyBookingValue | null> {
  const snap = await get(playerDailyRef(uid, date))
  return (snap.val() as PlayerDailyBookingValue | null) ?? null
}

export async function setPlayerBookingForDateInDb(
  uid: string,
  date: string,
  slotId: SlotId,
): Promise<void> {
  await set(playerDailyRef(uid, date), slotId)
}

export async function deletePlayerBookingForDateInDb(
  uid: string,
  date: string,
): Promise<void> {
  await remove(playerDailyRef(uid, date))
}
