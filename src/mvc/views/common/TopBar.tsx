import { Link, NavLink } from 'react-router-dom'
import { useAuth } from '../../controllers/auth/useAuth'

export default function TopBar() {
  const { user, role, signOut } = useAuth()

  return (
    <header className="topbar">
      <div className="topbar-inner">
        <div className="topbar-group">
          <Link to="/" className="brand">
            <span className="brand-mark">CB</span>
            <span className="brand-text">
              <span className="brand-main">Cricket BracU</span>
              <span className="brand-tag">Your university cricket hub</span>
            </span>
          </Link>
        </div>

        <nav className="topbar-group" aria-label="Primary">
          <NavLink to="/" end className="topbar-link">
            Home
          </NavLink>
          <NavLink to="/tournaments" className="topbar-link">
            Tournaments
          </NavLink>
          <NavLink to="/rankings" className="topbar-link">
            Rankings
          </NavLink>

          {!user ? (
            <>
              <Link className="admin-button" to="/player/login">
                Player Login
              </Link>
              <Link className="admin-button outline-brand" to="/admin/login">
                Admin Login
              </Link>
            </>
          ) : (
            <>
              {role === 'player' ? (
                <Link className="admin-button" to="/player/dashboard">
                  My Dashboard
                </Link>
              ) : null}
              {role === 'admin' ? (
                <Link className="admin-button" to="/admin/dashboard">
                  Admin Dashboard
                </Link>
              ) : null}
              <button
                className="admin-button"
                type="button"
                onClick={async () => {
                  await signOut()
                }}
              >
                Sign out
              </button>
            </>
          )}
        </nav>
      </div>
    </header>
  )
}
