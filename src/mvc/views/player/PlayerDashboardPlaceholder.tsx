import { useAuth } from '../../controllers/auth/useAuth'
import { useNavigate } from 'react-router-dom'

export default function PlayerDashboardPlaceholder() {
  const navigate = useNavigate()
  const { user, signOut } = useAuth()

  return (
    <div style={{ textAlign: 'left', maxWidth: 720, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
        <h1 style={{ marginTop: 24 }}>Player Dashboard</h1>
        <div>
          <button
            type="button"
            onClick={async () => {
              await signOut()
              navigate('/player/login')
            }}
            style={{
              padding: '8px 12px',
              borderRadius: 8,
              border: '1px solid var(--border)',
              cursor: 'pointer',
            }}
          >
            Sign out
          </button>
        </div>
      </div>

      <p style={{ marginTop: 6, color: 'var(--text)' }}>
        Signed in as: <b>{user?.email ?? 'Unknown'}</b>
      </p>

      <div
        style={{
          marginTop: 20,
          border: '1px solid var(--border)',
          borderRadius: 12,
          padding: 16,
        }}
      >
        <h2 style={{ marginTop: 0 }}>Placeholder</h2>
        <p style={{ marginTop: 8 }}>
          Player features (match schedules, live scoring, team management, etc.) will
          be implemented in upcoming versions.
        </p>
      </div>
    </div>
  )
}

