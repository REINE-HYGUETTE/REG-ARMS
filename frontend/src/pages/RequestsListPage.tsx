import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Search, ChevronLeft, ChevronRight, UserCog,
  AlertTriangle, CheckCircle, Timer, TrendingUp, SlidersHorizontal, X, Copy,
} from 'lucide-react'
import api from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { PriorityBadge, StatusBadge } from '@/components/ui/Badge'
import Spinner from '@/components/ui/Spinner'
import type { Page, RequestListItem, Technician } from '@/types'

// ── SLA badge ─────────────────────────────────────────────────────────────────
function SlaBadge({ slaStatus, slaDeadline }: { slaStatus?: string; slaDeadline?: string }) {
  if (!slaStatus) return <span className="text-text-muted text-[11px]">—</span>

  const deadline  = slaDeadline ? new Date(slaDeadline) : null
  const now       = new Date()
  const diff      = deadline ? deadline.getTime() - now.getTime() : 0
  const hoursLeft = Math.floor(Math.abs(diff) / 3_600_000)
  const label     = diff <= 0 ? `${hoursLeft}h over` : `${hoursLeft}h left`

  const cfg = ({
    OK:       { cls: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200', Icon: CheckCircle  },
    AT_RISK:  { cls: 'bg-amber-50  text-amber-700  ring-1 ring-amber-200',   Icon: AlertTriangle },
    BREACHED: { cls: 'bg-red-50    text-red-700    ring-1 ring-red-200',     Icon: AlertTriangle },
  } as const)[slaStatus as 'OK' | 'AT_RISK' | 'BREACHED'] ?? { cls: 'bg-gray-100 text-gray-600', Icon: Timer }

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold ${cfg.cls}`}>
      <cfg.Icon size={10} />
      {label}
    </span>
  )
}

const PROVINCES = ['Kigali', 'Eastern', 'Western', 'Northern', 'Southern']

export default function RequestsListPage() {
  const { role } = useAuth()
  const queryClient = useQueryClient()
  const isStaff = role === 'STAFF'

  const [page, setPage]         = useState(0)
  const [status, setStatus]     = useState('')
  const [priority, setPriority] = useState('')
  const [search, setSearch]     = useState('')
  const [province, setProvince] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo]     = useState('')
  const [slaFilter, setSlaFilter] = useState('')
  const [assigningId, setAssigningId] = useState<number | null>(null)
  const [showAdvanced, setShowAdvanced] = useState(false)

  const hasAdvanced = !!(province || dateFrom || dateTo || slaFilter)

  const { data, isLoading } = useQuery({
    queryKey: ['requests', page, status, priority, search, province, dateFrom, dateTo, slaFilter],
    queryFn: async () => {
      const params: Record<string, string | number> = { page, size: 15 }
      if (status)    params.status    = status
      if (priority)  params.priority  = priority
      if (search)    params.search    = search
      if (province)  params.province  = province
      if (dateFrom)  params.dateFrom  = dateFrom
      if (dateTo)    params.dateTo    = dateTo
      if (slaFilter) params.slaStatus = slaFilter
      const { data } = await api.get<Page<RequestListItem>>('/requests', { params })
      return data
    },
  })

  // Sort: active requests before done, then newest first.
  const isDone = (r: { status: string }) =>
    r.status === 'Resolved' || r.status === 'Closed' || r.status === 'Cancelled'

  const rows = [...(data?.content ?? [])].sort((a, b) => {
    // 1. Active before done
    const doneA = isDone(a) ? 1 : 0
    const doneB = isDone(b) ? 1 : 0
    if (doneA !== doneB) return doneA - doneB
    // 2. Newest first
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  })

  const { data: technicians = [] } = useQuery({
    queryKey: ['technicians-available'],
    queryFn: async () => (await api.get<Technician[]>('/technicians/available')).data,
    enabled: isStaff,
  })

  const assignMutation = useMutation({
    mutationFn: async ({ requestId, technicianId }: { requestId: number; technicianId: number }) => {
      await api.patch(`/requests/${requestId}/assign`, { technicianId })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['requests'] })
      queryClient.invalidateQueries({ queryKey: ['kanban-requests'] })
      queryClient.invalidateQueries({ queryKey: ['my-tasks'] })
      queryClient.invalidateQueries({ queryKey: ['technicians-available'] })
      setAssigningId(null)
    },
  })

  const clearAdvanced = () => {
    setProvince(''); setDateFrom(''); setDateTo(''); setSlaFilter(''); setPage(0)
  }

  return (
    <div>
      {/* ── Page header ── */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-lg font-bold text-text">
            {isStaff ? 'District Requests' : 'All Requests'}
          </h2>
          {data && (
            <p className="text-[11px] text-text-muted mt-0.5">
              {data.totalElements.toLocaleString()} request{data.totalElements !== 1 ? 's' : ''}
              {isStaff && ' · Showing your district only'}
            </p>
          )}
        </div>
      </div>

      {/* ── Filters card ── */}
      <div className="bg-white rounded-2xl border border-border/70 shadow-sm mb-5">
        {/* Primary filters row */}
        <div className="flex flex-wrap items-center gap-2.5 p-4">
          {/* Search */}
          <div className="relative flex-1 min-w-[220px] max-w-sm">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0) }}
              placeholder="Search title, code, customer…"
              className="w-full pl-9 pr-3.5 py-2.5 border-[1.5px] border-border rounded-xl text-sm focus:border-primary focus:ring-4 focus:ring-primary/8 outline-none transition-all bg-surface-alt focus:bg-white"
            />
          </div>

          {/* Status */}
          <select
            value={status}
            onChange={(e) => { setStatus(e.target.value); setPage(0) }}
            className="px-3.5 py-2.5 border-[1.5px] border-border rounded-xl text-sm bg-surface-alt focus:border-primary focus:ring-4 focus:ring-primary/8 outline-none transition-all cursor-pointer"
          >
            <option value="">All Statuses</option>
            <option value="Pending">Pending</option>
            <option value="Assigned">Assigned</option>
            <option value="In_Progress">In Progress</option>
            <option value="Problematic">Problematic</option>
            <option value="Resolved">Resolved</option>
            <option value="Closed">Closed</option>
            <option value="Cancelled">Cancelled</option>
          </select>

          {/* Priority */}
          <select
            value={priority}
            onChange={(e) => { setPriority(e.target.value); setPage(0) }}
            className="px-3.5 py-2.5 border-[1.5px] border-border rounded-xl text-sm bg-surface-alt focus:border-primary focus:ring-4 focus:ring-primary/8 outline-none transition-all cursor-pointer"
          >
            <option value="">All Priorities</option>
            <option value="Critical">Critical</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
          </select>

          {/* Toggle advanced */}
          <button
            onClick={() => setShowAdvanced((v) => !v)}
            className={`flex items-center gap-1.5 px-3.5 py-2.5 border-[1.5px] rounded-xl text-sm font-medium transition-all ${
              hasAdvanced
                ? 'border-primary bg-primary-light text-primary'
                : 'border-border bg-surface-alt text-text-muted hover:border-primary hover:text-primary'
            }`}
          >
            <SlidersHorizontal size={14} />
            Filters
            {hasAdvanced && <span className="w-4 h-4 bg-primary text-white text-[9px] font-bold rounded-full flex items-center justify-center ml-0.5">!</span>}
          </button>
        </div>

        {/* Advanced filters row */}
        {showAdvanced && (
          <div className="flex flex-wrap items-center gap-2.5 px-4 pb-4 pt-0 border-t border-border/50 pt-3">
            <select
              value={province}
              onChange={(e) => { setProvince(e.target.value); setPage(0) }}
              className="px-3.5 py-2 border-[1.5px] border-border rounded-xl text-sm bg-surface-alt focus:border-primary outline-none cursor-pointer"
            >
              <option value="">All Provinces</option>
              {PROVINCES.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>

            <div className="flex items-center gap-2">
              <label className="text-[11px] font-semibold text-text-muted">From</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => { setDateFrom(e.target.value); setPage(0) }}
                className="px-3 py-2 border-[1.5px] border-border rounded-xl text-sm bg-surface-alt focus:border-primary outline-none"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-[11px] font-semibold text-text-muted">To</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => { setDateTo(e.target.value); setPage(0) }}
                className="px-3 py-2 border-[1.5px] border-border rounded-xl text-sm bg-surface-alt focus:border-primary outline-none"
              />
            </div>

            <select
              value={slaFilter}
              onChange={(e) => setSlaFilter(e.target.value)}
              className="px-3.5 py-2 border-[1.5px] border-border rounded-xl text-sm bg-surface-alt focus:border-primary outline-none cursor-pointer"
            >
              <option value="">All SLA</option>
              <option value="OK">On Track</option>
              <option value="AT_RISK">At Risk</option>
              <option value="BREACHED">Breached</option>
            </select>

            {hasAdvanced && (
              <button
                onClick={clearAdvanced}
                className="flex items-center gap-1 text-xs font-semibold text-text-muted hover:text-primary transition-colors"
              >
                <X size={12} /> Clear
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Table ── */}
      {isLoading ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : !rows.length ? (
        <div className="bg-white rounded-2xl border border-border/70 p-16 text-center shadow-sm">
          <div className="w-12 h-12 rounded-2xl bg-surface-alt border border-border flex items-center justify-center mx-auto mb-3">
            <Search size={20} className="text-text-muted" />
          </div>
          <p className="text-sm font-semibold text-text mb-1">No requests found</p>
          <p className="text-xs text-text-muted">Try adjusting your search or filter criteria</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-border/70 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-surface-alt border-b border-border/70">
                  <th className="text-left px-5 py-3 text-[10px] font-bold text-text-muted uppercase tracking-widest">Code</th>
                  <th className="text-left px-5 py-3 text-[10px] font-bold text-text-muted uppercase tracking-widest">Title</th>
                  <th className="text-left px-5 py-3 text-[10px] font-bold text-text-muted uppercase tracking-widest">Customer</th>
                  <th className="text-left px-5 py-3 text-[10px] font-bold text-text-muted uppercase tracking-widest">Priority</th>
                  <th className="text-left px-5 py-3 text-[10px] font-bold text-text-muted uppercase tracking-widest">Status</th>
                  <th className="text-left px-5 py-3 text-[10px] font-bold text-text-muted uppercase tracking-widest">
                    {isStaff ? 'Assign To' : 'Technician'}
                  </th>
                  <th className="text-left px-5 py-3 text-[10px] font-bold text-text-muted uppercase tracking-widest">SLA</th>
                  <th className="text-left px-5 py-3 text-[10px] font-bold text-text-muted uppercase tracking-widest">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {rows.map((r) => (
                  <tr key={r.id} className={`transition-colors group ${
                    r.finalPriority === 'Critical' && r.status !== 'Resolved' && r.status !== 'Closed'
                      ? 'bg-red-50/60 hover:bg-red-50 border-l-2 border-l-red-400'
                      : 'hover:bg-surface-alt/60'
                  }`}>
                    <td className="px-5 py-3.5">
                      <Link to={`/requests/${r.id}`} className="font-mono text-[11px] font-bold text-primary bg-primary-light px-2 py-1 rounded-md hover:bg-primary hover:text-white transition-colors">
                        {r.requestCode}
                      </Link>
                    </td>
                    <td className="px-5 py-3.5 max-w-[220px]">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Link to={`/requests/${r.id}`} className="text-sm font-semibold text-text group-hover:text-primary transition-colors truncate max-w-[180px]">
                          {r.title}
                        </Link>
                        {r.autoEscalated && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-red-100 text-red-700 border border-red-200 shrink-0">
                            <TrendingUp size={8} /> ESC
                          </span>
                        )}
                        {r.possibleDuplicate && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-amber-100 text-amber-700 border border-amber-200 shrink-0" title="Customer already had an open request in this category">
                            <Copy size={8} /> DUP
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-text-muted">{r.categoryName}</span>
                    </td>
                    <td className="px-5 py-3.5 text-sm text-text-secondary">{r.customerName}</td>
                    <td className="px-5 py-3.5"><PriorityBadge priority={r.finalPriority} /></td>
                    <td className="px-5 py-3.5"><StatusBadge status={r.status} /></td>

                    {/* Assign / technician cell */}
                    <td className="px-5 py-3.5">
                      {isStaff ? (
                        assigningId === r.id ? (
                          <div className="flex items-center gap-1.5">
                            <select
                              autoFocus
                              defaultValue=""
                              onChange={(e) => {
                                if (e.target.value) {
                                  assignMutation.mutate({ requestId: r.id, technicianId: Number(e.target.value) })
                                }
                              }}
                              onBlur={() => setAssigningId(null)}
                              className="text-xs border-[1.5px] border-primary rounded-xl px-2.5 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
                            >
                              <option value="" disabled>Pick technician…</option>
                              {technicians.map((t) => (
                                <option key={t.id} value={t.userId}>
                                  {t.fullName} ({t.currentWorkload}/{t.maxWorkload})
                                </option>
                              ))}
                            </select>
                          </div>
                        ) : (
                          <button
                            onClick={() => setAssigningId(r.id)}
                            className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl border transition-all ${
                              r.technicianName
                                ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:border-emerald-400'
                                : 'border-dashed border-border text-text-muted hover:border-primary hover:text-primary hover:bg-primary-light'
                            }`}
                          >
                            <UserCog size={12} />
                            {r.technicianName ?? 'Assign…'}
                          </button>
                        )
                      ) : (
                        <span className="text-sm text-text-secondary">{r.technicianName ?? '—'}</span>
                      )}
                    </td>

                    <td className="px-5 py-3.5">
                      {r.status === 'Resolved' || r.status === 'Closed'
                        ? <span className="text-[10px] text-emerald-600 font-semibold">Resolved</span>
                        : r.status === 'Cancelled'
                        ? <span className="text-[10px] text-gray-400">—</span>
                        : <SlaBadge slaStatus={r.slaStatus} slaDeadline={r.slaDeadline} />
                      }
                    </td>
                    <td className="px-5 py-3.5 text-[11px] text-text-muted whitespace-nowrap">
                      {new Date(r.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Pagination ── */}
      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-[11px] text-text-muted font-medium">
            Page {data.number + 1} of {data.totalPages} · {data.totalElements.toLocaleString()} requests
          </p>
          <div className="flex items-center gap-1.5">
            <button
              disabled={data.first}
              onClick={() => setPage((p) => p - 1)}
              className="w-9 h-9 flex items-center justify-center rounded-xl border-[1.5px] border-border hover:border-primary hover:text-primary disabled:opacity-30 transition-all"
            >
              <ChevronLeft size={16} />
            </button>
            {/* Page numbers */}
            {Array.from({ length: Math.min(5, data.totalPages) }, (_, i) => {
              const pageNum = Math.max(0, Math.min(data.totalPages - 5, data.number - 2)) + i
              return (
                <button
                  key={pageNum}
                  onClick={() => setPage(pageNum)}
                  className={`w-9 h-9 flex items-center justify-center rounded-xl border-[1.5px] text-sm font-semibold transition-all ${
                    pageNum === data.number
                      ? 'border-primary bg-primary text-white shadow-sm'
                      : 'border-border hover:border-primary hover:text-primary'
                  }`}
                >
                  {pageNum + 1}
                </button>
              )
            })}
            <button
              disabled={data.last}
              onClick={() => setPage((p) => p + 1)}
              className="w-9 h-9 flex items-center justify-center rounded-xl border-[1.5px] border-border hover:border-primary hover:text-primary disabled:opacity-30 transition-all"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
