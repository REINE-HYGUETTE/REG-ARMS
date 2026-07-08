import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '@/lib/auth'
import { useQueryClient } from '@tanstack/react-query'
import {
  LayoutDashboard, FileText, Users, Wrench, BarChart3,
  Bell, LogOut, ClipboardList, Brain, UserCircle,
  PlusCircle, KanbanSquare, CheckCircle2, CalendarClock, Tag,
  FileBarChart2, TrendingUp
} from 'lucide-react'
import type { UserRole } from '@/types'

interface NavItem {
  label: string
  to: string
  icon: React.ReactNode
  roles: UserRole[]
  badge?: number
}

const navItems: NavItem[] = [
  { label: 'Dashboard',      to: '/',               icon: <LayoutDashboard size={18} />, roles: ['ADMIN', 'STAFF', 'TECHNICIAN', 'CUSTOMER'] },
  { label: 'Submit Request', to: '/submit-request', icon: <PlusCircle size={18} />,      roles: ['CUSTOMER'] },
  { label: 'My Requests',    to: '/my-requests',    icon: <ClipboardList size={18} />,   roles: ['CUSTOMER'] },
  { label: 'Requests',       to: '/requests',       icon: <FileText size={18} />,        roles: ['STAFF'] },
  { label: 'Assigned Tasks', to: '/tasks',          icon: <ClipboardList size={18} />,   roles: ['TECHNICIAN'] },
  { label: 'Kanban Board',   to: '/kanban',         icon: <KanbanSquare size={18} />,    roles: ['STAFF', 'TECHNICIAN'] },
  { label: 'Completed',      to: '/completed',      icon: <CheckCircle2 size={18} />,    roles: ['STAFF', 'TECHNICIAN'] },
  { label: 'Users & Roles',  to: '/users',          icon: <Users size={18} />,           roles: ['ADMIN'] },
  { label: 'Categories',     to: '/categories',     icon: <Tag size={18} />,             roles: ['ADMIN'] },
  { label: 'Technicians',    to: '/technicians',    icon: <Wrench size={18} />,          roles: ['ADMIN', 'STAFF'] },
  { label: 'AI Predictions', to: '/ai-predictions', icon: <Brain size={18} />,           roles: ['ADMIN'] },
  { label: 'Reports',        to: '/reports',        icon: <FileBarChart2 size={18} />,   roles: ['ADMIN', 'STAFF'] },
  { label: 'Analytics',      to: '/analytics',      icon: <TrendingUp size={18} />,      roles: ['ADMIN'] },
  { label: 'My Availability',to: '/availability',   icon: <CalendarClock size={18} />,   roles: ['TECHNICIAN'] },
  { label: 'Notifications',  to: '/notifications',  icon: <Bell size={18} />,            roles: ['ADMIN', 'STAFF', 'TECHNICIAN', 'CUSTOMER'] },
  { label: 'Profile',        to: '/profile',        icon: <UserCircle size={18} />,      roles: ['ADMIN', 'STAFF', 'TECHNICIAN', 'CUSTOMER'] },
]

const portalLabels: Record<UserRole, string> = {
  ADMIN:      'Admin Portal',
  STAFF:      'Staff Portal',
  TECHNICIAN: 'Technician Portal',
  CUSTOMER:   'Customer Portal',
}

export default function Sidebar() {
  const { role, fullName, logout } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  if (!role) return null

  const filtered = navItems.filter((item) => item.roles.includes(role))
  const initials = fullName?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() ?? ''

  const handleLogout = () => {
    logout()
    // Clear all cached queries so the next user starts with a clean slate
    queryClient.clear()
    navigate('/login')
  }

  return (
    <aside className="fixed left-0 top-0 bottom-0 w-60 bg-primary-dark flex flex-col z-40">
      <div className="px-5 py-5 border-b border-white/10">

        <div className="flex items-center gap-3">

          {/* Logo Image */}
          <div className="w-12 h-12 rounded-lg overflow-hidden bg-white p-1">
            <img
              src="/REG logo.png"
              alt="REG Logo"
              className="w-full h-full object-contain"
            />
          </div>

          {/* Title */}
          <div>
            <div className="text-white font-bold text-sm">REG ARMS</div>
            <div className="text-white/60 text-[10px]">
              {portalLabels[role]}
            </div>
          </div>

        </div>
      </div>

      <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-0.5">
        {filtered.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                isActive
                  ? 'bg-white/15 text-white border-l-3 border-accent'
                  : 'text-white/70 hover:bg-white/8 hover:text-white'
              }`
            }
          >
            {item.icon}
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-white/10">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 rounded-full bg-accent/20 flex items-center justify-center text-accent text-xs font-bold">
            {initials}
          </div>

          <div className="flex-1 min-w-0">
            <div className="text-white text-sm font-medium truncate">
              {fullName}
            </div>

            <div className="text-white/50 text-[11px] capitalize">
              {role.toLowerCase()}
            </div>
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-white/60 hover:bg-white/8 hover:text-white text-sm transition-colors"
        >
          <LogOut size={16} />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  )
}
