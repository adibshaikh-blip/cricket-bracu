import { get, ref, set } from 'firebase/database'
import { db } from './firebase'

export type PlayerProfile = {
  name: string
  email: string
  createdAt: number
  department?: string
  studentId?: string
  batch?: string
  phone?: string
  bio?: string
}

function playerRef(uid: string) {
  return ref(db, `/players/${uid}`)
}

export async function getPlayerProfileFromDb(
  uid: string,
): Promise<PlayerProfile | null> {
  const snapshot = await get(playerRef(uid))
  return snapshot.val() as PlayerProfile | null
}

export async function setPlayerProfileInDb(
  uid: string,
  profile: PlayerProfile,
): Promise<void> {
  await set(playerRef(uid), profile)
}

export async function updatePlayerPersonalInfoInDb(params: {
  uid: string
  personalInfo: {
    name: string
    department?: string
    studentId?: string
    batch?: string
    phone?: string
    bio?: string
  }
}): Promise<void> {
  const existing = await getPlayerProfileFromDb(params.uid)
  if (!existing) throw new Error('Player profile not found.')

  await set(playerRef(params.uid), {
    ...existing,
    name: params.personalInfo.name.trim(),
    department: params.personalInfo.department?.trim() ?? '',
    studentId: params.personalInfo.studentId?.trim() ?? '',
    batch: params.personalInfo.batch?.trim() ?? '',
    phone: params.personalInfo.phone?.trim() ?? '',
    bio: params.personalInfo.bio?.trim() ?? '',
  })
}

export type PlayerSearchRecord = PlayerProfile & { uid: string }

export async function getAllPlayersFromDb(): Promise<PlayerSearchRecord[]> {
  const snapshot = await get(ref(db, '/players'))
  const value = snapshot.val() as Record<string, PlayerProfile> | null
  if (!value) return []

  return Object.entries(value).map(([uid, profile]) => ({
    uid,
    ...profile,
  }))
}

