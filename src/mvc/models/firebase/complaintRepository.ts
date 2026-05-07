import { get, push, ref, remove, update } from 'firebase/database'
import { db } from './firebase'
import type { ComplaintRecord } from '../complaint/Complaint'

function complaintsRootRef() {
  return ref(db, '/complaints')
}

function complaintRef(id: string) {
  return ref(db, `/complaints/${id}`)
}

export async function createComplaintInDb(
  record: Omit<ComplaintRecord, 'id'>,
): Promise<string> {
  const newRef = push(complaintsRootRef())
  const id = newRef.key
  if (!id) throw new Error('Failed to create complaint id.')
  await update(complaintRef(id), { ...record, id })
  return id
}

export async function updateComplaintInDb(
  id: string,
  patch: Partial<ComplaintRecord>,
): Promise<void> {
  await update(complaintRef(id), patch)
}

export async function deleteComplaintInDb(id: string): Promise<void> {
  await remove(complaintRef(id))
}

export async function getAllComplaintsFromDb(): Promise<ComplaintRecord[]> {
  const snap = await get(complaintsRootRef())
  const value = snap.val() as Record<string, ComplaintRecord> | null
  if (!value) return []
  return Object.values(value)
}

export async function getComplaintByIdFromDb(
  id: string,
): Promise<ComplaintRecord | null> {
  const snap = await get(complaintRef(id))
  return snap.val() as ComplaintRecord | null
}
