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
import type { LiveMatchRecord } from '../scoring/Scoring'

export function liveMatchIdFor(tournamentId: string, matchId: string): string {
  return `${tournamentId}__${matchId}`
}

function liveMatchRef(liveMatchId: string) {
  return ref(db, `/liveMatches/${liveMatchId}`)
}

export async function getLiveMatchFromDb(
  liveMatchId: string,
): Promise<LiveMatchRecord | null> {
  const snap = await get(liveMatchRef(liveMatchId))
  return snap.val() as LiveMatchRecord | null
}

export async function setLiveMatchInDb(record: LiveMatchRecord): Promise<void> {
  await set(liveMatchRef(record.id), record)
}

export async function updateLiveMatchInDb(
  liveMatchId: string,
  patch: Partial<LiveMatchRecord>,
): Promise<void> {
  await update(liveMatchRef(liveMatchId), patch)
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
    onChange(snap.val() as LiveMatchRecord | null)
  })
  return () => {
    off(r, 'value', handler)
  }
}
