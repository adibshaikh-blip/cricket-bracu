import { get, ref, set } from 'firebase/database'
import { db } from './firebase'
import {
  defaultPlayerData,
  type PlayerDataRecord,
} from '../playerData/PlayerData'

function playerDataRef(uid: string) {
  return ref(db, `/playerData/${uid}`)
}

export async function getPlayerDataFromDb(
  uid: string,
): Promise<PlayerDataRecord | null> {
  const snapshot = await get(playerDataRef(uid))
  return snapshot.val() as PlayerDataRecord | null
}

export async function setPlayerDataInDb(
  uid: string,
  data: PlayerDataRecord,
): Promise<void> {
  await set(playerDataRef(uid), data)
}

export async function ensureDefaultPlayerData(uid: string): Promise<void> {
  const existing = await getPlayerDataFromDb(uid)
  if (!existing) {
    await setPlayerDataInDb(uid, defaultPlayerData)
    return
  }

  // Backfill missing fields to avoid runtime crashes.
  const merged: PlayerDataRecord = {
    ...defaultPlayerData,
    ...existing,
    batting: {
      ...defaultPlayerData.batting,
      ...(existing as Partial<PlayerDataRecord>).batting,
    },
    bowling: {
      ...defaultPlayerData.bowling,
      ...(existing as Partial<PlayerDataRecord>).bowling,
    },
    tournamentHistory: Array.isArray((existing as Partial<PlayerDataRecord>).tournamentHistory)
      ? (existing as Partial<PlayerDataRecord>).tournamentHistory!
      : [],
  }

  await setPlayerDataInDb(uid, merged)
}

