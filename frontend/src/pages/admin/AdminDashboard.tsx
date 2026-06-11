import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import MetricCard from '@/components/ui/MetricCard'
import Spinner from '@/components/ui/Spinner'
import type { DashboardStats } from '@/types'
import {
  FileText, Clock, CheckCircle, AlertTriangle,
  ShieldAlert, ShieldCheck, Timer, TrendingUp, Activity,
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
  AreaChart, Area,
} from 'recharts'

// ── Chart palette — matches CSS chart variables ──────────────────────────────
const C1 = '#3B82F6'   // Blue     - submitted
const C2 = '#10B981'   // Emerald  - resolved
const C3 = '#F59E0B'   // Amber    - pending
const C4 = '#8B5CF6'   // Violet
const C5 = '#F43F5E'   // Rose     - critical

const PRIORITY_COLORS: Record<string, string> = {
  Critical: C5,
  High:     '#F97316',
  Medium:   C3,
  Low:      C2,
}

interface SlaMetrics {
  breached: number
  atRisk: number
  resolvedWithinSla: number
  totalResolved: number
  withinSlaRate: number
}

// ── Custom tooltip ────────────────────────────────────────────────────────────
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white rounded-xl border border-border shadow-lg px-3.5 py-2.5 text-xs min-w-[120px]">
      {label && <p className="font-semibold text-text mb-1.5">{label}</p>}
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 text-text-muted">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: p.color }} />
            {p.name}
          </span>
          <span className="font-semibold text-text">{p.value}</span>
        </div>
      ))}
    </div>
  )
}

