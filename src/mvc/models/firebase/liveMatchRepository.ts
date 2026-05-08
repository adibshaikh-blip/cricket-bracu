import {
  get,
  off,
  onValue,
  ref,
  remove,
  set,
  update,
} from 'firebase/database'
import { db } from './firebase'
import {
  normalizeLiveMatchRecord,
  type LiveMatchRecord,
} from '../scoring/Scoring'

export function liveMatchIdFor(tournamentId: string, matchId: string): string {
  return `${tournamentId}__${matchId}`
}

function liveMatchRef(liveMatchId: string) {
  return ref(db, `/liveMatches/${liveMatchId}`)
}

/** Firebase RTDB rejects `undefined`; strip recursively before set/update. */
function stripUndefinedDeep<T>(input: T): T {
  if (input === null || input === undefined) return input
  if (Array.isArray(input)) {
    return input.map((item) => stripUndefinedDeep(item)) as T
  }
  if (typeof input === 'object') {
    const obj = input as Record<string, unknown>
    const out: Record<string, unknown> = {}
    for (const key of Object.keys(obj)) {
      const v = obj[key]
      if (v === undefined) continue
      out[key] = stripUndefinedDeep(v)
    }
    return out as T
  }
  return input
}

export async function getLiveMatchFromDb(
  liveMatchId: string,
): Promise<LiveMatchRecord | null> {
  const snap = await get(liveMatchRef(liveMatchId))
  const val = snap.val() as LiveMatchRecord | null
  if (!val) return null
  return normalizeLiveMatchRecord(val)
}

export async function setLiveMatchInDb(record: LiveMatchRecord): Promise<void> {
  await set(liveMatchRef(record.id), stripUndefinedDeep(record))
}

export async function updateLiveMatchInDb(
  liveMatchId: string,
  patch: Partial<LiveMatchRecord>,
): Promise<void> {
  await update(liveMatchRef(liveMatchId), stripUndefinedDeep(patch))
}

export async function deleteLiveMatchFromDb(liveMatchId: string): Promise<void> {
  await remove(liveMatchRef(liveMatchId))
}

/**
 * Subscribe to realtime updates of a live match.
 * Returns an unsubscribe function.
 */
export function subscribeLiveMatch(
  liveMatchId: string,
  onChange: (record: LiveMatchRecord | null) => void,
): () => void {
  const r = liveMatchRef(liveMatchId)
  const handler = onValue(r, (snap) => {
    const val = snap.val() as LiveMatchRecord | null
    onChange(val ? normalizeLiveMatchRecord(val) : null)
  })
  return () => {
    off(r, 'value', handler)
  }
}
