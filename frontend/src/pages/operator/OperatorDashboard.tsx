import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { useAuth } from '@/lib/auth'
import MetricCard from '@/components/ui/MetricCard'
import { PriorityBadge, StatusBadge } from '@/components/ui/Badge'
import type { DashboardStats, Hotspot, Page, RequestListItem, Technician } from '@/types'
import {
  ClipboardList, Loader, CheckCircle, Star,
  Flame, MapPin, AlertTriangle, ArrowRight,
} from 'lucide-react'
import { Link } from 'react-router-dom'

const severityConfig = {
  CRITICAL: { bg: 'bg-red-50    border-red-200',    dot: 'bg-red-500',    label: 'text-red-700',    Icon: Flame         },
  HIGH:     { bg: 'bg-amber-50  border-amber-200',  dot: 'bg-amber-500',  label: 'text-amber-700',  Icon: AlertTriangle },
  MODERATE: { bg: 'bg-blue-50   border-blue-200',   dot: 'bg-blue-500',   label: 'text-blue-700',   Icon: MapPin        },
}

export default function OperatorDashboard() {
  const { role } = useAuth()
  const isTech  = role === 'TECHNICIAN'
  const isStaff = role === 'STAFF'

  // Recent task list (always needed for the task feed)
  const { data: tasksPage } = useQuery({
    queryKey: ['my-tasks', { page: 0, size: 10 }],
    queryFn: async () =>
      (await api.get<Page<RequestListItem>>('/requests', { params: { size: 10, sort: 'createdAt,desc' } })).data,
  })

  // Staff: use the stats endpoint for accurate aggregate counts
  const { data: dashStats } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async () => (await api.get<DashboardStats>('/requests/stats')).data,
    enabled: isStaff,
  })

  const { data: myProfile } = useQuery({
    queryKey: ['technician-me'],
    queryFn: async () => (await api.get<Technician>('/technicians/me')).data,
    enabled: isTech,
  })

  const { data: hotspots = [] } = useQuery({
    queryKey: ['hotspots'],
    queryFn: async () => (await api.get<Hotspot[]>('/reports/hotspots')).data,
    enabled: isStaff,
    refetchInterval: 5 * 60_000,
  })

  const tasks = tasksPage?.content ?? []

  // Metrics: prefer server-side counts for staff, fall back to page-slice for technicians
  const totalTasks = isStaff ? (dashStats?.total ?? tasks.length) : tasks.length
  const inProgress = isStaff ? (dashStats?.inProgress ?? 0) : tasks.filter((t) => t.status === 'In_Progress').length
  const resolved   = isStaff ? (dashStats?.resolved ?? 0)    : tasks.filter((t) => t.status === 'Resolved').length

  return (
    <div className="space-y-6">

      {/* ── Hotspot Alert Banner ── */}
      {isStaff && hotspots.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-8 h-8 rounded-xl bg-red-100 flex items-center justify-center">
              <Flame size={16} className="text-red-500" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-red-700">
                {hotspots.length} Active Hotspot{hotspots.length > 1 ? 's' : ''} Detected
              </h3>
              <p className="text-[11px] text-red-400">Last 24 hours · 3+ high-priority requests per sector</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {hotspots.map((h, i) => {
              const cfg = severityConfig[h.severity as keyof typeof severityConfig] ?? severityConfig.MODERATE
              return (
                <div key={i} className={`flex items-start gap-3 p-3.5 border rounded-xl ${cfg.bg}`}>
                  <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${cfg.dot}`} />
                  <div className="flex-1 min-w-0">
                    <div className={`text-xs font-bold truncate ${cfg.label}`}>{h.sector}, {h.district}</div>
                    <div className={`text-[11px] ${cfg.label} opacity-70`}>{h.province}</div>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <span className="text-[11px] font-semibold text-text-secondary">{h.requestCount} requests</span>
                      {h.criticalCount > 0 && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-red-100 text-red-700 rounded-md font-bold">
                          {h.criticalCount} critical
                        </span>
                      )}
                      {h.highCount > 0 && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded-md font-bold">
                          {h.highCount} high
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-text-muted mt-1">
                      Latest: {new Date(h.latestRequestAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                  <Link
                    to={`/requests?search=${encodeURIComponent(h.district)}`}
                    className={`text-[11px] font-bold hover:underline shrink-0 flex items-center gap-0.5 ${cfg.label}`}
                  >
                    View <ArrowRight size={10} />
                  </Link>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Metrics ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <MetricCard label={isStaff ? 'Total Requests' : 'Assigned Tasks'} value={isTech ? tasks.length : totalTasks} icon={<ClipboardList size={20} />} variant="blue"   />
        <MetricCard label="In Progress"    value={isTech ? tasks.filter((t) => t.status === 'In_Progress').length : inProgress} icon={<Loader size={20} />} variant="amber"  />
        <MetricCard
          label="Resolved"
          value={isTech ? (myProfile?.totalResolved ?? resolved) : resolved}
          icon={<CheckCircle size={20} />}
          variant="green"
        />
        <MetricCard
          label="Rating"
          value={isTech && myProfile?.rating ? `${Number(myProfile.rating).toFixed(1)}★` : '—'}
          icon={<Star size={20} />}
          variant="purple"
        />
      </div>

      {/* ── Task List ── */}
      <div className="bg-white rounded-2xl border border-border/70 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/70">
          <h3 className="text-sm font-bold text-text">
            {isStaff ? 'All Requests' : 'Assigned Tasks'}
          </h3>
          <Link to="/kanban" className="flex items-center gap-1 text-[11px] font-bold text-primary hover:text-primary-dark transition-colors">
            Kanban View <ArrowRight size={12} />
          </Link>
        </div>

        <div className="divide-y divide-border/50">
          {tasks.length === 0 ? (
            <div className="px-6 py-14 text-center">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center mx-auto mb-3">
                <ClipboardList size={20} className="text-blue-500" />
              </div>
              <p className="text-sm font-semibold text-text mb-1">No tasks assigned</p>
              <p className="text-xs text-text-muted">You'll see assigned requests here.</p>
            </div>
          ) : (
            tasks.map((t) => (
              <Link
                key={t.id}
                to={`/requests/${t.id}`}
                className="flex items-center gap-4 px-6 py-4 hover:bg-surface-alt/60 transition-colors group"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="font-mono text-[11px] font-bold text-primary bg-primary-light px-2 py-0.5 rounded-md">
                      {t.requestCode}
                    </span>
                    <PriorityBadge priority={t.finalPriority} />
                    <StatusBadge status={t.status} />
                    {t.slaStatus === 'BREACHED' && (
                      <span className="text-[10px] px-1.5 py-0.5 bg-red-50 text-red-700 rounded-md font-bold border border-red-200 flex items-center gap-1">
                        <AlertTriangle size={9} /> Breached
                      </span>
                    )}
                    {t.slaStatus === 'AT_RISK' && (
                      <span className="text-[10px] px-1.5 py-0.5 bg-amber-50 text-amber-700 rounded-md font-bold border border-amber-200 flex items-center gap-1">
                        <AlertTriangle size={9} /> At Risk
                      </span>
                    )}
                  </div>
                  <div className="text-sm font-semibold text-text truncate group-hover:text-primary transition-colors">
                    {t.title}
                  </div>
                  <div className="text-[11px] text-text-muted mt-0.5">{t.customerName} · {t.province}</div>
                </div>
                <div className="text-[11px] text-text-muted shrink-0 ml-2">
                  {new Date(t.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </div>
              </Link>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
