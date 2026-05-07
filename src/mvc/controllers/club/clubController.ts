import {
  getAllClubMembersFromDb,
  getClubMemberFromDb,
  removeClubMemberInDb,
  setClubMemberInDb,
  updateClubMemberInDb,
} from '../../models/firebase/clubRepository'
import {
  designationRank,
  isPanelDesignation,
  type ClubMemberRecord,
  type DepartmentId,
  type DesignationId,
} from '../../models/club/ClubMember'
import {
  getAllPlayersFromDb,
  getPlayerProfileFromDb,
  type PlayerSearchRecord,
} from '../../models/firebase/playerRepository'
import { getUserRoleFromDb } from '../../models/firebase/roleRepository'

export type ClubMemberView = ClubMemberRecord & {
  rank: number
  isPanel: boolean
}

function decorate(member: ClubMemberRecord): ClubMemberView {
  return {
    ...member,
    rank: designationRank(member.designation),
    isPanel: isPanelDesignation(member.designation),
  }
}

/* ---------- list ---------- */

export async function getAllClubMembers(): Promise<ClubMemberView[]> {
  const records = await getAllClubMembersFromDb()
  return records
    .map(decorate)
    // Highest designation first; ties broken by name.
    .sort((a, b) => b.rank - a.rank || a.playerName.localeCompare(b.playerName))
}

export async function getPanelMembers(): Promise<ClubMemberView[]> {
  const all = await getAllClubMembers()
  return all.filter((m) => m.isPanel)
}

export async function getMembersByDepartment(): Promise<
  Record<DepartmentId, ClubMemberView[]>
> {
  const all = await getAllClubMembers()
  const map = {} as Record<DepartmentId, ClubMemberView[]>
  for (const m of all) {
    if (!map[m.department]) map[m.department] = []
    map[m.department].push(m)
  }
  return map
}

/* ---------- player picker (admins choosing who to add) ---------- */

export async function getEligiblePlayersForClub(): Promise<PlayerSearchRecord[]> {
  const [players, members] = await Promise.all([
    getAllPlayersFromDb(),
    getAllClubMembersFromDb(),
  ])
  const taken = new Set(members.map((m) => m.uid))

  const decorated = await Promise.all(
    players.map(async (p) => {
      if (taken.has(p.uid)) return null
      const role = await getUserRoleFromDb(p.uid)
      if (role !== 'player') return null
      return p
    }),
  )
  return decorated.filter((p): p is PlayerSearchRecord => p !== null)
}

/* ---------- mutations ---------- */

export async function addClubMember(params: {
  playerUid: string
  designation: DesignationId
  department: DepartmentId
  adminUid: string
}): Promise<ClubMemberRecord> {
  const { playerUid, designation, department, adminUid } = params

  const role = await getUserRoleFromDb(playerUid)
  if (role !== 'player') {
    throw new Error('Only registered players can be added as club members.')
  }

  const existing = await getClubMemberFromDb(playerUid)
  if (existing) {
    throw new Error('This player is already a club member.')
  }

  const profile = await getPlayerProfileFromDb(playerUid)
  if (!profile) throw new Error('Player profile not found.')

  const record: ClubMemberRecord = {
    uid: playerUid,
    designation,
    department,
    joinedAt: Date.now(),
    addedByAdminUid: adminUid,
    playerName: profile.name,
    playerEmail: profile.email,
  }
  await setClubMemberInDb(record)
  return record
}

export async function updateMemberDesignation(params: {
  uid: string
  designation: DesignationId
}): Promise<void> {
  const { uid, designation } = params
  const existing = await getClubMemberFromDb(uid)
  if (!existing) throw new Error('Club member not found.')
  await updateClubMemberInDb(uid, { designation })
}

export async function updateMemberDepartment(params: {
  uid: string
  department: DepartmentId
}): Promise<void> {
  const { uid, department } = params
  const existing = await getClubMemberFromDb(uid)
  if (!existing) throw new Error('Club member not found.')
  await updateClubMemberInDb(uid, { department })
}

export async function removeClubMember(uid: string): Promise<void> {
  const existing = await getClubMemberFromDb(uid)
  if (!existing) throw new Error('Club member not found.')
  await removeClubMemberInDb(uid)
}

/** Refresh cached name/email if a player's profile was updated. */
export async function syncMemberProfile(uid: string): Promise<void> {
  const existing = await getClubMemberFromDb(uid)
  if (!existing) return
  const profile = await getPlayerProfileFromDb(uid)
  if (!profile) return
  if (
    profile.name !== existing.playerName ||
    profile.email !== existing.playerEmail
  ) {
    await updateClubMemberInDb(uid, {
      playerName: profile.name,
      playerEmail: profile.email,
    })
  }
}
