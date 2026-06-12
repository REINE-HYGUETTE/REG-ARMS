import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ClipboardList, Clock, CheckCircle2, Loader2, XCircle,
  AlertTriangle, MapPin, Tag, ArrowRight, PlayCircle,
  Eye, Filter, Inbox, Zap,
} from 'lucide-react'
import api from '@/lib/api'
import { PriorityBadge } from '@/components/ui/Badge'
import Spinner from '@/components/ui/Spinner'
import type { Page, RequestListItem, Technician } from '@/types'

// ── Priority left-border color ─────────────────────────────────────────────────
const priorityBorder: Record<string, string> = {
  Critical: 'border-l-red-500',
  High:     'border-l-amber-500',
  Medium:   'border-l-blue-400',
  Low:      'border-l-gray-300',
}

// ── SLA chip ──────────────────────────────────────────────────────────────────
function SlaChip({ slaStatus, slaDeadline }: { slaStatus?: string; slaDeadline?: string }) {
  if (!slaStatus || !slaDeadline || slaStatus === 'OK') return null
  const diff  = new Date(slaDeadline).getTime() - Date.now()
  const abs   = Math.abs(diff)
  const h     = Math.floor(abs / 3_600_000)
  const m     = Math.floor((abs % 3_600_000) / 60_000)
  const time  = h > 0 ? `${h}h ${m}m` : `${m}m`
  const label = diff <= 0 ? `${time} overdue` : `${time} left`
  const cls   = slaStatus === 'BREACHED'
    ? 'bg-red-50 text-red-600 border-red-200'
    : 'bg-amber-50 text-amber-600 border-amber-200'
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${cls}`}>
      <AlertTriangle size={9} /> {label}
    </span>
  )
}

const STATUS_TABS = [
  { value: '',            label: 'All'         },
  { value: 'Assigned',    label: 'Assigned'    },
  { value: 'In_Progress', label: 'In Progress' },
  { value: 'Resolved',    label: 'Resolved'    },
  { value: 'Closed',      label: 'Closed'      },
]

export default function TechnicianTasksPage() {
  const queryClient = useQueryClient()
  const [statusFilter, setStatusFilter] = useState('')

  // Confirmation modal for "Cannot Pursue"
  const [cannotPursueId,     setCannotPursueId]     = useState<number | null>(null)
  const [cannotPursueReason, setCannotPursueReason] = useState('')

  // ── Technician profile (workload + pursue state) ───────────────────────────
  const { data: profile } = useQuery({
    queryKey: ['technician-me'],
    queryFn: async () => (await api.get<Technician>('/technicians/me')).data,
  })

  // ── Fetch ALL tasks once — filter and count on the frontend ───────────────
  // A single source of truth avoids the counts/list desync that happens when
  // two separate queries (one filtered, one unfiltered) get out of step.
  const { data: allTasks = [], isLoading } = useQuery({
    queryKey: ['my-tasks'],
    queryFn: async () => {
      const { data } = await api.get<Page<RequestListItem>>('/requests', {
        params: { size: 200, sort: 'createdAt,desc' },
      })
      return data.content
    },
  })

  // ── Counts always derived from the full dataset ────────────────────────────
  const counts = allTasks.reduce<Record<string, number>>((acc, t) => {
    acc[t.status] = (acc[t.status] ?? 0) + 1
    return acc
  }, {})

  // ── Apply status filter on the frontend ───────────────────────────────────
  const rawTasks = statusFilter
    ? allTasks.filter(t => t.status === statusFilter)
    : allTasks

  // Sort: active tasks first (Resolved/Closed/Cancelled at bottom), then newest first.
  const isDone = (t: { status: string }) =>
    t.status === 'Resolved' || t.status === 'Closed' || t.status === 'Cancelled'

  const tasks = [...rawTasks].sort((a, b) => {
    // 1. Active before done
    const doneA = isDone(a) ? 1 : 0
    const doneB = isDone(b) ? 1 : 0
    if (doneA !== doneB) return doneA - doneB
    // 2. Newest first
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  })

  // ── Pursue mutation ────────────────────────────────────────────────────────
  const pursueMutation = useMutation({
    mutationFn: async (id: number) => {
      await api.post(`/requests/${id}/pursue`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-tasks'] })
      queryClient.invalidateQueries({ queryKey: ['technician-me'] })
    },
  })

  // ── Cannot-Pursue mutation ─────────────────────────────────────────────────
  const cannotPursueMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: number; reason: string }) => {
      await api.post(`/requests/${id}/cannot-pursue`, { reason })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-tasks'] })
      queryClient.invalidateQueries({ queryKey: ['technician-me'] })
      setCannotPursueId(null)
      setCannotPursueReason('')
    },
  })

  if (isLoading) return <div className="flex justify-center py-16"><Spinner /></div>

  const assigned   = counts['Assigned']    ?? 0
  const inProgress = counts['In_Progress'] ?? 0
  const resolved   = (counts['Resolved'] ?? 0) + (counts['Closed'] ?? 0)

  return (
    <div className="w-full space-y-5">

      {/* ── Header ── */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary-light flex items-center justify-center">
            <ClipboardList size={20} className="text-primary" />
          </div>
          <div>
            <h2 className="text-[15px] font-bold text-text">My Tasks</h2>
            <p className="text-[11px] text-text-muted mt-0.5">
              {profile
                ? `${profile.currentWorkload} active · ${profile.maxWorkload} max capacity`
                + (profile.isPursuing ? ' · Currently pursuing 1 request' : '')
                : `${allTasks.length} total tasks`}
            </p>
          </div>
        </div>

        {/* Workload bar + pursue state */}
        {profile && profile.maxWorkload > 0 && (
          <div className="hidden sm:flex flex-col items-end gap-1.5">
            <div className="flex items-center gap-2">
              {profile.isPursuing ? (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 border border-blue-200">
                  Pursuing
                </span>
              ) : (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200">
                  Free
                </span>
              )}
              <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Workload</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-32 h-2 bg-surface-alt rounded-full overflow-hidden border border-border/50">
                <div
                  className={`h-full rounded-full transition-all ${
                    profile.currentWorkload / profile.maxWorkload > 0.8 ? 'bg-red-400'
                    : profile.currentWorkload / profile.maxWorkload > 0.5 ? 'bg-amber-400'
                    : 'bg-emerald-400'
                  }`}
                  style={{ width: `${Math.min(100, (profile.currentWorkload / profile.maxWorkload) * 100)}%` }}
                />
              </div>
              <span className="text-[11px] font-bold text-text tabular-nums">
                {profile.currentWorkload}/{profile.maxWorkload}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* ── Quick stats ── */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Assigned',    value: assigned,    color: 'text-amber-600',   bg: 'bg-amber-50'   },
          { label: 'In Progress', value: inProgress,  color: 'text-blue-600',    bg: 'bg-blue-50'    },
          { label: 'Resolved',    value: resolved,    color: 'text-emerald-600', bg: 'bg-emerald-50' },
        ].map(({ label, value, color, bg }) => (
          <div key={label} className="bg-white rounded-2xl border border-border/60 p-4 shadow-sm flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl ${bg} flex items-center justify-center shrink-0`}>
              <span className={`text-sm font-bold tabular-nums ${color}`}>{value}</span>
            </div>
            <span className="text-[11px] font-semibold text-text-secondary">{label}</span>
          </div>
        ))}
      </div>

      {/* ── Status filter tabs ── */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <Filter size={13} className="text-text-muted mr-1 shrink-0" />
        {STATUS_TABS.map((tab) => {
          const cnt = tab.value ? (counts[tab.value] ?? 0) : allTasks.length
          return (
            <button
              key={tab.value}
              onClick={() => setStatusFilter(tab.value)}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                statusFilter === tab.value
                  ? 'bg-primary text-white border-primary shadow-sm'
                  : 'bg-white border-border text-text-muted hover:border-primary hover:text-primary'
              }`}
            >
              {tab.label}
              <span className={`tabular-nums text-[10px] ${statusFilter === tab.value ? 'opacity-80' : 'opacity-50'}`}>
                {cnt}
              </span>
            </button>
          )
        })}
      </div>

      {/* ── Task list ── */}
      {tasks.length === 0 ? (
        <div className="bg-white rounded-2xl border border-border/60 p-16 text-center shadow-sm">
          <div className="w-14 h-14 rounded-2xl bg-surface-alt flex items-center justify-center mx-auto mb-4">
            <Inbox size={24} className="text-text-muted" />
          </div>
          <p className="text-sm font-bold text-text mb-1">No tasks here</p>
          <p className="text-xs text-text-muted">
            {statusFilter
              ? `No ${statusFilter.replace('_', ' ').toLowerCase()} tasks assigned to you.`
              : 'No tasks assigned to you yet.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {tasks.map((task) => {
            const isCritical  = task.finalPriority === 'Critical'
            const isAssigned  = task.status === 'Assigned'
            const isPursuing  = task.status === 'In_Progress'
            const isDone      = task.status === 'Resolved' || task.status === 'Closed'
            const borderColor = priorityBorder[task.finalPriority] ?? 'border-l-gray-200'

            return (
              <div
                key={task.id}
                className={`bg-white rounded-xl border border-border/60 border-l-[3px] shadow-sm hover:shadow-md transition-all ${borderColor}
                  ${isDone ? 'opacity-70' : ''}
                  ${isCritical && !isDone ? 'ring-1 ring-red-200 bg-red-50/20' : ''}
                `}
              >
                {/* Critical alert banner */}
                {isCritical && !isDone && (
                  <div className="flex items-center gap-2 px-4 py-1.5 bg-red-600 rounded-t-xl">
                    <Zap size={11} className="text-white" />
                    <span className="text-[11px] font-bold text-white tracking-wide uppercase">
                      Critical — Immediate Action Required
                    </span>
                  </div>
                )}

                {/* Main content */}
                <div className="flex items-start gap-4 p-4">
                  <div className="shrink-0 pt-0.5">
                    {isDone
                      ? <CheckCircle2 size={18} className="text-emerald-500" />
                      : isPursuing
                      ? <PlayCircle   size={18} className="text-blue-500" />
                      : <Clock        size={18} className="text-amber-400" />}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-[10px] font-bold text-text-muted bg-surface-alt px-1.5 py-0.5 rounded">
                          {task.requestCode}
                        </span>
                        <PriorityBadge priority={task.finalPriority} />
                        <SlaChip slaStatus={task.slaStatus} slaDeadline={task.slaDeadline} />
                        {task.autoEscalated && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-700 border border-red-200">
                            ESC
                          </span>
                        )}
                        {isAssigned && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 border border-amber-200">
                            Awaiting Pursue
                          </span>
                        )}
                        {isPursuing && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 border border-blue-200">
                            In Progress
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-text-muted whitespace-nowrap shrink-0">
                        {new Date(task.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                    </div>

                    <h3 className={`text-sm font-bold leading-snug mb-1 ${isCritical ? 'text-red-700' : 'text-text'}`}>
                      {task.title}
                    </h3>

                    <div className="flex items-center gap-3 text-[11px] text-text-muted flex-wrap">
                      <span className="flex items-center gap-1"><MapPin size={11} /> {task.district}, {task.province}</span>
                      <span className="flex items-center gap-1"><Tag size={11} /> {task.categoryName}</span>
                    </div>
                  </div>
                </div>

                {/* Action bar */}
                <div className="flex items-center gap-2 px-4 pb-3 pt-2 border-t border-border/40">
                  {/* Pursue button — only for Assigned status */}
                  {isAssigned && (
                    <button
                      onClick={() => pursueMutation.mutate(task.id)}
                      disabled={pursueMutation.isPending}
                      className={`flex items-center gap-1.5 px-3.5 py-1.5 text-white text-xs font-bold rounded-lg disabled:opacity-50 transition-colors shadow-sm ${
                        isCritical
                          ? 'bg-red-600 hover:bg-red-700'
                          : 'bg-blue-600 hover:bg-blue-700'
                      }`}
                    >
                      {pursueMutation.isPending ? <Loader2 size={12} className="animate-spin" /> : <PlayCircle size={13} />}
                      {isCritical ? 'Pursue Now — Critical' : 'Pursue'}
                    </button>
                  )}

                  {/* Cannot Pursue — only for Assigned status */}
                  {isAssigned && (
                    <button
                      onClick={() => setCannotPursueId(task.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
                    >
                      <XCircle size={12} /> Cannot Pursue
                    </button>
                  )}

                  {isDone && (
                    <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600">
                      <CheckCircle2 size={13} /> Completed
                    </span>
                  )}

                  <div className="flex-1" />

                  <Link
                    to={`/requests/${task.id}`}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-text-secondary hover:text-primary hover:bg-primary-light rounded-lg transition-colors border border-transparent hover:border-primary/20"
                  >
                    <Eye size={13} /> View Details <ArrowRight size={11} />
                  </Link>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Cannot-Pursue confirmation modal ── */}
      {cannotPursueId !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setCannotPursueId(null)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 mb-3">
              <XCircle size={20} className="text-red-500" />
              <h3 className="text-sm font-bold text-text">Cannot Pursue This Request?</h3>
            </div>
            <p className="text-xs text-text-muted mb-4">
              The request will be returned to Pending and Staff will be notified to re-route it.
              Optionally tell us why so Staff can reassign appropriately.
            </p>
            <textarea
              value={cannotPursueReason}
              onChange={(e) => setCannotPursueReason(e.target.value)}
              placeholder="Reason (optional) — e.g. wrong location, emergency..."
              rows={3}
              className="w-full px-3 py-2 border border-border rounded-lg text-xs bg-surface-alt focus:border-red-400 focus:ring-2 focus:ring-red-100 outline-none resize-none mb-4"
            />
            <div className="flex gap-2">
              <button
                onClick={() => cannotPursueMutation.mutate({ id: cannotPursueId, reason: cannotPursueReason })}
                disabled={cannotPursueMutation.isPending}
                className="flex items-center gap-1.5 px-4 py-2 bg-red-600 text-white text-xs font-bold rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {cannotPursueMutation.isPending ? <Loader2 size={12} className="animate-spin" /> : <XCircle size={12} />}
                Confirm — Return to Staff
              </button>
              <button
                onClick={() => { setCannotPursueId(null); setCannotPursueReason('') }}
                className="px-4 py-2 border border-border rounded-lg text-xs text-text-secondary hover:border-primary hover:text-primary transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
