export type BattingStats = {
  matches: number
  innings: number
  runs: number
  ballsFaced: number
  outs: number
  fours: number
  sixes: number
  highestScore: number
  fifties: number
  hundreds: number
}

export type BowlingStats = {
  matches: number
  overs: number
  runsConceded: number
  wickets: number
  maidens: number
  bestFigures: string
  economy: number
  dotBalls: number
}

export type TournamentParticipation = {
  tournamentId: string
  tournamentName: string
  teamName: string
  role: 'MANAGER' | 'MEMBER' | 'PLAYER'
  year: number
}

export type PlayerDataRecord = {
  batting: BattingStats
  bowling: BowlingStats
  tournamentHistory: TournamentParticipation[]
}

export const defaultPlayerData: PlayerDataRecord = {
  batting: {
    matches: 0,
    innings: 0,
    runs: 0,
    ballsFaced: 0,
    outs: 0,
    fours: 0,
    sixes: 0,
    highestScore: 0,
    fifties: 0,
    hundreds: 0,
  },
  bowling: {
    matches: 0,
    overs: 0,
    runsConceded: 0,
    wickets: 0,
    maidens: 0,
    bestFigures: '0/0',
    economy: 0,
    dotBalls: 0,
  },
  tournamentHistory: [],
}
