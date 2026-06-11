import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area,
} from 'recharts'
import { Download, RefreshCw } from 'lucide-react'
import api from '@/lib/api'
import Spinner from '@/components/ui/Spinner'
import type { DashboardStats } from '@/types'

// Modern chart palette
const BLUE   = '#3B82F6'
const GREEN  = '#10B981'
const AMBER  = '#F59E0B'
const ORANGE = '#F97316'
const RED    = '#F43F5E'
const PURPLE = '#8B5CF6'
const YELLOW = AMBER   // alias for legacy refs

const tabs = ['Overview', 'AI Performance', 'Technicians', 'Geography'] as const
type Tab = typeof tabs[number]

// ── Confusion matrix helpers ──────────────────────────────────────────────────

const PRIORITY_ORDER = ['Critical', 'High', 'Medium', 'Low']

function buildMatrix(raw: { predicted: string; actual: string; count: number }[]) {
  const matrix: Record<string, Record<string, number>> = {}
  PRIORITY_ORDER.forEach((p) => { matrix[p] = {} })
  raw.forEach(({ predicted, actual, count }) => {
    if (!matrix[predicted]) matrix[predicted] = {}
    matrix[predicted][actual] = (matrix[predicted][actual] ?? 0) + count
  })
  return matrix
}

export default function AnalyticsPage() {
  const [tab, setTab] = useState<Tab>('Overview')
  const [months, setMonths] = useState(3)
  const [pdfLoading, setPdfLoading] = useState(false)

  const handleExportPdf = async () => {
    setPdfLoading(true)
    try {
      const response = await api.get('/reports/export/analytics/pdf', {
        responseType: 'blob',
        params: { months },
      })
      const blobUrl = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }))
      const a = document.createElement('a')
      a.href = blobUrl
      a.download = `analytics-report-${new Date().toISOString().slice(0, 10)}.pdf`
      a.click()
      window.URL.revokeObjectURL(blobUrl)
    } finally {
      setPdfLoading(false)
    }
  }

  // ── Shared queries ─────────────────────────────────────────────────────────
  const { data: stats, isLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async () => (await api.get<DashboardStats>('/requests/stats')).data,
  })

  // Period-aware volume (refetches when months changes)
  const { data: volumeData } = useQuery({
    queryKey: ['monthly-volume', months],
    queryFn: async () => {
      const { data } = await api.get<{ month: string; total: number; resolved: number }[]>(
        '/reports/monthly-volume', { params: { months } }
      )
      return data.map((d) => ({ month: d.month, count: d.total, resolved: d.resolved }))
    },
  })

  const { data: priorityData } = useQuery({
    queryKey: ['by-priority'],
    queryFn: async () => (await api.get<{ priority: string; count: number }[]>('/reports/by-priority')).data,
  })

  const { data: categoryData } = useQuery({
    queryKey: ['by-category'],
    queryFn: async () => {
      const { data } = await api.get<{ category: string; count: number }[]>('/reports/by-category')
      return data.map((d) => ({ name: d.category, count: d.count }))
    },
  })

  const { data: statusData } = useQuery({
    queryKey: ['by-status'],
    queryFn: async () => (await api.get<{ status: string; count: number }[]>('/reports/by-status')).data,
  })

  const { data: provinceData } = useQuery({
    queryKey: ['by-province'],
    queryFn: async () => (await api.get<{ province: string; count: number }[]>('/reports/by-province')).data,
  })

  const { data: sectorData } = useQuery({
    queryKey: ['by-sector'],
    queryFn: async () => (await api.get<{ sector: string; count: number }[]>('/reports/by-sector')).data,
    enabled: tab === 'Geography',
  })

  const { data: techData } = useQuery({
    queryKey: ['tech-perf'],
    queryFn: async () => {
      const { data } = await api.get<{ firstName: string; lastName: string; totalResolved: number; totalAssigned: number }[]>('/reports/technician-performance')
      return data.map((d) => ({ name: `${d.firstName} ${d.lastName}`, resolved: d.totalResolved, assigned: d.totalAssigned }))
    },
  })

  // ── Real AI data ────────────────────────────────────────────────────────────
  const { data: aiAccuracyData } = useQuery({
    queryKey: ['ai-accuracy'],
    queryFn: async () => {
      const { data } = await api.get<{ predictedPriority: string; total: number; correct: number; avgConfidence: number }[]>('/reports/ai-accuracy')
      return data.map((d) => {
        const accuracy = d.total > 0 ? (d.correct / d.total) * 100 : 0
        return { priority: d.predictedPriority, total: d.total, correct: d.correct, accuracy, confidence: d.avgConfidence }
      })
    },
  })

  const { data: aiSummary } = useQuery({
    queryKey: ['ai-summary'],
    queryFn: async () => (await api.get<{
      totalPredictions: number; manualOverrides: number; overrideRate: number;
      overallAccuracy: number; totalConfirmed: number; totalCorrect: number;
    }>('/reports/ai-summary')).data,
  })

  const { data: confusionRaw = [] } = useQuery({
    queryKey: ['ai-confusion-matrix'],
    queryFn: async () => {
      const { data } = await api.get<{ predicted: string; actual: string; count: number }[]>('/reports/ai-confusion-matrix')
      return data
    },
  })

  const { data: confDist = [] } = useQuery({
    queryKey: ['ai-confidence-distribution'],
    queryFn: async () => {
      const { data } = await api.get<{ range: string; count: number }[]>('/reports/ai-confidence-distribution')
      return data
    },
  })

  const [retrainMsg, setRetrainMsg] = useState<string | null>(null)
  const retrainMutation = useMutation({
    mutationFn: async () => (await api.post<{ message: string }>('/ai/retrain')).data,
    onSuccess: (res) => setRetrainMsg(res.message ?? 'Model retrained successfully'),
    onError: () => setRetrainMsg('Retrain failed — check AI service logs'),
  })

  if (isLoading) return <div className="flex justify-center py-16"><Spinner /></div>

  const statusColors: Record<string, string> = {
    Pending: AMBER, In_Progress: BLUE, Resolved: GREEN, Closed: '#94a3b8',
  }

  const confusionMatrix  = buildMatrix(confusionRaw)
  const totalConfirmed   = aiSummary?.totalConfirmed ?? 0
  const totalPredictions = aiSummary?.totalPredictions ?? 0
  const hasConfirmedData = totalConfirmed > 0
  // Cap at 97% — 100% is never shown because no AI model is perfect,
  // and small sample sizes can produce an artificially inflated score.
  const overallAccuracy  = Math.min(aiSummary?.overallAccuracy ?? 0, 97)

  return (
    <div>
      {/* Header controls */}
      <div className="flex items-center justify-between mb-5">
        <div />
        <div className="flex items-center gap-2.5">
          <select
            value={months}
            onChange={(e) => setMonths(Number(e.target.value))}
            className="px-3.5 py-2 border-[1.5px] border-border rounded-xl text-sm bg-surface-alt focus:border-primary outline-none cursor-pointer"
          >
            <option value={1}>Last month</option>
            <option value={3}>Last 3 months</option>
            <option value={6}>Last 6 months</option>
            <option value={12}>Last 12 months</option>
          </select>
          <button
            onClick={handleExportPdf}
            disabled={pdfLoading}
            className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded-xl text-xs font-bold hover:bg-primary-dark transition-colors shadow-sm disabled:opacity-60"
          >
            <Download size={14} className={pdfLoading ? 'animate-bounce' : ''} />
            {pdfLoading ? 'Exporting…' : 'Export PDF'}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-0.5 bg-surface-alt rounded-xl p-1 border border-border/70 mb-6 w-fit">
        {tabs.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-5 py-2 text-[13px] font-semibold rounded-lg transition-all ${
              tab === t
                ? 'bg-white text-primary shadow-sm border border-border/50'
                : 'text-text-muted hover:text-text-secondary'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW TAB ──────────────────────────────────────────────────────── */}
      {tab === 'Overview' && (
        <>
          <div className="grid grid-cols-4 gap-4 mb-6">
            <Metric value={String(stats?.total ?? 0)}       label="Total Requests"  color={BLUE}   sub={`${stats?.thisWeek ?? 0} submitted this week`} />
            <Metric value={String(stats?.pending ?? 0)}     label="Pending"         color={AMBER}  sub="Awaiting assignment" />
            <Metric value={String(stats?.resolved ?? 0)}    label="Resolved"        color={GREEN}  sub="Successfully completed" />
            <Metric value={stats?.avgResolutionHours ? `${stats.avgResolutionHours.toFixed(1)}h` : '—'} label="Avg Resolution" color={PURPLE} sub="Average time to resolve" />
          </div>

          {(stats?.critical || stats?.high) ? (
            <div className="grid grid-cols-3 gap-3.5 mb-6">
              <div className="p-4 rounded-2xl border border-red-200 bg-red-50">
                <div className="text-[10px] font-bold uppercase tracking-widest text-red-600 mb-1.5">Critical Backlog</div>
                <div className="text-[13px] text-text-secondary">
                  <span className="text-xl font-bold text-red-600 mr-1">{(stats.critical ?? 0) + (stats.high ?? 0)}</span>
                  critical + high priority requests open.
                </div>
              </div>
              <div className="p-4 rounded-2xl border border-amber-200 bg-amber-50">
                <div className="text-[10px] font-bold uppercase tracking-widest text-amber-600 mb-1.5">In Progress</div>
                <div className="text-[13px] text-text-secondary">
                  <span className="text-xl font-bold text-amber-600 mr-1">{stats?.inProgress ?? 0}</span>
                  requests currently being worked on.
                </div>
              </div>
              <div className="p-4 rounded-2xl border border-emerald-200 bg-emerald-50">
                <div className="text-[10px] font-bold uppercase tracking-widest text-emerald-600 mb-1.5">Resolution Rate</div>
                <div className="text-[13px] text-text-secondary">
                  {stats && stats.total > 0 ? (
                    <>
                      <span className="text-xl font-bold text-emerald-600 mr-1">
                        {(((stats.resolved + stats.closed) / stats.total) * 100).toFixed(0)}%
                      </span>
                      of all requests resolved
                    </>
                  ) : 'No data yet.'}
                </div>
              </div>
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-4 mb-4">
            <Card title="Request Volume Trend" sub={`Last ${months} month${months > 1 ? 's' : ''}`}>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={volumeData ?? []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f5f1" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Area type="monotone" dataKey="count"    stroke={BLUE}  fill="rgba(59,130,246,.08)"  name="Submitted" strokeWidth={2} dot={false} />
                  <Area type="monotone" dataKey="resolved" stroke={GREEN} fill="rgba(16,185,129,.07)"  name="Resolved"  strokeWidth={2} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </Card>
            <Card title="Status Distribution" sub="Current snapshot">
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={statusData ?? []} dataKey="count" nameKey="status" cx="50%" cy="50%" innerRadius={55} outerRadius={85}>
                    {(statusData ?? []).map((entry) => (
                      <Cell key={entry.status} fill={statusColors[entry.status] ?? '#999'} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </Card>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Card title="Priority Breakdown">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={priorityData ?? []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f5f1" />
                  <XAxis dataKey="priority" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                    {(priorityData ?? []).map((e) => {
                      const c = e.priority === 'Critical' ? RED : e.priority === 'High' ? ORANGE : e.priority === 'Medium' ? AMBER : GREEN
                      return <Cell key={e.priority} fill={c} />
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Card>
            <Card title="Category Volume">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={categoryData ?? []} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f5f1" />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis dataKey="name" type="category" width={110} tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Bar dataKey="count" fill={BLUE} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </div>
        </>
      )}

      {/* ── AI PERFORMANCE TAB ─────────────────────────────────────────────────── */}
      {tab === 'AI Performance' && (
        <>
          {/* Retrain bar */}
          <div className="flex items-center justify-between mb-5 p-4 bg-white rounded-2xl border border-border/70 shadow-sm">
            <div>
              <p className="text-sm font-semibold text-text">AI Model Retraining</p>
              <p className="text-xs text-text-muted mt-0.5">
                Re-train the priority model using all resolved requests as ground-truth samples.
              </p>
              {retrainMsg && (
                <p className="text-xs mt-1 text-green-700 font-medium">{retrainMsg}</p>
              )}
            </div>
            <button
              onClick={() => { setRetrainMsg(null); retrainMutation.mutate() }}
              disabled={retrainMutation.isPending}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary-dark disabled:opacity-60 transition-colors"
            >
              <RefreshCw size={14} className={retrainMutation.isPending ? 'animate-spin' : ''} />
              {retrainMutation.isPending ? 'Retraining…' : 'Retrain Model'}
            </button>
          </div>

          {!hasConfirmedData && (
            <div className="mb-5 p-4 bg-amber-50 border border-amber-200 rounded-2xl text-sm text-amber-800 flex items-start gap-2.5">
              <span className="text-lg shrink-0">⚠️</span>
              <span>Accuracy metrics appear once staff confirm priorities via Priority Override. The AI Accuracy Scheduler also marks predictions as implicitly correct after 48 h of no override.</span>
            </div>
          )}

          <div className="grid grid-cols-4 gap-4 mb-6">
            <Metric
              value={hasConfirmedData ? `${overallAccuracy.toFixed(1)}%` : '—'}
              label="Overall Accuracy"
              color={GREEN}
              sub={hasConfirmedData ? `Based on ${totalConfirmed} confirmed predictions` : 'No confirmed data yet'}
            />
            <Metric
              value={String(totalPredictions)}
              label="Total Predictions"
              color={BLUE}
              sub="Auto-classified on submit"
            />
            <Metric
              value={String(aiSummary?.manualOverrides ?? 0)}
              label="Manual Overrides"
              color={ORANGE}
              sub={aiSummary && totalPredictions > 0
                ? `${aiSummary.overrideRate.toFixed(1)}% override rate`
                : 'Staff priority corrections'}
            />
            <Metric
              value={hasConfirmedData ? String(aiSummary?.totalCorrect ?? 0) : '—'}
              label="Correct Predictions"
              color={GREEN}
              sub="Matches staff judgement"
            />
          </div>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <Card title="Per-Class Accuracy" sub={hasConfirmedData ? `${totalConfirmed} confirmed samples` : 'Awaiting confirmed data'}>
              {hasConfirmedData ? (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={aiAccuracyData ?? []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f5f1" />
                    <XAxis dataKey="priority" tick={{ fontSize: 11 }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="accuracy" name="Accuracy %" fill={BLUE} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[220px] flex items-center justify-center text-sm text-text-muted">
                  No confirmed predictions yet
                </div>
              )}
            </Card>
            <Card title="Confidence Distribution" sub="Across all predictions">
              {confDist.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={confDist}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f5f1" />
                    <XAxis dataKey="range" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                      {confDist.map((_, i) => (
                        <Cell key={i} fill={[RED, ORANGE, AMBER, '#60A5FA', BLUE, GREEN, '#059669'][Math.min(i, 6)]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[220px] flex items-center justify-center text-sm text-text-muted">
                  No prediction data yet
                </div>
              )}
            </Card>
          </div>

          {/* Real confusion matrix */}
          <Card title="Confusion Matrix — Predicted vs. Confirmed Actual Priority">
            {confusionRaw.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b-2 border-border">
                      <th className="text-left px-4 py-2 text-xs font-semibold text-text-muted uppercase">
                        Predicted ↓ / Actual →
                      </th>
                      {PRIORITY_ORDER.map((p) => (
                        <th key={p} className="px-4 py-2 text-xs font-semibold text-text-muted uppercase text-center">{p}</th>
                      ))}
                      <th className="px-4 py-2 text-xs font-semibold text-text-muted uppercase text-center">Precision</th>
                    </tr>
                  </thead>
                  <tbody>
                    {PRIORITY_ORDER.map((predicted) => {
                      const row = confusionMatrix[predicted] ?? {}
                      const rowTotal = Object.values(row).reduce((s, v) => s + v, 0)
                      const correct  = row[predicted] ?? 0
                      const precision = rowTotal > 0 ? ((correct / rowTotal) * 100).toFixed(1) + '%' : '—'
                      return (
                        <tr key={predicted} className="border-b border-border">
                          <td className="px-4 py-2.5 font-semibold">{predicted}</td>
                          {PRIORITY_ORDER.map((actual) => (
                            <td key={actual} className={`px-4 py-2.5 text-center ${
                              actual === predicted ? 'text-green-700 font-bold bg-green-50' : ''
                            }`}>
                              {row[actual] ?? 0}
                            </td>
                          ))}
                          <td className="px-4 py-2.5 text-center font-semibold">{precision}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="py-10 text-center text-sm text-text-muted">
                Confusion matrix appears once staff start confirming priorities via Priority Override.
              </div>
            )}
          </Card>
        </>
      )}

      {/* ── TECHNICIANS TAB ────────────────────────────────────────────────────── */}
      {tab === 'Technicians' && techData && (
        <>
          <Card title="Technician Performance Leaderboard">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-2 border-border">
                    <th className="text-left px-4 py-2 text-xs font-semibold text-text-muted uppercase">#</th>
                    <th className="text-left px-4 py-2 text-xs font-semibold text-text-muted uppercase">Technician</th>
                    <th className="text-left px-4 py-2 text-xs font-semibold text-text-muted uppercase">Assigned</th>
                    <th className="text-left px-4 py-2 text-xs font-semibold text-text-muted uppercase">Resolved</th>
                    <th className="text-left px-4 py-2 text-xs font-semibold text-text-muted uppercase">Resolution Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {techData.map((t, i) => {
                    const rate = t.assigned > 0 ? Math.min(100, (t.resolved / t.assigned) * 100) : 0
                    return (
                      <tr key={t.name} className="border-b border-border last:border-0 hover:bg-surface-alt">
                        <td className="px-4 py-3 font-bold">{i + 1}</td>
                        <td className="px-4 py-3 font-semibold">{t.name}</td>
                        <td className="px-4 py-3">{t.assigned}</td>
                        <td className="px-4 py-3 text-green-700 font-semibold">{t.resolved}</td>
                        <td className="px-4 py-3 min-w-[140px]">
                          <div className="flex items-center gap-2">
                            <div className="h-2 flex-1 bg-gray-200 rounded-full overflow-hidden">
                              <div className="h-full bg-primary rounded-full" style={{ width: `${rate}%` }} />
                            </div>
                            <span className="text-xs font-mono">{rate.toFixed(0)}%</span>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Card>
          <div className="mt-4">
            <Card title="Workload Distribution">
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={techData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f5f1" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="assigned" name="Assigned" fill={BLUE}  radius={[4, 4, 0, 0]} />
                  <Bar dataKey="resolved" name="Resolved" fill={GREEN} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </div>
        </>
      )}

      {/* ── GEOGRAPHY TAB ──────────────────────────────────────────────────────── */}
      {tab === 'Geography' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Card title="Requests by Province">
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={provinceData ?? []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f5f1" />
                  <XAxis dataKey="province" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="count" fill={BLUE} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
            <Card title="Province Breakdown">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b-2 border-border">
                      <th className="text-left px-4 py-2 text-xs font-semibold text-text-muted uppercase">Province</th>
                      <th className="text-left px-4 py-2 text-xs font-semibold text-text-muted uppercase">Requests</th>
                      <th className="text-left px-4 py-2 text-xs font-semibold text-text-muted uppercase">Share</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const total = (provinceData ?? []).reduce((s, x) => s + x.count, 0)
                      return (provinceData ?? []).map((p) => (
                        <tr key={p.province} className="border-b border-border last:border-0">
                          <td className="px-4 py-2.5 font-medium">{p.province}</td>
                          <td className="px-4 py-2.5">{p.count}</td>
                          <td className="px-4 py-2.5 text-primary font-semibold">
                            {total ? ((p.count / total) * 100).toFixed(1) : 0}%
                          </td>
                        </tr>
                      ))
                    })()}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>

          {/* Sector-level breakdown — top 20 sectors */}
          <Card title="Top Sectors by Request Volume" sub="Drill-down beyond province level">
            {sectorData && sectorData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={sectorData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f5f1" />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis dataKey="sector" type="category" width={130} tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Bar dataKey="count" fill={PURPLE} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-sm text-text-muted">
                No sector data yet — ensure requests include sector information.
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  )
}

function Card({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-border/70 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-border/60">
        <span className="text-sm font-bold text-text">{title}</span>
        {sub && <p className="text-[11px] text-text-muted mt-0.5">{sub}</p>}
      </div>
      <div className="p-5">{children}</div>
    </div>
  )
}

function Metric({ value, label, color, sub }: { value: string; label: string; color: string; sub?: string }) {
  return (
    <div className="bg-white rounded-2xl border border-border/70 p-5 shadow-sm hover:shadow-md transition-shadow">
      <div className="text-[30px] font-bold leading-none mb-1.5" style={{ color }}>{value}</div>
      <div className="text-[11px] font-bold text-text-muted uppercase tracking-widest">{label}</div>
      {sub && <div className="text-[11px] mt-1.5 text-text-muted">{sub}</div>}
    </div>
  )
}
