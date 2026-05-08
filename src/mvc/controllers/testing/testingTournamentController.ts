/**
 * Admin-only utility that bootstraps a fully-populated tournament for end-
 * to-end testing of the scoring system. It writes directly to the database
 * (no Firebase Auth accounts are created — the test players are synthetic
 * UIDs that the scoring engine can read just like real players).
 *
 * The button creates:
 *   - 1 tournament (type 1, 8 overs/innings, 2 groups, 8 max teams)
 *   - 8 teams, 11 players each (88 synthetic players)
 *   - For every synthetic player:
 *       /players/{uid}             profile
 *       /playerData/{uid}          empty career stats (defaultPlayerData)
 *       /roles/{uid}               'player'
 *       /playerTeamMemberships/{uid} membership in their team
 *   - Tournament is auto-started: groups, group-stage matches and the
 *     knockout bracket are generated.
 *
 * Once created, the admin can immediately open the tournament management
 * page and start scoring matches.
 */

import { setUserRoleInDb } from '../../models/firebase/roleRepository'
import { setPlayerProfileInDb } from '../../models/firebase/playerRepository'
import {
  setPlayerDataInDb,
} from '../../models/firebase/playerDataRepository'
import { defaultPlayerData } from '../../models/playerData/PlayerData'
import {
  setPlayerMembershipInDb,
  setTeamInTournamentInDb,
} from '../../models/firebase/teamRepository'
import { createTournamentInDb } from '../../models/firebase/tournamentRepository'
import { startTournament } from '../tournaments/tournamentManagementController'
import type { TeamRecord } from '../../models/tournament/Tournament'

const TEAM_NAMES = [
  'BRAC Strikers',
  'Dhaka Tigers',
  'Chittagong Kings',
  'Sylhet Warriors',
  'Khulna Royals',
  'Rangpur Riders',
  'Barisal Bulls',
  'Mymensingh Mavericks',
] as const

const FIRST_NAMES = [
  'Tamim', 'Mushfiqur', 'Shakib', 'Mahmudullah', 'Liton', 'Soumya', 'Mehidy',
  'Mustafizur', 'Taskin', 'Ebadot', 'Afif', 'Nurul', 'Imrul', 'Najmul',
  'Mominul', 'Mahedi', 'Yasir', 'Saif', 'Rishad', 'Towhid', 'Anamul',
  'Shoriful', 'Hasan', 'Tanzim', 'Litton', 'Kamrul', 'Rubel', 'Sabbir',
  'Naim', 'Shamim', 'Parvez', 'Aminul', 'Rakibul', 'Rejaur', 'Nasum',
  'Aafia', 'Sumon', 'Robiul', 'Khaled', 'Rohan', 'Ahsan', 'Foysal',
  'Tariq', 'Imran', 'Sajid', 'Faisal', 'Iftekhar', 'Junaid',
] as const

const LAST_NAMES = [
  'Iqbal', 'Rahim', 'Hasan', 'Riyad', 'Das', 'Sarkar', 'Miraz', 'Rahman',
  'Ahmed', 'Hossain', 'Khan', 'Mahmud', 'Kayes', 'Shanto', 'Haque',
  'Al-Imran', 'Sheikh', 'Talukder', 'Bhuiyan', 'Roy', 'Khan', 'Akram',
  'Alam', 'Choudhury', 'Akbar', 'Karim', 'Mannan', 'Saleh', 'Hridoy',
  'Sarker', 'Patwary', 'Reza', 'Chowdhury', 'Murshed', 'Alam', 'Pathan',
  'Mridha', 'Mondol', 'Howlader', 'Biswas', 'Joarder', 'Pramanik',
] as const

function pick<T>(arr: readonly T[], seed: number): T {
  return arr[seed % arr.length]
}

function makePlayerName(seed: number): string {
  const first = pick(FIRST_NAMES, seed * 13 + 5)
  const last = pick(LAST_NAMES, seed * 31 + 7)
  return `${first} ${last}`
}

