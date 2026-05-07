import {
  getPlayerProfileFromDb,
  updatePlayerPersonalInfoInDb,
  type PlayerProfile,
} from '../../models/firebase/playerRepository'
import {
  ensureDefaultPlayerData,
  getPlayerDataFromDb,
} from '../../models/firebase/playerDataRepository'
import {
  defaultPlayerData,
  type PlayerDataRecord,
} from '../../models/playerData/PlayerData'

export async function getPlayerPublicProfile(uid: string): Promise<{
  profile: PlayerProfile
  data: PlayerDataRecord
}> {
  const profile = await getPlayerProfileFromDb(uid)
  if (!profile) throw new Error('Player not found.')

  await ensureDefaultPlayerData(uid)
  const raw = (await getPlayerDataFromDb(uid)) ?? defaultPlayerData
  const data: PlayerDataRecord = {
    ...defaultPlayerData,
    ...raw,
    batting: { ...defaultPlayerData.batting, ...(raw as Partial<PlayerDataRecord>).batting },
    bowling: { ...defaultPlayerData.bowling, ...(raw as Partial<PlayerDataRecord>).bowling },
    tournamentHistory: Array.isArray((raw as Partial<PlayerDataRecord>).tournamentHistory)
      ? (raw as Partial<PlayerDataRecord>).tournamentHistory!
      : [],
  }
  return { profile, data }
}

export async function updatePlayerPersonalInfo(params: {
  uid: string
  name: string
  department?: string
  studentId?: string
  batch?: string
  phone?: string
  bio?: string
}): Promise<void> {
  if (!params.name.trim()) throw new Error('Name is required.')
  await updatePlayerPersonalInfoInDb({
    uid: params.uid,
    personalInfo: {
      name: params.name,
      department: params.department,
      studentId: params.studentId,
      batch: params.batch,
      phone: params.phone,
      bio: params.bio,
    },
  })
}

