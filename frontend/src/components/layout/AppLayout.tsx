import { Outlet, Navigate } from 'react-router-dom'
import { useAuth } from '@/lib/auth'
import Sidebar from './Sidebar'
import Topbar from './Topbar'

export default function AppLayout() {
  const { isAuthenticated } = useAuth()

  if (!isAuthenticated) return <Navigate to="/login" replace />

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
