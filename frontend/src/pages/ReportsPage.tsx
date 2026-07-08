import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts'
import {
  Printer, Download, FileText, ChevronDown, ChevronUp, FileDown, AlertTriangle, MapPin,
  Clock, CheckCircle, Timer, ShieldAlert, ShieldCheck, Wrench, Star, TrendingUp,
} from 'lucide-react'
import api from '@/lib/api'
import { useAuth } from '@/lib/auth'
import Spinner from '@/components/ui/Spinner'
import MetricCard from '@/components/ui/MetricCard'
import { PriorityBadge } from '@/components/ui/Badge'
import type { DashboardStats } from '@/types'

interface SlaMetrics {
  breached: number
  atRisk: number
  resolvedWithinSla: number
  totalResolved: number
  withinSlaRate: number
}

interface TechPerfRow {
  technicianId: number
  firstName: string
  lastName: string
  totalAssigned: number
  totalResolved: number
  avgResolutionHours: number | null
  rating: number | null
  currentWorkload: number | null
  maxWorkload: number | null
  isAvailable: boolean | null
}

async function downloadFullReportPdf(period: string) {
  const response = await api.get('/reports/export/full-report/pdf', {
    params: { period },
    responseType: 'blob',
  })
  const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `reg-arms-report-${new Date().toISOString().slice(0, 10)}.pdf`
  a.click()
  window.URL.revokeObjectURL(url)
}

// Modern chart palette — no harsh reds in data viz
const COLORS = {
  blue:   '#3B82F6',
  green:  '#10B981',
  amber:  '#F59E0B',
  orange: '#F97316',
  red:    '#F43F5E',
  purple: '#8B5CF6',
  teal:   '#14B8A6',
}
const CATEGORY_COLORS = [
  COLORS.blue, COLORS.green, COLORS.amber,
  COLORS.purple, COLORS.orange, COLORS.teal, COLORS.red,
]

const PRIORITY_CHART_COLORS: Record<string, string> = {
  Critical: COLORS.red,
  High:     COLORS.orange,
  Medium:   COLORS.amber,
  Low:      COLORS.green,
}

type ExportType = 'requests' | 'technician-performance' | 'categories' | 'monthly-volume'

const exportConfigs: { type: ExportType; label: string; desc: string }[] = [
  { type: 'requests',              label: 'All Requests',           desc: 'Full export of requests with status, priority, technician, and location.' },
  { type: 'technician-performance',label: 'Technician Performance', desc: 'Resolved counts, ratings, and workload per technician.' },
  { type: 'categories',            label: 'Categories Report',      desc: 'Request volume and resolution breakdown per category.' },
  { type: 'monthly-volume',        label: 'Monthly Volume',         desc: 'Month-by-month submitted and resolved request counts.' },
]

function today() {
  return new Date().toISOString().slice(0, 10)
}
function oneYearAgo() {
  const d = new Date()
  d.setFullYear(d.getFullYear() - 1)
  return d.toISOString().slice(0, 10)
}

