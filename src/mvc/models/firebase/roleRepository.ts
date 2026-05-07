import { get, ref, set } from 'firebase/database'
import { db } from './firebase'
import type { UserRole } from '../UserRole'

type RoleDbValue = UserRole | null

function roleRef(uid: string) {
  return ref(db, `/roles/${uid}`)
}

export async function getUserRoleFromDb(uid: string): Promise<UserRole | null> {
  const snapshot = await get(roleRef(uid))
  const value = snapshot.val() as RoleDbValue
  if (value === 'admin' || value === 'player') return value
  return null
}

export async function setUserRoleInDb(uid: string, role: UserRole): Promise<void> {
  await set(roleRef(uid), role)
}

