import { Bell, ChevronRight } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { Link, useLocation } from 'react-router-dom'
import { useNotificationStream } from '@/hooks/useNotificationStream'
import { useState, useEffect } from 'react'

const pageTitles: Record<string, string> = {
  '/':                   'Dashboard',
  '/dashboard/admin':    'Dashboard',
  '/dashboard/customer': 'Dashboard',
  '/dashboard/operator': 'Dashboard',
  '/submit-request':     'Submit Request',
  '/my-requests':        'My Requests',
  '/requests':           'All Requests',
  '/tasks':              'Assigned Tasks',
  '/kanban':             'Kanban Board',
  '/completed':          'Completed',
  '/ai-predictions':     'AI Predictions',
  '/reports':            'Reports',
  '/analytics':          'Analytics',
  '/technicians':        'Technicians',
  '/categories':         'Categories',
  '/users':              'Users & Roles',
  '/availability':       'My Availability',
  '/notifications':      'Notifications',
  '/profile':            'My Profile',
}

const STORAGE_KEY = (userId?: number) => `reg_arms_avatar_${userId}`

export default function Topbar({ title = '' }: { title?: string }) {
  const { role, fullName, userId } = useAuth()
  const { pathname } = useLocation()

  // SSE real-time notification stream
  useNotificationStream(true)

  // Profile picture — localStorage for instant paint, backend as source of truth
  const [avatarSrc, setAvatarSrc] = useState<string | null>(() => {
    try { return localStorage.getItem(STORAGE_KEY(userId ?? undefined)) }
    catch { return null }
  })

  // Fetch profile from backend to get the persisted photo
  const { data: profileData } = useQuery({
    queryKey: ['profile', userId],
    queryFn: async () => {
      const { data } = await api.get<{ profilePhoto?: string }>('/profile')
      return data
    },
    staleTime: 5 * 60_000,
    enabled: !!userId,
  })

  useEffect(() => {
    if (profileData?.profilePhoto) {
      setAvatarSrc(profileData.profilePhoto)
      // Keep localStorage in sync for instant paint on next load
      try { localStorage.setItem(STORAGE_KEY(userId ?? undefined), profileData.profilePhoto) }
      catch { /* storage full – ignore */ }
    }
  }, [profileData, userId])

  useEffect(() => {
    // Listen for live avatar changes fired from ProfilePage
    const handler = (e: Event) => setAvatarSrc((e as CustomEvent<string>).detail)
    window.addEventListener('avatar-updated', handler)
    return () => window.removeEventListener('avatar-updated', handler)
  }, [])

  const { data: unread } = useQuery({
    queryKey: ['unread-count'],
    queryFn: async () => {
      const { data } = await api.get<{ count: number }>('/notifications/unread-count')
      return data.count
    },
    refetchInterval: 60_000,
  })

  // Avatar initials fallback
  const initials = fullName
    ?.split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0].toUpperCase())
    .join('') ?? '?'

  // Breadcrumb: show section name for detail pages
  const isDetail = /\/requests\/\d+$/.test(pathname)
  const basePath = pathname.replace(/\/\d+$/, '').replace(/\/$/, '') || '/'
  const sectionTitle = pageTitles[basePath] ?? title

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-sm border-b border-border/80 h-16 flex items-center justify-between px-6 shadow-[0_1px_3px_0_rgba(0,0,0,0.04)]">

      {/* Left: title + optional breadcrumb */}
      <div className="flex items-center gap-2 min-w-0">
        <h1 className="text-[15px] font-bold text-text truncate">{sectionTitle}</h1>
        {isDetail && (
          <>
            <ChevronRight size={14} className="text-text-muted shrink-0" />
            <span className="text-[13px] text-text-muted truncate">Request Details</span>
          </>
        )}
      </div>

      {/* Right: date · notifications · avatar */}
      <div className="flex items-center gap-3 shrink-0">
        {/* Date chip */}
        <span className="hidden sm:block text-[11px] font-medium text-text-muted bg-surface-alt px-3 py-1.5 rounded-full border border-border/60">
          {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
        </span>

        {/* Bell */}
        <Link
          to="/notifications"
          className="relative w-9 h-9 rounded-xl flex items-center justify-center text-text-secondary hover:bg-surface-alt hover:text-text transition-colors"
        >
          <Bell size={18} />
          {unread && unread > 0 && (
            <span className="absolute top-1 right-1 min-w-[16px] h-4 bg-danger text-white text-[9px] font-bold rounded-full flex items-center justify-center px-1 leading-none">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </Link>

        {/* User avatar → profile */}
        <Link
          to="/profile"
          className="flex items-center gap-2.5 group"
          title="My Profile"
        >
          <div className="w-9 h-9 rounded-xl overflow-hidden bg-primary text-white flex items-center justify-center text-xs font-bold shadow-sm group-hover:shadow-md group-hover:scale-105 transition-all duration-200 ring-2 ring-white">
            {avatarSrc ? (
              <img src={avatarSrc} alt="avatar" className="w-full h-full object-cover" />
            ) : (
              initials
            )}
          </div>
          <div className="hidden md:block leading-tight">
            <div className="text-[12px] font-semibold text-text truncate max-w-[120px]">{fullName}</div>
            <div className="text-[10px] text-text-muted capitalize">{role?.toLowerCase()}</div>
          </div>
        </Link>
      </div>
    </header>
  )
}