function ExportCard({ type, label, desc }: { type: ExportType; label: string; desc: string }) {
  const [from, setFrom] = useState(oneYearAgo())
  const [to, setTo] = useState(today())
  const [loadingCsv, setLoadingCsv] = useState(false)
  const [loadingPdf, setLoadingPdf] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(false)

  const handleDownload = async (format: 'csv' | 'pdf') => {
    const setLoading = format === 'csv' ? setLoadingCsv : setLoadingPdf
    setLoading(true)
    setExportError(null)
    try {
      const url = format === 'csv'
        ? `/reports/export/${type}`
        : `/reports/export/${type}/pdf`
      const response = await api.get(url, {
        params: { from, to },
        responseType: 'blob',
      })
      const blobUrl = window.URL.createObjectURL(new Blob([response.data]))
      const a = document.createElement('a')
      a.href = blobUrl
      a.download = `${type}-${from}-to-${to}.${format}`
      a.click()
      window.URL.revokeObjectURL(blobUrl)
    } catch {
      setExportError('Export failed. Please try again or check the selected date range.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-border/70 shadow-sm overflow-hidden">
      <button
        className="w-full flex items-start justify-between px-5 py-4 hover:bg-surface-alt/60 transition-colors text-left"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary-light flex items-center justify-center shrink-0">
            <FileText size={15} className="text-primary" />
          </div>
          <div>
            <div className="text-sm font-bold text-text">{label}</div>
            <div className="text-[11px] text-text-muted mt-0.5">{desc}</div>
          </div>
        </div>
        {expanded
          ? <ChevronUp size={15} className="text-text-muted mt-1 shrink-0" />
          : <ChevronDown size={15} className="text-text-muted mt-1 shrink-0" />}
      </button>

      {expanded && (
        <div className="px-5 pb-4 border-t border-border/50 pt-3 bg-surface-alt/40">
          <div className="flex items-end gap-3 flex-wrap">
            <div>
              <label className="block text-[10px] font-bold text-text-muted uppercase tracking-widest mb-1.5">From</label>
              <input
                type="date" value={from} max={to}
                onChange={(e) => setFrom(e.target.value)}
                className="px-3 py-2 border-[1.5px] border-border rounded-xl text-sm bg-white focus:border-primary outline-none"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-text-muted uppercase tracking-widest mb-1.5">To</label>
              <input
                type="date" value={to} min={from} max={today()}
                onChange={(e) => setTo(e.target.value)}
                className="px-3 py-2 border-[1.5px] border-border rounded-xl text-sm bg-white focus:border-primary outline-none"
              />
            </div>
            <button
              onClick={() => handleDownload('csv')}
              disabled={loadingCsv || loadingPdf || !from || !to}
              className="flex items-center gap-1.5 px-4 py-2 border-[1.5px] border-primary text-primary rounded-xl text-sm font-bold hover:bg-primary-light transition-colors disabled:opacity-50"
            >
              <Download size={14} />
              {loadingCsv ? 'Downloading…' : 'CSV'}
            </button>
            <button
              onClick={() => handleDownload('pdf')}
              disabled={loadingCsv || loadingPdf || !from || !to}
              className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded-xl text-sm font-bold hover:bg-primary-dark transition-colors disabled:opacity-50 shadow-sm"
            >
              <FileDown size={14} />
              {loadingPdf ? 'Generating…' : 'PDF'}
            </button>
          </div>
          {exportError && (
            <div className="flex items-center gap-2 mt-3 text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg border border-red-200">
              <AlertTriangle size={12} className="shrink-0" />
              {exportError}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// The backend's /reports/monthly-volume expects a number of months
const MONTHS_BY_PERIOD: Record<string, number> = { month: 1, quarter: 3, year: 12 }

export default function ReportsPage() {
  const { role } = useAuth()
  const [period, setPeriod] = useState('year')
  const [printLoading, setPrintLoading] = useState(false)
  const [printError, setPrintError] = useState('')

  const handlePrint = async () => {
    setPrintLoading(true)
    setPrintError('')
    try {
      await downloadFullReportPdf(period)
    } catch {
      setPrintError('Failed to generate PDF. Please try again.')
    } finally {
      setPrintLoading(false)
    }
  }

  const { data: volumeData, isLoading: volLoading } = useQuery({
    queryKey: ['report-volume', period],
    queryFn: async () => {
      const { data } = await api.get<{ month: string; total: number; resolved: number }[]>(
        '/reports/monthly-volume', { params: { months: MONTHS_BY_PERIOD[period] ?? 12 } }
      )
      return data.map((d) => ({ month: d.month, count: d.total, resolved: d.resolved }))
    },
  })

  const { data: priorityData } = useQuery({
    queryKey: ['report-priority'],
    queryFn: async () => {
      const { data } = await api.get<{ priority: string; count: number }[]>('/reports/by-priority')
      return data
    },
  })

  const { data: categoryData } = useQuery({
    queryKey: ['report-category'],
    queryFn: async () => {
      const { data } = await api.get<{ category: string; count: number }[]>('/reports/by-category')
      return data.map((d) => ({ name: d.category, count: d.count }))
    },
  })

  const { data: techData } = useQuery({
    queryKey: ['report-tech-perf'],
    queryFn: async () => {
      const { data } = await api.get<TechPerfRow[]>('/reports/technician-performance')
      return data.map((d) => ({
        name: `${d.firstName} ${d.lastName}`,
        resolved: d.totalResolved,
        assigned: d.totalAssigned,
        rate: d.totalAssigned > 0 ? (d.totalResolved / d.totalAssigned) * 100 : 0,
        avgHours: d.avgResolutionHours,
        rating: d.rating,
        currentWorkload: d.currentWorkload,
        maxWorkload: d.maxWorkload,
        available: d.isAvailable,
      }))
    },
  })

  const { data: stats } = useQuery({
    queryKey: ['report-stats'],
    queryFn: async () => (await api.get<DashboardStats>('/requests/stats')).data,
  })

  const { data: sla } = useQuery({
    queryKey: ['report-sla'],
    queryFn: async () => (await api.get<SlaMetrics>('/reports/sla-metrics')).data,
  })

  const { data: statusData } = useQuery({
    queryKey: ['report-status'],
    queryFn: async () => {
      const { data } = await api.get<{ status: string; count: number }[]>('/reports/by-status')
      return data.map((d) => ({ status: d.status.replace('_', ' '), count: d.count }))
    },
  })

  const { data: sectorData } = useQuery({
    queryKey: ['report-sector'],
    queryFn: async () => {
      const { data } = await api.get<{ sector: string; count: number }[]>('/reports/by-sector')
      return data.slice(0, 8)
    },
  })

  const resolutionRate = stats && stats.total > 0
    ? ((stats.resolved + stats.closed) / stats.total) * 100
    : null

  const { data: aiData } = useQuery({
    queryKey: ['report-ai'],
    queryFn: async () => {
      const { data } = await api.get<{ predictedPriority: string; total: number; correct: number; avgConfidence: number }[]>('/reports/ai-accuracy')
      return data.map((d) => {
        const accuracy = d.total > 0 ? (d.correct / d.total) * 100 : 0
        return { priority: d.predictedPriority, total: d.total, correct: d.correct, accuracy, confidence: d.avgConfidence }
      })
    },
  })

  return (
    <div>
      {/* Staff see district-scoped data (enforced by the backend) */}
      {role === 'STAFF' && (
        <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 text-blue-700 rounded-2xl px-4 py-3 mb-4 text-sm">
          <MapPin size={15} className="shrink-0" />
          <span>
            <span className="font-semibold">District view</span> — all figures and exports on this
            page cover only the requests and technicians of your assigned district.
          </span>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center flex-wrap gap-3 bg-white rounded-2xl border border-border/70 p-4 shadow-sm mb-6">
        <label className="text-[11px] font-bold text-text-muted uppercase tracking-widest">Period:</label>
        <select
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          className="px-3.5 py-2 border-[1.5px] border-border rounded-xl text-sm bg-surface-alt focus:border-primary outline-none cursor-pointer"
        >
          <option value="month">This Month</option>
          <option value="quarter">This Quarter</option>
          <option value="year">This Year</option>
        </select>
        <div className="ml-auto flex items-center gap-3">
          {printError && (
            <span className="flex items-center gap-1.5 text-xs text-red-600">
              <AlertTriangle size={12} /> {printError}
            </span>
          )}
          <button
            onClick={handlePrint}
            disabled={printLoading}
            className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary-dark transition-colors disabled:opacity-60 shadow-sm"
          >
            {printLoading ? <Spinner className="h-4 w-4" /> : <Printer size={14} />}
            {printLoading ? 'Generating PDF…' : 'Print Report'}
          </button>
        </div>
      </div>

      {/* ── Overview KPIs ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        <MetricCard
          label="Total Requests"
          value={(stats?.total ?? 0).toLocaleString()}
          icon={<FileText size={20} />}
          variant="blue"
          trend={{ value: `${stats?.thisWeek ?? 0} this week`, direction: 'neutral' }}
        />
        <MetricCard label="Pending"     value={(stats?.pending ?? 0).toLocaleString()}    icon={<Clock size={20} />}         variant="amber" />
        <MetricCard label="In Progress" value={(stats?.inProgress ?? 0).toLocaleString()} icon={<Wrench size={20} />}        variant="purple" />
        <MetricCard label="Resolved"    value={(stats?.resolved ?? 0).toLocaleString()}   icon={<CheckCircle size={20} />}   variant="green" />
        <MetricCard label="Critical"    value={(stats?.critical ?? 0).toLocaleString()}   icon={<AlertTriangle size={20} />} variant="red" />
        <MetricCard
          label="Resolution Rate"
          value={resolutionRate != null ? `${resolutionRate.toFixed(0)}%` : '—'}
          icon={<TrendingUp size={20} />}
          variant="teal"
          trend={{ value: 'resolved + closed', direction: 'neutral' }}
        />
      </div>

      {/* ── SLA Health ── */}
      <section className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Timer size={15} className="text-primary" />
          <h3 className="text-sm font-bold text-text">SLA Health</h3>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white rounded-2xl border border-red-100 p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-xl bg-red-100 flex items-center justify-center">
                <ShieldAlert size={15} className="text-red-600" />
              </div>
              <span className="text-[11px] font-bold text-red-600 uppercase tracking-wide">Breached</span>
            </div>
            <p className="text-3xl font-bold text-red-700 leading-none mb-1">{sla?.breached ?? 0}</p>
            <p className="text-[11px] text-red-400">Past deadline, still open</p>
          </div>
          <div className="bg-white rounded-2xl border border-amber-100 p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-xl bg-amber-100 flex items-center justify-center">
                <AlertTriangle size={15} className="text-amber-600" />
              </div>
              <span className="text-[11px] font-bold text-amber-600 uppercase tracking-wide">At Risk</span>
            </div>
            <p className="text-3xl font-bold text-amber-700 leading-none mb-1">{sla?.atRisk ?? 0}</p>
            <p className="text-[11px] text-amber-400">≥70% of SLA elapsed</p>
          </div>
          <div className="bg-white rounded-2xl border border-emerald-100 p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-xl bg-emerald-100 flex items-center justify-center">
                <ShieldCheck size={15} className="text-emerald-600" />
              </div>
              <span className="text-[11px] font-bold text-emerald-600 uppercase tracking-wide">Within SLA</span>
            </div>
            <p className="text-3xl font-bold text-emerald-700 leading-none mb-1">
              {sla && sla.totalResolved > 0 ? `${sla.withinSlaRate.toFixed(0)}%` : '—'}
            </p>
            <p className="text-[11px] text-emerald-500">
              {sla && sla.totalResolved > 0
                ? `${sla.resolvedWithinSla} / ${sla.totalResolved} resolved`
                : 'No resolved requests yet'}
            </p>
          </div>
          <div className="bg-white rounded-2xl border border-border/70 p-5 shadow-sm">
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

      {/* Charts */}
      {volLoading ? (
        <div className="flex justify-center py-10"><Spinner /></div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="bg-white rounded-2xl border border-border/70 p-6 shadow-sm">
              <h3 className="text-sm font-bold text-text mb-0.5">Monthly Request Volume</h3>
              <p className="text-[11px] text-text-muted mb-5">Submitted vs resolved requests</p>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={volumeData ?? []} barCategoryGap="30%">
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <Tooltip />
                  <Legend iconSize={8} iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="count"    name="Submitted" fill={COLORS.blue}  radius={[4, 4, 0, 0]} />
                  <Bar dataKey="resolved" name="Resolved"  fill={COLORS.green} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="bg-white rounded-2xl border border-border/70 p-6 shadow-sm">
              <h3 className="text-sm font-bold text-text mb-0.5">Category Breakdown</h3>
              <p className="text-[11px] text-text-muted mb-5">By request category</p>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={categoryData ?? []} dataKey="count" nameKey="name"
                    cx="50%" cy="50%" innerRadius={52} outerRadius={85} paddingAngle={3} strokeWidth={0}
                  >
                    {(categoryData ?? []).map((_, i) => (
                      <Cell key={i} fill={CATEGORY_COLORS[i % CATEGORY_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend iconSize={8} iconType="circle" wrapperStyle={{ fontSize: 10 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-white rounded-2xl border border-border/70 p-6 shadow-sm">
              <h3 className="text-sm font-bold text-text mb-0.5">Priority Distribution</h3>
              <p className="text-[11px] text-text-muted mb-4">By priority level</p>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={priorityData ?? []} barCategoryGap="35%">
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="priority" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <Tooltip />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {(priorityData ?? []).map((entry, i) => (
                      <Cell key={i} fill={PRIORITY_CHART_COLORS[entry.priority] ?? COLORS.blue} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="bg-white rounded-2xl border border-border/70 p-6 shadow-sm">
              <h3 className="text-sm font-bold text-text mb-0.5">Volume Trend</h3>
              <p className="text-[11px] text-text-muted mb-4">Monthly request trend line</p>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={volumeData ?? []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <Tooltip />
                  <Line type="monotone" dataKey="count" stroke={COLORS.blue} strokeWidth={2.5} dot={false} activeDot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="bg-white rounded-2xl border border-border/70 p-6 shadow-sm">
              <h3 className="text-sm font-bold text-text mb-0.5">Requests by Status</h3>
              <p className="text-[11px] text-text-muted mb-4">Current pipeline breakdown</p>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={statusData ?? []} barCategoryGap="35%">
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="status" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="count" fill={COLORS.purple} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Top Sectors */}
          <div className="bg-white rounded-2xl border border-border/70 p-6 shadow-sm mb-4">
            <h3 className="text-sm font-bold text-text mb-0.5">Top Sectors by Request Volume</h3>
            <p className="text-[11px] text-text-muted mb-4">
              {role === 'STAFF' ? 'Where requests concentrate within your district' : 'Highest-volume sectors nationwide'}
            </p>
            {sectorData && sectorData.length > 0 ? (
              <ResponsiveContainer width="100%" height={Math.max(160, sectorData.length * 36)}>
                <BarChart data={sectorData} layout="vertical" margin={{ left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <YAxis dataKey="sector" type="category" width={110} tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <Tooltip />
                  <Bar dataKey="count" name="Requests" fill={COLORS.teal} radius={[0, 4, 4, 0]} barSize={18} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-xs text-text-muted py-6 text-center">No sector data yet.</p>
            )}
          </div>

          {/* Technician Performance table */}
          <div className="bg-white rounded-2xl border border-border/70 shadow-sm overflow-hidden mb-6">
            <div className="px-5 py-4 border-b border-border">
              <div className="text-sm font-semibold">Technician Performance</div>
              <div className="text-xs text-text-muted mt-0.5">
                {role === 'STAFF'
                  ? 'Activity of technicians handling requests in your district'
                  : 'Activity of all technicians with assigned requests'}
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-surface-alt border-b border-border">
                    <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-text-muted uppercase">Technician</th>
                    <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-text-muted uppercase">Assigned</th>
                    <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-text-muted uppercase">Resolved</th>
                    <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-text-muted uppercase">Resolution Rate</th>
                    <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-text-muted uppercase">Avg Time</th>
                    <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-text-muted uppercase">Rating</th>
                    <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-text-muted uppercase">Workload</th>
                    <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-text-muted uppercase">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(techData ?? []).map((t) => (
                    <tr key={t.name} className="border-b border-border last:border-0 hover:bg-surface-alt">
                      <td className="px-4 py-3 text-sm font-medium">{t.name}</td>
                      <td className="px-4 py-3 text-sm">{t.assigned}</td>
                      <td className="px-4 py-3 text-sm text-green-700 font-semibold">{t.resolved}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-surface-alt rounded-full overflow-hidden max-w-[80px]">
                            <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${t.rate}%` }} />
                          </div>
                          <span className="text-xs font-mono font-semibold min-w-[40px]">{t.rate.toFixed(0)}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm">{t.avgHours != null ? `${Number(t.avgHours).toFixed(1)}h` : '—'}</td>
                      <td className="px-4 py-3 text-sm">
                        {t.rating != null ? (
                          <span className="inline-flex items-center gap-1 font-semibold">
                            <Star size={12} className="text-amber-400 fill-amber-400" />
                            {Number(t.rating).toFixed(1)}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {t.currentWorkload != null && t.maxWorkload != null
                          ? `${t.currentWorkload} / ${t.maxWorkload}`
                          : '—'}
                      </td>
                      <td className="px-4 py-3">
                        {t.available != null && (
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                            t.available ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
                          }`}>
                            {t.available ? 'Available' : 'Unavailable'}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {(techData ?? []).length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-4 py-6 text-center text-xs text-text-muted">
                        No technician activity yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* AI Accuracy Table */}
          {aiData && (
            <div className="bg-white rounded-2xl border border-border/70 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-border">
                <div className="text-sm font-semibold">AI Model Accuracy Report</div>
                <div className="text-xs text-text-muted mt-0.5">TF-IDF + Logistic Regression + Random Forest ensemble</div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-surface-alt border-b border-border">
                      <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-text-muted uppercase">Priority</th>
                      <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-text-muted uppercase">Total</th>
                      <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-text-muted uppercase">Correct</th>
                      <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-text-muted uppercase">Accuracy</th>
                      <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-text-muted uppercase">Avg Confidence</th>
                    </tr>
                  </thead>
                  <tbody>
                    {aiData.map((row) => (
                      <tr key={row.priority} className="border-b border-border last:border-0 hover:bg-surface-alt">
                        <td className="px-4 py-3">
                          <PriorityBadge priority={row.priority as any} />
                        </td>
                        <td className="px-4 py-3 text-sm">{row.total}</td>
                        <td className="px-4 py-3 text-sm text-green-700 font-semibold">{row.correct}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-1.5 bg-surface-alt rounded-full overflow-hidden max-w-[80px]">
                              <div className="h-full bg-primary rounded-full" style={{ width: `${row.accuracy}%` }} />
                            </div>
                            <span className="text-xs font-mono font-semibold min-w-[40px]">{row.accuracy.toFixed(1)}%</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm font-semibold">{(row.confidence * 100).toFixed(1)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Exports */}
          <h2 className="text-[15px] font-bold mt-6 mb-3 flex items-center gap-2">
            <FileDown size={16} className="text-text-muted" /> Export Reports
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {exportConfigs.map((cfg) => (
              <ExportCard key={cfg.type} {...cfg} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
