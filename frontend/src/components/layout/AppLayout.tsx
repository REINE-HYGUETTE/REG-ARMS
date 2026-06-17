import { Outlet, Navigate } from 'react-router-dom'
import { useAuth } from '@/lib/auth'
import Sidebar from './Sidebar'
import Topbar from './Topbar'

export default function AppLayout() {
  const { isAuthenticated } = useAuth()

  // React 18 batches setState asynchronously, so isAuthenticated can briefly be
  // false right after login even though saveAuth already wrote the token to
  // localStorage. Fall back to localStorage so we don't bounce back to /login.
  const hasToken = isAuthenticated || !!localStorage.getItem('reg_token')
  if (!hasToken) return <Navigate to="/login" replace />

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#f8fafc' }}>
      <Sidebar />
      <main className="ml-60 min-h-screen flex flex-col" style={{ backgroundColor: '#f8fafc' }}>
        <Topbar title="" />
        <div className="flex-1 p-6">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