export default function AdminDashboard() {
  const { data: stats, isLoading, isError: statsError } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async () => (await api.get<DashboardStats>('/requests/stats')).data,
  })

  const { data: priorityData } = useQuery({
    queryKey: ['report-priority'],
    queryFn: async () => (await api.get<{ priority: string; count: number }[]>('/reports/by-priority')).data,
  })

  const { data: monthlyData } = useQuery({
    queryKey: ['report-monthly'],
    queryFn: async () =>
      (await api.get<{ month: string; total: number; resolved: number }[]>('/reports/monthly-volume')).data,
  })

  const { data: sla } = useQuery({
    queryKey: ['sla-metrics'],
    queryFn: async () => (await api.get<SlaMetrics>('/reports/sla-metrics')).data,
    refetchInterval: 2 * 60 * 1_000,
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner className="h-8 w-8" />
      </div>
    )
  }

  if (statsError) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertTriangle size={32} className="text-amber-500 mx-auto mb-3" />
          <p className="text-sm font-semibold text-text mb-1">Failed to load dashboard</p>
          <p className="text-xs text-text-muted">Check your connection and refresh the page.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-7">

      {/* ── SLA breach banner — shown when breached requests exist ── */}
      {sla && sla.breached > 0 && (
        <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
          <AlertTriangle size={20} className="text-red-600 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-red-700">
              {sla.breached} SLA {sla.breached === 1 ? 'Breach' : 'Breaches'} Detected
            </p>
            <p className="text-xs text-red-600 mt-0.5">
              {sla.breached} open {sla.breached === 1 ? 'request has' : 'requests have'} exceeded
              {' '}their SLA deadline and {sla.breached === 1 ? 'has' : 'have'} been auto-escalated to
              {' '}Critical priority. Staff has been notified to take immediate action.
            </p>
          </div>
        </div>
      )}

      {/* ── Row 1: Core KPIs ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <MetricCard
          label="Total Requests"
          value={(stats?.total ?? 0).toLocaleString()}
          icon={<FileText size={20} />}
          variant="blue"
          trend={{ value: `${stats?.thisWeek ?? 0} this week`, direction: 'neutral' }}
        />
        <MetricCard
          label="Pending"
          value={(stats?.pending ?? 0).toLocaleString()}
          icon={<Clock size={20} />}
          variant="amber"
        />
        <MetricCard
          label="Resolved"
          value={(stats?.resolved ?? 0).toLocaleString()}
          icon={<CheckCircle size={20} />}
          variant="green"
        />
        <MetricCard
          label="Critical"
          value={(stats?.critical ?? 0).toLocaleString()}
          icon={<AlertTriangle size={20} />}
          variant="red"
        />
      </div>

      {/* ── Row 2: SLA Health ── */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <Timer size={15} className="text-primary" />
          <h3 className="text-sm font-bold text-text">SLA Health</h3>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">

          <div className="bg-white rounded-2xl border border-red-100 p-5 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-xl bg-red-100 flex items-center justify-center">
                <ShieldAlert size={15} className="text-red-600" />
              </div>
              <span className="text-[11px] font-bold text-red-600 uppercase tracking-wide">Breached</span>
            </div>
            <p className="text-3xl font-bold text-red-700 leading-none mb-1">{sla?.breached ?? 0}</p>
            <p className="text-[11px] text-red-400">Past deadline, still open</p>
          </div>

          <div className="bg-white rounded-2xl border border-amber-100 p-5 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-xl bg-amber-100 flex items-center justify-center">
                <AlertTriangle size={15} className="text-amber-600" />
              </div>
              <span className="text-[11px] font-bold text-amber-600 uppercase tracking-wide">At Risk</span>
            </div>
            <p className="text-3xl font-bold text-amber-700 leading-none mb-1">{sla?.atRisk ?? 0}</p>
            <p className="text-[11px] text-amber-400">≥70% of SLA elapsed</p>
          </div>

          <div className="bg-white rounded-2xl border border-emerald-100 p-5 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-xl bg-emerald-100 flex items-center justify-center">
                <ShieldCheck size={15} className="text-emerald-600" />
              </div>
              <span className="text-[11px] font-bold text-emerald-600 uppercase tracking-wide">Within SLA</span>
            </div>
            <p className="text-3xl font-bold text-emerald-700 leading-none mb-1">
              {sla ? `${sla.withinSlaRate.toFixed(0)}%` : '—'}
            </p>
            <p className="text-[11px] text-emerald-500">
              {sla?.resolvedWithinSla ?? 0} / {sla?.totalResolved ?? 0} resolved
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-border/70 p-5 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-xl bg-blue-100 flex items-center justify-center">
                <Clock size={15} className="text-blue-600" />
              </div>
              <span className="text-[11px] font-bold text-blue-600 uppercase tracking-wide">Avg Resolution</span>
            </div>
            <p className="text-3xl font-bold text-text leading-none mb-1">
              {stats?.avgResolutionHours != null ? `${stats.avgResolutionHours.toFixed(1)}h` : '—'}
            </p>
            <p className="text-[11px] text-text-muted">Across all resolved</p>
          </div>
        </div>
      </section>

      {/* ── Row 3: Charts ── */}
      <div className="grid grid-cols-3 gap-4">

        {/* Area trend chart */}
        <div className="col-span-2 bg-white rounded-2xl border border-border/70 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-sm font-bold text-text">Request Volume Trends</h3>
              <p className="text-[11px] text-text-muted mt-0.5">Monthly submitted vs resolved</p>
            </div>
            <div className="flex items-center gap-4 text-[11px] font-semibold">
              <span className="flex items-center gap-1.5"><span className="w-3 h-2 rounded-sm" style={{ background: C1 }} />Submitted</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-2 rounded-sm" style={{ background: C2 }} />Resolved</span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={monthlyData ?? []} margin={{ left: -10 }}>
              <defs>
                <linearGradient id="gradBlue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={C1} stopOpacity={0.15} />
                  <stop offset="95%" stopColor={C1} stopOpacity={0}    />
                </linearGradient>
                <linearGradient id="gradGreen" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={C2} stopOpacity={0.15} />
                  <stop offset="95%" stopColor={C2} stopOpacity={0}    />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <Tooltip content={<ChartTooltip />} />
              <Area type="monotone" dataKey="total"    stroke={C1} strokeWidth={2} fill="url(#gradBlue)"  name="Submitted" dot={false} activeDot={{ r: 5 }} />
              <Area type="monotone" dataKey="resolved" stroke={C2} strokeWidth={2} fill="url(#gradGreen)" name="Resolved"  dot={false} activeDot={{ r: 5 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Donut chart */}
        <div className="bg-white rounded-2xl border border-border/70 p-6 shadow-sm flex flex-col">
          <div className="mb-5">
            <h3 className="text-sm font-bold text-text">Priority Distribution</h3>
            <p className="text-[11px] text-text-muted mt-0.5">All open requests</p>
          </div>
          <div className="flex-1">
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={priorityData ?? []}
                  dataKey="count"
                  nameKey="priority"
                  cx="50%" cy="50%"
                  outerRadius={80}
                  innerRadius={48}
                  paddingAngle={3}
                  strokeWidth={0}
                >
                  {(priorityData ?? []).map((entry) => (
                    <Cell key={entry.priority} fill={PRIORITY_COLORS[entry.priority] ?? '#94a3b8'} />
                  ))}
                </Pie>
                <Tooltip content={<ChartTooltip />} />
                <Legend iconSize={8} iconType="circle" wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

    </div>
  )
}
