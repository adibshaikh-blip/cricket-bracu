import { get, ref, remove, set, update } from 'firebase/database'
import { db } from './firebase'
import type { ClubMemberRecord } from '../club/ClubMember'

function clubRootRef() {
  return ref(db, '/clubMembers')
}

function memberRef(uid: string) {
  return ref(db, `/clubMembers/${uid}`)
}

export async function getAllClubMembersFromDb(): Promise<ClubMemberRecord[]> {
  const snap = await get(clubRootRef())
  const value = snap.val() as Record<string, ClubMemberRecord> | null
  if (!value) return []
  return Object.values(value)
}

export async function getClubMemberFromDb(
  uid: string,
): Promise<ClubMemberRecord | null> {
  const snap = await get(memberRef(uid))
  return snap.val() as ClubMemberRecord | null
}

export async function setClubMemberInDb(record: ClubMemberRecord): Promise<void> {
  await set(memberRef(record.uid), record)
}

export async function updateClubMemberInDb(
  uid: string,
  patch: Partial<ClubMemberRecord>,
): Promise<void> {
  await update(memberRef(uid), patch)
}

export async function removeClubMemberInDb(uid: string): Promise<void> {
  await remove(memberRef(uid))
}
