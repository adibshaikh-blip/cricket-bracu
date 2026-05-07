import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../controllers/auth/useAuth'

export default function PlayerLoginPage() {
  const navigate = useNavigate()
  const { signIn, signOut, refreshRole } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      await signIn({ email, password })
      const currentRole = await refreshRole()
      if (currentRole !== 'player') {
        await signOut()
        setError('Not authorized as Player.')
        return
      }
      navigate('/player/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1 className="auth-title">Player Login</h1>
        <p className="auth-sub">Sign in to access your player dashboard.</p>

        <form className="admin-form-grid" onSubmit={onSubmit}>
          <label className="admin-label">
          Email
          <input
            className="admin-input"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
          />
        </label>

          <label className="admin-label">
          Password
          <input
            className="admin-input"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
          />
        </label>

          <button className="admin-button primary" disabled={loading} type="submit">
            {loading ? 'Signing in...' : 'Sign in'}
          </button>

          {error ? <p className="admin-error">{error}</p> : null}
        </form>

        <p style={{ marginTop: 12 }}>
          New here?{' '}
          <Link to="/player/register" className="auth-link">
            Create an account
          </Link>
        </p>
      </div>
    </div>
  )
}

