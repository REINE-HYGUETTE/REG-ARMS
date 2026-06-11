import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/lib/auth'
import type { UserRole } from '@/types'

interface Props {
  roles: UserRole[]
  children: React.ReactNode
}

export default function ProtectedRoute({ roles, children }: Props) {
  const { isAuthenticated, role } = useAuth()
  const location = useLocation()

  if (!isAuthenticated) {
    // Preserve the intended URL so LoginPage can redirect back after login
    return <Navigate to="/login" state={{ from: location.pathname + location.search }} replace />
  }
  if (role && !roles.includes(role)) return <Navigate to="/" replace />

  return <>{children}</>
}
