import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import type { UserRole } from '../../models/UserRole'
import { useAuth } from '../auth/useAuth'

export function RequireRole({
  requiredRole,
  children,
}: {
  requiredRole: UserRole
  children: ReactNode
}) {
  const { authReady, user, role } = useAuth()

  if (!authReady) return <div>Loading...</div>
  if (!user) {
    return <Navigate to={requiredRole === 'admin' ? '/admin/login' : '/player/login'} replace />
  }
  if (role !== requiredRole) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}

