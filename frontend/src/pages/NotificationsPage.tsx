import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Bell, CheckCheck, ArrowRight,
  FileText, RefreshCw, UserCheck, CheckCircle2,
  AlertOctagon, MessageSquare, Settings2, Clock,
  BellOff, ChevronLeft, ChevronRight,
} from 'lucide-react'
import api from '@/lib/api'
import Spinner from '@/components/ui/Spinner'
import type { Notification, Page } from '@/types'
import { Link } from 'react-router-dom'

// ── Type config ───────────────────────────────────────────────────────────────
type NType = {
  icon: React.ReactNode
  iconBg: string
  iconColor: string
  dot: string
  label: string
  labelColor: string
}

const typeConfig: Record<string, NType> = {
  NEW_REQUEST:   { icon: <FileText size={14} />,      iconBg: 'bg-blue-50',    iconColor: 'text-blue-500',    dot: 'bg-blue-400',    label: 'New Request',   labelColor: 'text-blue-600'    },
  STATUS_UPDATE: { icon: <RefreshCw size={14} />,     iconBg: 'bg-amber-50',   iconColor: 'text-amber-500',   dot: 'bg-amber-400',   label: 'Status Update', labelColor: 'text-amber-600'   },
  ASSIGNMENT:    { icon: <UserCheck size={14} />,     iconBg: 'bg-violet-50',  iconColor: 'text-violet-500',  dot: 'bg-violet-400',  label: 'Assignment',    labelColor: 'text-violet-600'  },
  RESOLVED:      { icon: <CheckCircle2 size={14} />,  iconBg: 'bg-emerald-50', iconColor: 'text-emerald-500', dot: 'bg-emerald-400', label: 'Resolved',      labelColor: 'text-emerald-600' },
  URGENT_ALERT:  { icon: <AlertOctagon size={14} />,  iconBg: 'bg-red-50',     iconColor: 'text-red-500',     dot: 'bg-red-400',     label: 'Urgent Alert',  labelColor: 'text-red-600'     },
  COMMENT:       { icon: <MessageSquare size={14} />, iconBg: 'bg-sky-50',     iconColor: 'text-sky-500',     dot: 'bg-sky-400',     label: 'Comment',       labelColor: 'text-sky-600'     },
  SYSTEM:        { icon: <Settings2 size={14} />,     iconBg: 'bg-slate-50',   iconColor: 'text-slate-400',   dot: 'bg-slate-300',   label: 'System',        labelColor: 'text-slate-500'   },
}

function timeAgo(date: string): string {
  const diff = Date.now() - new Date(date).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 1)  return 'Just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d < 7)  return `${d}d ago`
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const PAGE_SIZE = 30