/** Format YYYY-MM-DD for n days from today. */
function dateOffset(daysFromToday: number): string {
  const d = new Date()
  d.setDate(d.getDate() + daysFromToday)
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

export type TestTournamentProgress =
  | { phase: 'creating-tournament' }
  | { phase: 'creating-players'; done: number; total: number }
  | { phase: 'creating-teams'; done: number; total: number }
  | { phase: 'starting-tournament' }
  | { phase: 'done'; tournamentId: string }

export type CreateTestTournamentParams = {
  adminUid: string
  onProgress?: (p: TestTournamentProgress) => void
}

const NUM_TEAMS = 8
const PLAYERS_PER_TEAM = 11
const TOTAL_PLAYERS = NUM_TEAMS * PLAYERS_PER_TEAM // 88

export async function createTestTournament(
  params: CreateTestTournamentParams,
): Promise<string> {
  const { adminUid, onProgress } = params

  /* ---------- 1. Create the tournament ---------- */

  onProgress?.({ phase: 'creating-tournament' })

  const tournamentName = `Test Tournament ${new Date().toLocaleString()}`
  const tournamentId = await createTournamentInDb({
    createdByUid: adminUid,
    input: {
      tournamentName,
      startDate: dateOffset(0),
      endDate: dateOffset(14),
      numberOfGroups: 2,
      maxTeams: 8,
      tournamentType: 1,
      oversPerMatch: 8,
    },
    status: 'UPCOMING',
  })

  /* ---------- 2. Create 88 synthetic players ---------- */

  // We keep UIDs deterministic per (tournamentId, teamIdx, playerIdx) so a
  // re-run with the same tournamentId would overwrite cleanly (it won't,
  // since each call creates a new tournamentId).
  const tournamentSlug = tournamentId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 12)

  let playersDone = 0
  onProgress?.({
    phase: 'creating-players',
    done: 0,
    total: TOTAL_PLAYERS,
  })

  const teamRosters: { teamIdx: number; uids: string[]; names: string[] }[] = []

  for (let teamIdx = 0; teamIdx < NUM_TEAMS; teamIdx += 1) {
    const uids: string[] = []
    const names: string[] = []

    // Create 11 players per team in parallel, then walk to next team so
    // progress increments are sensible.
    const tasks: Promise<void>[] = []
    for (let playerIdx = 0; playerIdx < PLAYERS_PER_TEAM; playerIdx += 1) {
      const seed = teamIdx * PLAYERS_PER_TEAM + playerIdx
      const uid = `test_${tournamentSlug}_t${teamIdx}_p${playerIdx}`
      const name = makePlayerName(seed)
      const email = `test_${tournamentSlug}_t${teamIdx}_p${playerIdx}@bracu.test`
      uids.push(uid)
      names.push(name)

      tasks.push(
        (async () => {
          await Promise.all([
            setPlayerProfileInDb(uid, {
              name,
              email,
              createdAt: Date.now(),
              department: 'CSE',
              studentId: `T${tournamentSlug.slice(0, 4)}${seed.toString().padStart(2, '0')}`,
              batch: '60',
              phone: '',
              bio: 'Synthetic player for scoring system tests.',
            }),
            setPlayerDataInDb(uid, defaultPlayerData),
            setUserRoleInDb(uid, 'player'),
          ])
          playersDone += 1
          onProgress?.({
            phase: 'creating-players',
            done: playersDone,
            total: TOTAL_PLAYERS,
          })
        })(),
      )
    }
    await Promise.all(tasks)

    teamRosters.push({ teamIdx, uids, names })
  }

  /* ---------- 3. Create 8 teams + memberships ---------- */

  let teamsDone = 0
  onProgress?.({ phase: 'creating-teams', done: 0, total: NUM_TEAMS })

  for (const roster of teamRosters) {
    const teamId = `test_team_${roster.teamIdx}_${tournamentSlug}`
    const managerUid = roster.uids[0]
    const team: TeamRecord = {
      id: teamId,
      teamName: TEAM_NAMES[roster.teamIdx] ?? `Test Team ${roster.teamIdx + 1}`,
      addedAt: Date.now(),
      managerUid,
      memberUids: roster.uids,
    }

    await setTeamInTournamentInDb({ tournamentId, team })

    await Promise.all(
      roster.uids.map((uid) =>
        setPlayerMembershipInDb({
          uid,
          membership: {
            teamId,
            tournamentId,
            role: uid === managerUid ? 'MANAGER' : 'MEMBER',
          },
        }),
      ),
    )

    teamsDone += 1
    onProgress?.({ phase: 'creating-teams', done: teamsDone, total: NUM_TEAMS })
  }

  /* ---------- 4. Start the tournament ---------- */

  onProgress?.({ phase: 'starting-tournament' })
  await startTournament({ tournamentId })

  onProgress?.({ phase: 'done', tournamentId })
  return tournamentId
}
