import type {
  TournamentCreateInput,
  TournamentTypeCode,
} from '../../models/tournament/Tournament'
import { createTournamentInDb } from '../../models/firebase/tournamentRepository'

export function validateTournamentCreateInput(input: TournamentCreateInput): string | null {
  if (!input.tournamentName.trim()) return 'Tournament name is required.'

  if (!input.startDate) return 'Start date is required.'
  if (!input.endDate) return 'End date is required.'
  if (input.endDate < input.startDate) return 'End date must be on/after start date.'

  if (!Number.isFinite(input.numberOfGroups) || input.numberOfGroups < 1) {
    return 'Number of groups must be at least 1.'
  }
  if (!Number.isFinite(input.maxTeams) || input.maxTeams < 1) {
    return 'Max number of teams must be at least 1.'
  }
  if (input.numberOfGroups * 3 > input.maxTeams) {
    return 'Each group must have at least 3 teams. Increase max number of teams.'
  }

  const validType: TournamentTypeCode[] = [1, 2]
  if (!validType.includes(input.tournamentType)) return 'Invalid tournament type.'

  if (
    !Number.isFinite(input.oversPerMatch) ||
    input.oversPerMatch < 1 ||
    input.oversPerMatch > 50 ||
    !Number.isInteger(input.oversPerMatch)
  ) {
    return 'Overs per match must be a whole number between 1 and 50.'
  }

  return null
}

export async function createTournament(params: {
  createdByUid: string
  input: TournamentCreateInput
}): Promise<string> {
  const error = validateTournamentCreateInput(params.input)
  if (error) throw new Error(error)

  return createTournamentInDb({
    createdByUid: params.createdByUid,
    input: params.input,
  })
}

