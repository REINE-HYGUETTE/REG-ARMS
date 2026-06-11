import { useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Clock, UserCog, AlertTriangle, ArrowUpRight, XCircle } from 'lucide-react'
import api from '@/lib/api'
import { PriorityBadge } from '@/components/ui/Badge'
import Spinner from '@/components/ui/Spinner'
import type { RequestListItem, RequestStatus } from '@/types'

// Closed and Cancelled are terminal states — they belong in CompletedPage, not the Kanban board
const columns: { status: RequestStatus; label: string; color: string; headerBg: string; dot: string }[] = [
  { status: 'Pending',     label: 'Pending',     color: 'text-amber-700',  headerBg: 'bg-amber-50',   dot: 'bg-amber-400'  },
  { status: 'In_Progress', label: 'In Progress', color: 'text-blue-700',   headerBg: 'bg-blue-50',    dot: 'bg-blue-500'   },
  { status: 'Resolved',    label: 'Resolved',    color: 'text-emerald-700',headerBg: 'bg-emerald-50', dot: 'bg-emerald-500'},
]

const ACTIVE_STATUSES = 'Pending,In_Progress,Resolved'

export default function KanbanPage() {
  const queryClient = useQueryClient()
  const navigate    = useNavigate()

  // Track whether the pointer actually moved (drag) so we don't navigate on drop
  const didDragRef = useRef(false)
  const [dragError, setDragError] = useState<string | null>(null)

  // Fetch only active (non-terminal) requests for the board.
  // Closed/Cancelled are excluded here — they live in CompletedPage.
  // Uses a generous page size; a virtual list can replace this if volume grows large.
  const { data: requests = [], isLoading } = useQuery({
    queryKey: ['kanban-requests'],
    queryFn: async () => {
      const { data } = await api.get<{ content: RequestListItem[] }>('/requests', {
        params: { size: 200, statuses: ACTIVE_STATUSES },
      })
      return data.content
    },
  })

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: RequestStatus }) =>
      api.patch(`/requests/${id}/status`, { status }),
    onSuccess: () => {
      setDragError(null)
      queryClient.invalidateQueries({ queryKey: ['kanban-requests'] })
      queryClient.invalidateQueries({ queryKey: ['requests'] })
      queryClient.invalidateQueries({ queryKey: ['recent-requests'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })
      queryClient.invalidateQueries({ queryKey: ['my-tasks'] })
    },
    onError: (err: unknown) => {
      const apiMsg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      setDragError(apiMsg ?? 'Status update failed. This transition is not permitted.')
      setTimeout(() => setDragError(null), 6000)
    },
  })

  const grouped = columns.map((col) => ({
    ...col,
    items: requests.filter((r) => r.status === col.status),
  }))

  if (isLoading) return <div className="flex justify-center py-16"><Spinner /></div>

  return (
    <div className="w-full">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <h2 className="text-[15px] font-bold text-text">Kanban Board</h2>
        <span className="text-[11px] text-text-muted bg-surface-alt px-2.5 py-1 rounded-full border border-border/60">
          {requests.length} requests
        </span>
        <span className="text-[11px] text-text-muted ml-auto hidden sm:block">
          Click a card to open · Drag to move
        </span>
      </div>

      {/* Drag error banner */}
      {dragError && (
        <div className="flex items-center gap-2.5 mb-4 px-4 py-2.5 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          <XCircle size={15} className="shrink-0 text-red-500" />
          <span className="flex-1">{dragError}</span>
          <button onClick={() => setDragError(null)} className="text-red-400 hover:text-red-600 transition-colors">
            ×
          </button>
        </div>
      )}

      {/* Columns */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {grouped.map((col) => (
          <div key={col.status} className="flex flex-col bg-surface-alt rounded-xl border border-border/60 overflow-hidden">

            {/* Column header */}
            <div className={`px-3.5 py-3 ${col.headerBg} border-b border-border/50 flex items-center justify-between shrink-0`}>
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${col.dot}`} />
                <span className={`text-[11px] font-bold uppercase tracking-wide ${col.color}`}>{col.label}</span>
              </div>
              <span className="text-[11px] font-bold tabular-nums text-text-muted bg-white/80 px-2 py-0.5 rounded-full border border-border/40">
                {col.items.length}
              </span>
            </div>

            {/* Drop zone */}
            <div
              className="flex-1 p-2 space-y-2 min-h-[320px]"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                const id = Number(e.dataTransfer.getData('requestId'))
                if (id) statusMutation.mutate({ id, status: col.status })
              }}
            >
              {col.items.map((r) => (
                <KanbanCard
                  key={r.id}
                  r={r}
                  didDragRef={didDragRef}
                  onNavigate={() => navigate(`/requests/${r.id}`)}
                  onDragStart={(e) => {
                    didDragRef.current = true
                    e.dataTransfer.setData('requestId', String(r.id))
                  }}
                  onDragEnd={() => {
                    setTimeout(() => { didDragRef.current = false }, 80)
                  }}
                />
              ))}

              {col.items.length === 0 && (
                <div className="flex items-center justify-center h-20 text-[11px] text-text-muted/50 font-medium select-none">
                  Empty
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Individual Kanban card ──────────────────────────────────────────────────────
interface CardProps {
  r: RequestListItem
  didDragRef: React.MutableRefObject<boolean>
  onNavigate: () => void
  onDragStart: (e: React.DragEvent) => void
  onDragEnd: () => void
}

function KanbanCard({ r, didDragRef, onNavigate, onDragStart, onDragEnd }: CardProps) {

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={() => {
        // Only navigate if this was a click, not the end of a drag
        if (!didDragRef.current) onNavigate()
      }}
      className="
        group relative bg-white rounded-xl border border-border/70 p-3 shadow-sm
        hover:border-primary/60 hover:shadow-[0_4px_16px_-4px_rgba(0,0,0,0.12)]
        hover:-translate-y-[2px] active:translate-y-0 active:shadow-sm
        transition-all duration-150 cursor-pointer select-none
        active:cursor-grabbing
      "
    >
      {/* Subtle top-right arrow — appears on hover to signal clickability */}
      <div className="absolute top-2.5 right-2.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <ArrowUpRight size={13} className="text-primary" />
      </div>

      {/* Title */}
      <p className="text-[13px] font-semibold text-text leading-snug mb-1.5 pr-5 group-hover:text-primary transition-colors">
        {r.title}
      </p>

      {/* Location */}
      <p className="text-[11px] text-text-muted mb-2.5 leading-snug">
        {r.district}, {r.province}
      </p>

      {/* Priority + date row */}
      <div className="flex items-center justify-between mb-2">
        <PriorityBadge priority={r.finalPriority} />
        <span className="text-[10px] text-text-muted flex items-center gap-0.5 tabular-nums">
          <Clock size={9} />
          {new Date(r.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        </span>
      </div>

      {/* SLA alerts */}
      {r.slaStatus === 'BREACHED' && (
        <div className="flex items-center gap-1 text-[10px] font-semibold text-red-600 bg-red-50 px-2 py-1 rounded-lg mb-2">
          <AlertTriangle size={9} /> SLA Breached
        </div>
      )}
      {r.slaStatus === 'AT_RISK' && (
        <div className="flex items-center gap-1 text-[10px] font-semibold text-amber-600 bg-amber-50 px-2 py-1 rounded-lg mb-2">
          <AlertTriangle size={9} /> SLA At Risk
        </div>
      )}

      {/* Show assigned technician on all cards when present */}
      {r.technicianName && (
        <div className="border-t border-border/50 pt-2 mt-1">
          <p className="text-[11px] text-text-muted flex items-center gap-1 truncate">
            <UserCog size={10} className="shrink-0" /> {r.technicianName}
          </p>
        </div>
      )}
    </div>
  )
}
