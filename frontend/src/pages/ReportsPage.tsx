import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts'
import { Printer, Download, FileText, ChevronDown, ChevronUp, FileDown, AlertTriangle } from 'lucide-react'
import api from '@/lib/api'
import Spinner from '@/components/ui/Spinner'
import { PriorityBadge } from '@/components/ui/Badge'

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

export default function ReportsPage() {
  const [period, setPeriod] = useState('year')

  const { data: volumeData, isLoading: volLoading } = useQuery({
    queryKey: ['report-volume', period],
    queryFn: async () => {
      const { data } = await api.get<{ month: string; total: number; resolved: number }[]>(
        '/reports/monthly-volume', { params: { period } }
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
      const { data } = await api.get<{ firstName: string; lastName: string; totalResolved: number; totalAssigned: number }[]>('/reports/technician-performance')
      return data.map((d) => ({ name: `${d.firstName} ${d.lastName}`, resolved: d.totalResolved, assigned: d.totalAssigned }))
    },
  })

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
        <div className="ml-auto">
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-4 py-2 border-[1.5px] border-border rounded-xl text-sm font-semibold hover:border-primary hover:text-primary transition-colors"
          >
            <Printer size={14} /> Print
          </button>
        </div>
      </div>

      {/* Exports */}
      <h2 className="text-[15px] font-bold mb-3 flex items-center gap-2"><FileDown size={16} className="text-text-muted" /> Export Reports</h2>
      <div className="grid grid-cols-2 gap-3 mb-6">
        {exportConfigs.map((cfg) => (
          <ExportCard key={cfg.type} {...cfg} />
        ))}
      </div>

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
              <h3 className="text-sm font-bold text-text mb-0.5">Technician Performance</h3>
              <p className="text-[11px] text-text-muted mb-4">Resolved tasks per technician</p>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={techData ?? []} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis dataKey="name" type="category" width={75} tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <Tooltip />
                  <Bar dataKey="resolved" fill={COLORS.green} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
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
        </>
      )}
    </div>
  )
}
