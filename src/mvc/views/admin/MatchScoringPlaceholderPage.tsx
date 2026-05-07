import { useParams } from 'react-router-dom'

export default function MatchScoringPlaceholderPage() {
  const { tournamentId, matchId } = useParams<{
    tournamentId: string
    matchId: string
  }>()

  return (
    <div style={{ textAlign: 'left', maxWidth: 800, margin: '0 auto' }}>
      <h1 style={{ marginTop: 24 }}>Match Scoring (Upcoming)</h1>
      <p style={{ color: 'var(--text)' }}>
        Tournament ID: <b>{tournamentId}</b>
      </p>
      <p style={{ color: 'var(--text)' }}>
        Match ID: <b>{matchId}</b>
      </p>
      <p style={{ marginTop: 16 }}>
        This page is reserved for the live scoring feature in the next version.
      </p>
    </div>
  )
}

