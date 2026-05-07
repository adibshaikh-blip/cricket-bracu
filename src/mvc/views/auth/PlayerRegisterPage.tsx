import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../controllers/auth/useAuth'

export default function PlayerRegisterPage() {
  const navigate = useNavigate()
  const { registerPlayer, refreshRole } = useAuth()

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      if (password !== confirm) {
        setError('Passwords do not match.')
        return
      }
      if (password.length < 6) {
        setError('Password must be at least 6 characters.')
        return
      }

      await registerPlayer({ name, email, password })

      const currentRole = await refreshRole()
      if (currentRole !== 'player') {
        setError('Account created but role assignment failed.')
        return
      }

      navigate('/player/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1 className="auth-title">Player Register</h1>
        <p className="auth-sub">Create your account to access the player dashboard.</p>

        <form className="admin-form-grid" onSubmit={onSubmit}>
          <label className="admin-label">
          Name
          <input
            className="admin-input"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>

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

          <label className="admin-label">
          Confirm Password
          <input
            className="admin-input"
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            type="password"
          />
        </label>

          <button className="admin-button primary" disabled={loading} type="submit">
            {loading ? 'Creating...' : 'Create account'}
          </button>

          {error ? <p className="admin-error">{error}</p> : null}
        </form>

        <p style={{ marginTop: 12 }}>
          Already have an account?{' '}
          <Link to="/player/login" className="auth-link">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}