export default function NotificationsPage() {
  const queryClient = useQueryClient()
  const [page, setPage] = useState(0)

  const { data: notifPage, isLoading } = useQuery({
    queryKey: ['notifications', page],
    queryFn: async () => {
      const { data } = await api.get<Page<Notification>>('/notifications', {
        params: { size: PAGE_SIZE, page },
      })
      return data
    },
  })

  // Unread count from the dedicated endpoint — accurate regardless of current page
  const { data: unreadCount = 0 } = useQuery({
    queryKey: ['unread-count'],
    queryFn: async () => {
      const { data } = await api.get<{ count: number }>('/notifications/unread-count')
      return data.count
    },
  })

  const markReadMutation = useMutation({
    mutationFn: async (id: number) => api.patch(`/notifications/${id}/read`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
      queryClient.invalidateQueries({ queryKey: ['unread-count'] })
    },
  })

  const markAllReadMutation = useMutation({
    mutationFn: async () => api.patch('/notifications/read-all'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
      queryClient.invalidateQueries({ queryKey: ['unread-count'] })
    },
  })

  if (isLoading) return <div className="flex justify-center py-16"><Spinner /></div>

  const notifications = notifPage?.content ?? []
  const readCount = notifications.filter((n) => n.isRead).length

  const sorted = [...notifications].sort((a, b) => Number(a.isRead) - Number(b.isRead))
  const unread = sorted.filter((n) => !n.isRead)
  const read   = sorted.filter((n) => n.isRead)

  return (
    <div className="flex gap-6 w-full items-start">

      {/* ── Main feed ── */}
      <div className="flex-1 min-w-0">

        {/* Page header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-primary-light flex items-center justify-center">
              <Bell size={17} className="text-primary" />
            </div>
            <div>
              <h2 className="text-[15px] font-bold text-text flex items-center gap-2">
                Notifications
                {unreadCount > 0 && (
                  <span className="bg-primary text-white text-[10px] font-bold px-2 py-0.5 rounded-full leading-none tabular-nums">
                    {unreadCount}
                  </span>
                )}
              </h2>
              <p className="text-[11px] text-text-muted mt-0.5">
                {notifPage?.totalElements ?? 0} total · {unreadCount} unread
              </p>
            </div>
          </div>

          {unreadCount > 0 && (
            <button
              onClick={() => markAllReadMutation.mutate()}
              disabled={markAllReadMutation.isPending}
              className="flex items-center gap-1.5 text-xs font-semibold text-text-muted hover:text-primary px-3 py-1.5 rounded-lg hover:bg-primary/5 transition-colors disabled:opacity-50"
            >
              <CheckCheck size={14} />
              Mark all read
            </button>
          )}
        </div>

        {/* Empty state */}
        {(notifPage?.totalElements ?? 0) === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-14 h-14 rounded-2xl bg-surface-alt flex items-center justify-center mb-4">
              <BellOff size={24} className="text-text-muted" />
            </div>
            <p className="text-sm font-semibold text-text mb-1">All caught up</p>
            <p className="text-xs text-text-muted">No notifications yet. You'll be notified as activity happens.</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl overflow-hidden" style={{ boxShadow: '0 1px 3px 0 rgba(0,0,0,0.06), 0 1px 2px -1px rgba(0,0,0,0.04)' }}>

            {/* ── Unread section ── */}
            {unread.length > 0 && (
              <div>
                <div className="px-5 py-3 bg-surface-alt/60 border-b border-border/40">
                  <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">
                    New · {unread.length}
                  </span>
                </div>
                <div className="divide-y divide-border/30">
                  {unread.map((n) => (
                    <NotifRow
                      key={n.id}
                      n={n}
                      onRead={() => markReadMutation.mutate(n.id)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* ── Read section ── */}
            {read.length > 0 && (
              <div>
                <div className={`px-5 py-3 bg-surface-alt/60 border-b border-border/40 ${unread.length > 0 ? 'border-t border-border/40' : ''}`}>
                  <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">
                    Earlier · {read.length}
                  </span>
                </div>
                <div className="divide-y divide-border/30">
                  {read.map((n) => (
                    <NotifRow key={n.id} n={n} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Pagination */}
        {notifPage && notifPage.totalPages > 1 && (
          <div className="flex items-center justify-between mt-4">
            <p className="text-[11px] text-text-muted font-medium">
              Page {notifPage.number + 1} of {notifPage.totalPages}
            </p>
            <div className="flex items-center gap-1.5">
              <button
                disabled={notifPage.first}
                onClick={() => setPage((p) => p - 1)}
                className="w-8 h-8 flex items-center justify-center rounded-xl border-[1.5px] border-border hover:border-primary hover:text-primary disabled:opacity-30 transition-all"
              >
                <ChevronLeft size={15} />
              </button>
              <button
                disabled={notifPage.last}
                onClick={() => setPage((p) => p + 1)}
                className="w-8 h-8 flex items-center justify-center rounded-xl border-[1.5px] border-border hover:border-primary hover:text-primary disabled:opacity-30 transition-all"
              >
                <ChevronRight size={15} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Right sidebar ── */}
      <div className="hidden xl:flex flex-col gap-4 w-64 shrink-0">

        {/* Stats */}
        <div className="bg-white rounded-2xl p-5" style={{ boxShadow: '0 1px 3px 0 rgba(0,0,0,0.06)' }}>
          <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-4">Overview</p>
          <div className="space-y-3">
            {[
              { label: 'Total',  value: notifPage?.totalElements ?? 0, color: 'text-text'        },
              { label: 'Unread', value: unreadCount,                    color: 'text-primary'     },
              { label: 'Read',   value: (notifPage?.totalElements ?? 0) - unreadCount, color: 'text-emerald-600' },
              { label: 'Urgent', value: notifications.filter((n) => n.type === 'URGENT_ALERT').length, color: 'text-red-500' },
            ].map(({ label, value, color }) => (
              <div key={label} className="flex items-center justify-between">
                <span className="text-xs text-text-muted">{label}</span>
                <span className={`text-sm font-bold tabular-nums ${color}`}>{value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* By type */}
        {notifications.length > 0 && (
          <div className="bg-white rounded-2xl p-5" style={{ boxShadow: '0 1px 3px 0 rgba(0,0,0,0.06)' }}>
            <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-4">By Type</p>
            <div className="space-y-3">
              {Object.entries(
                notifications.reduce<Record<string, number>>((acc, n) => {
                  acc[n.type] = (acc[n.type] ?? 0) + 1
                  return acc
                }, {})
              )
                .sort(([, a], [, b]) => b - a)
                .slice(0, 6)
                .map(([type, count]) => {
                  const cfg = typeConfig[type] ?? typeConfig.SYSTEM
                  return (
                    <div key={type} className="flex items-center gap-2.5">
                      <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${cfg.iconBg}`}>
                        <span className={cfg.iconColor}>{cfg.icon}</span>
                      </div>
                      <span className="flex-1 text-[11px] text-text-secondary truncate">{cfg.label}</span>
                      <span className="text-xs font-bold text-text tabular-nums">{count}</span>
                    </div>
                  )
                })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/* ── Individual notification row ── */
function NotifRow({ n, onRead }: { n: Notification; onRead?: () => void }) {
  const cfg = typeConfig[n.type] ?? typeConfig.SYSTEM

  return (
    <div
      onClick={() => !n.isRead && onRead?.()}
      className={`group relative flex items-start gap-3.5 px-5 py-4 transition-colors cursor-pointer ${
        n.isRead
          ? 'hover:bg-surface-alt/40'
          : 'bg-primary/[0.025] hover:bg-primary/[0.04]'
      }`}
    >
      {/* Unread left accent */}
      {!n.isRead && (
        <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-primary rounded-r-full" />
      )}

      {/* Icon */}
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${cfg.iconBg} ${n.isRead ? 'opacity-60' : ''}`}>
        <span className={n.isRead ? 'text-text-muted' : cfg.iconColor}>{cfg.icon}</span>
      </div>

      {/* Body */}
      <div className="flex-1 min-w-0 pt-0.5">
        <div className="flex items-start justify-between gap-3 mb-0.5">
          <p className={`text-[13px] leading-snug ${n.isRead ? 'text-text-secondary font-medium' : 'text-text font-semibold'}`}>
            {n.title}
          </p>
          <div className="flex items-center gap-1.5 shrink-0">
            {!n.isRead && <span className={`w-1.5 h-1.5 rounded-full mt-1 ${cfg.dot}`} />}
            <span className="text-[10px] text-text-muted whitespace-nowrap flex items-center gap-0.5 mt-0.5">
              <Clock size={9} className="opacity-60" /> {timeAgo(n.createdAt)}
            </span>
          </div>
        </div>

        <p className={`text-[11px] leading-relaxed line-clamp-2 ${n.isRead ? 'text-text-muted' : 'text-text-secondary'}`}>
          {n.message}
        </p>

        <div className="flex items-center justify-between mt-2">
          <span className={`text-[10px] font-semibold ${n.isRead ? 'text-text-muted' : cfg.labelColor}`}>
            {cfg.label}
          </span>
          {n.requestId && (
            <Link
              to={`/requests/${n.requestId}`}
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-0.5 text-[11px] font-semibold text-primary opacity-0 group-hover:opacity-100 transition-opacity hover:underline"
            >
              View request <ArrowRight size={11} />
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}
