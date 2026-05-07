import {
  createComplaintInDb,
  deleteComplaintInDb,
  getAllComplaintsFromDb,
  getComplaintByIdFromDb,
  updateComplaintInDb,
} from '../../models/firebase/complaintRepository'
import type {
  ComplaintRecord,
  ComplaintStatus,
  ComplaintSubmitInput,
} from '../../models/complaint/Complaint'

export async function submitComplaint(
  input: ComplaintSubmitInput,
): Promise<string> {
  const subject = input.subject.trim()
  const description = input.description.trim()
  if (!subject) throw new Error('Subject is required.')
  if (!description) throw new Error('Description is required.')
  if (description.length < 10) {
    throw new Error('Description should be at least 10 characters.')
  }
  if (!input.isAnonymous && !input.submitterUid) {
    throw new Error('Submitter info missing for non-anonymous complaint.')
  }

  const now = Date.now()

  // Build the record. Critically, when anonymous, we strip identifying fields
  // so the database itself does not retain them. Firebase rejects undefined
  // values, so we conditionally include keys only when set.
  const base = {
    subject,
    description,
    category: input.category,
    status: 'OPEN' as ComplaintStatus,
    isAnonymous: input.isAnonymous,
    createdAt: now,
    updatedAt: now,
  }

  const record: Omit<ComplaintRecord, 'id'> = input.isAnonymous
    ? base
    : {
        ...base,
        submitterUid: input.submitterUid,
        submitterName: input.submitterName ?? '',
        submitterEmail: input.submitterEmail ?? '',
      }

  return createComplaintInDb(record)
}

export async function getAllComplaintsForAdmin(): Promise<ComplaintRecord[]> {
  const all = await getAllComplaintsFromDb()
  return all.slice().sort((a, b) => b.createdAt - a.createdAt)
}

export async function getMyComplaints(uid: string): Promise<ComplaintRecord[]> {
  const all = await getAllComplaintsFromDb()
  return all
    .filter((c) => !c.isAnonymous && c.submitterUid === uid)
    .sort((a, b) => b.createdAt - a.createdAt)
}

export async function updateComplaintStatus(params: {
  complaintId: string
  status: ComplaintStatus
  resolutionNote?: string
  adminUid: string
}): Promise<void> {
  const { complaintId, status, resolutionNote, adminUid } = params
  const existing = await getComplaintByIdFromDb(complaintId)
  if (!existing) throw new Error('Complaint not found.')

  const patch: Partial<ComplaintRecord> = {
    status,
    updatedAt: Date.now(),
    updatedByAdminUid: adminUid,
  }
  if (resolutionNote !== undefined) {
    patch.resolutionNote = resolutionNote.trim()
  }

  await updateComplaintInDb(complaintId, patch)
}

export async function deleteComplaint(complaintId: string): Promise<void> {
  await deleteComplaintInDb(complaintId)
}
