export type SlotId = 'SLOT_1' | 'SLOT_2' | 'SLOT_3'

export type SlotDefinition = {
  id: SlotId
  label: string
  startTime: string // 24h "HH:MM"
  endTime: string
}

// 3 slots × 2 hours each, configured for the BRAC University field.
export const FIELD_SLOTS: SlotDefinition[] = [
  { id: 'SLOT_1', label: 'Morning', startTime: '08:00', endTime: '10:00' },
  { id: 'SLOT_2', label: 'Afternoon', startTime: '14:00', endTime: '16:00' },
  { id: 'SLOT_3', label: 'Evening', startTime: '16:00', endTime: '18:00' },
]

// 0 = Sunday ... 6 = Saturday. Bookable 5 days/week (Sun–Thu, BRAC University standard).
export const BOOKING_WEEKDAYS: number[] = [0, 1, 2, 3, 4]

export const WEEKDAY_LABELS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
]

export type BookingRecord = {
  date: string // YYYY-MM-DD
  slotId: SlotId
  uid: string
  playerName: string
  playerEmail: string
  bookedAt: number
}

/** key used at /playerDailyBookings/{uid}/{date} -> SlotId */
export type PlayerDailyBookingValue = SlotId
