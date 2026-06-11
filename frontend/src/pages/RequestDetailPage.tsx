import { useState, useRef, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft, Send, Paperclip, Download, Eye, Clock, User, MapPin, Tag, UserCog, Flag,
  AlertTriangle, CheckCircle, Timer, Star, TrendingUp, Zap, XCircle, FileEdit,
  History, ChevronDown, ChevronUp, Pencil, Trash2, Check, X as XIcon, Copy,
  Loader2, PlayCircle, MessageSquare,
} from 'lucide-react'
import api from '@/lib/api'
import { fileUrl } from '@/lib/fileUrl'
import { useAuth } from '@/lib/auth'
import { PriorityBadge, StatusBadge } from '@/components/ui/Badge'
import Spinner from '@/components/ui/Spinner'
import type { ServiceRequest, RequestStatus, PriorityLevel, TechnicianRecommendation, ActivityLogEntry } from '@/types'

// ── Relative timestamp ─────────────────────────────────────────────────────────
function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const s = Math.floor(diff / 1000)
  if (s < 60)  return 'just now'
  const m = Math.floor(s / 60)
  if (m < 60)  return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24)  return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 7)   return `${d}d ago`
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const statusSteps: { key: string; label: string }[] = [
  { key: 'Submitted',   label: 'Submitted'   },
  { key: 'Assigned',    label: 'Assigned'    },
  { key: 'In_Progress', label: 'In Progress' },
  { key: 'Resolved',    label: 'Resolved'    },
]

function getStepIndex(status: RequestStatus, hasTechnician: boolean): number {
  if (status === 'Resolved' || status === 'Closed') return 4
  if (status === 'In_Progress') return 3
  if (status === 'Assigned' || hasTechnician) return 2
  return 1
}

// ── SLA indicator ─────────────────────────────────────────────────────────────
function SlaIndicator({ slaStatus, slaDeadline }: { slaStatus?: string; slaDeadline?: string }) {
  if (!slaStatus || !slaDeadline) return null
  const deadline = new Date(slaDeadline)
  const now = new Date()
  const diff = deadline.getTime() - now.getTime()
  const hoursLeft = Math.floor(diff / 3_600_000)
  const minsLeft  = Math.floor((diff % 3_600_000) / 60_000)

  let timeLabel: string
  if (diff <= 0) {
    const abs   = Math.abs(diff)
    const overH = Math.floor(abs / 3_600_000)
    const overM = Math.floor((abs % 3_600_000) / 60_000)
    timeLabel = overH > 0 ? `${overH}h ${overM}m overdue` : `${overM}m overdue`
  } else if (hoursLeft > 0) {
    timeLabel = `${hoursLeft}h ${minsLeft}m left`
  } else {
    timeLabel = `${minsLeft}m left`
  }

  const colors = {
    OK:       'bg-green-50 text-green-700 border-green-200',
    AT_RISK:  'bg-amber-50 text-amber-700 border-amber-200',
    BREACHED: 'bg-red-50 text-red-700 border-red-200',
  }[slaStatus] ?? 'bg-gray-50 text-gray-600 border-gray-200'

  const icons = {
    OK:       <CheckCircle size={14} />,
    AT_RISK:  <AlertTriangle size={14} />,
    BREACHED: <AlertTriangle size={14} />,
  }[slaStatus] ?? <Timer size={14} />

  return (
    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold ${colors}`}>
      {icons}
      SLA · {timeLabel}
    </div>
  )
}

const allStatuses: RequestStatus[]   = ['Pending', 'In_Progress', 'Resolved', 'Closed']
const allPriorities: PriorityLevel[] = ['Low', 'Medium', 'High', 'Critical']

export default function RequestDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { role, userId } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [comment, setComment]         = useState('')
  const [isInternal, setIsInternal]   = useState(false)
  const [showRecommendations, setShowRecommendations] = useState(false)
  const [resolutionNotes, setResolutionNotes] = useState('')
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)
  const [hoverRating, setHoverRating]             = useState(0)
  const [ratingFeedback, setRatingFeedback]       = useState('')
  const [showActivityLog, setShowActivityLog] = useState(false)
  const [editingCommentId, setEditingCommentId] = useState<number | null>(null)
  const [editingBody, setEditingBody] = useState('')
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null)

  // Chat scroll anchor
  const chatEndRef = useRef<HTMLDivElement>(null)

  const canOperate  = role === 'STAFF' || role === 'TECHNICIAN'
  const canAssign   = role === 'STAFF'
  const canPriority = role === 'STAFF'
  // All roles can comment — customers see/post public messages only;
  // staff/tech/admin can also post internal notes hidden from the customer
  const canComment = true

  const { data: request, isLoading } = useQuery({
    queryKey: ['request', id],
    queryFn: async () => {
      const { data } = await api.get<ServiceRequest>(`/requests/${id}`)
      return data
    },
  })

  // Auto-scroll chat to latest message whenever comments change
  const commentCount = request?.comments?.length ?? 0
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [commentCount])

  // Feature 1: smart technician recommendations (staff only, on demand)
  const { data: recommendations = [], isFetching: recLoading } = useQuery({
    queryKey: ['tech-recommendations', id],
    queryFn: async () => (await api.get<TechnicianRecommendation[]>(`/requests/${id}/technician-recommendations`)).data,
    enabled: canAssign && showRecommendations,
  })

  const statusMutation = useMutation({
    mutationFn: async (status: RequestStatus) => {
      await api.patch(`/requests/${id}/status`, {
        status,
        resolutionNotes: status === 'Resolved' && resolutionNotes.trim() ? resolutionNotes.trim() : undefined,
      })
    },
    onSuccess: () => {
      setResolutionNotes('')
      queryClient.invalidateQueries({ queryKey: ['request', id] })
      queryClient.invalidateQueries({ queryKey: ['requests'] })
      queryClient.invalidateQueries({ queryKey: ['kanban-requests'] })
      queryClient.invalidateQueries({ queryKey: ['recent-requests'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })
      queryClient.invalidateQueries({ queryKey: ['my-tasks'] })
    },
  })

  const rateMutation = useMutation({
    mutationFn: async ({ rating, feedback }: { rating: number; feedback: string }) => {
      await api.post(`/requests/${id}/rate`, { rating, feedback })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['request', id] })
    },
  })

  const cancelMutation = useMutation({
    mutationFn: async () => {
      await api.post(`/requests/${id}/cancel`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-requests'] })
      queryClient.invalidateQueries({ queryKey: ['my-stats'] })
      navigate('/my-requests')
    },
  })

  // ── Pursue-flow mutations ─────────────────────────────────────────────────
  const [showCannotPursue, setShowCannotPursue] = useState(false)
  const [cannotPursueReason, setCannotPursueReason] = useState('')

  const pursueMutation = useMutation({
    mutationFn: async () => { await api.post(`/requests/${id}/pursue`) },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['request', id] })
      queryClient.invalidateQueries({ queryKey: ['my-tasks'] })
      queryClient.invalidateQueries({ queryKey: ['my-tasks-counts'] })
      queryClient.invalidateQueries({ queryKey: ['technician-me'] })
    },
  })

  const cannotPursueMutation = useMutation({
    mutationFn: async (reason: string) => {
      await api.post(`/requests/${id}/cannot-pursue`, { reason })
    },
    onSuccess: () => {
      setShowCannotPursue(false)
      setCannotPursueReason('')
      queryClient.invalidateQueries({ queryKey: ['request', id] })
      queryClient.invalidateQueries({ queryKey: ['my-tasks'] })
      queryClient.invalidateQueries({ queryKey: ['my-tasks-counts'] })
      queryClient.invalidateQueries({ queryKey: ['technician-me'] })
    },
  })

  const priorityMutation = useMutation({
    mutationFn: async (priority: PriorityLevel) => {
      await api.patch(`/requests/${id}/priority`, { priority })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['request', id] })
      queryClient.invalidateQueries({ queryKey: ['requests'] })
      queryClient.invalidateQueries({ queryKey: ['kanban-requests'] })
      queryClient.invalidateQueries({ queryKey: ['recent-requests'] })
    },
  })

  const assignMutation = useMutation({
    mutationFn: async ({ technicianUserId, rank }: { technicianUserId: number; rank?: number }) => {
      await api.patch(`/requests/${id}/assign`, { technicianId: technicianUserId, recommendationRank: rank })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['request', id] })
      queryClient.invalidateQueries({ queryKey: ['requests'] })
      queryClient.invalidateQueries({ queryKey: ['kanban-requests'] })
      queryClient.invalidateQueries({ queryKey: ['recent-requests'] })
      queryClient.invalidateQueries({ queryKey: ['my-tasks'] })
      queryClient.invalidateQueries({ queryKey: ['tech-recommendations', id] })
      setShowRecommendations(false)
    },
  })

  const commentMutation = useMutation({
    mutationFn: async () => {
      await api.post(`/requests/${id}/comments`, { body: comment, isInternal })
    },
    onSuccess: () => {
      setComment('')
      queryClient.invalidateQueries({ queryKey: ['request', id] })
    },
  })

  const editCommentMutation = useMutation({
    mutationFn: async ({ commentId, body }: { commentId: number; body: string }) => {
      await api.patch(`/requests/${id}/comments/${commentId}`, { body })
    },
    onSuccess: () => {
      setEditingCommentId(null)
      setEditingBody('')
      queryClient.invalidateQueries({ queryKey: ['request', id] })
    },
  })

  const deleteCommentMutation = useMutation({
    mutationFn: async (commentId: number) => {
      await api.delete(`/requests/${id}/comments/${commentId}`)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['request', id] }),
  })

  const { data: activityLog = [] } = useQuery({
    queryKey: ['activity-log', id],
    queryFn: async () => (await api.get<ActivityLogEntry[]>(`/requests/${id}/activity-log`)).data,
    enabled: showActivityLog,
  })

  if (isLoading) return <div className="flex justify-center py-20"><Spinner /></div>
  if (!request)  return <div className="text-center py-20 text-text-muted">Request not found</div>

  const completedSteps    = getStepIndex(request.status, !!request.technicianId)
  const effectivePriority = request.manualPriority ?? request.aiPriority ?? request.finalPriority
  const isResolved        = request.status === 'Resolved' || request.status === 'Closed'
  const isCancelled       = request.status === 'Cancelled'
  const isCritical        = request.finalPriority === 'Critical'
  const canCancel         = role === 'CUSTOMER' && request.status === 'Pending'

  // Pursue-flow flags for the assigned technician
  const isAssignedToMe = role === 'TECHNICIAN' && request.technicianId === userId
  const canPursue      = isAssignedToMe && request.status === 'Assigned'
  const canResolve     = isAssignedToMe && request.status === 'In_Progress'

  return (
    <div>
      <Link
        to={role === 'CUSTOMER' ? '/my-requests' : role === 'TECHNICIAN' ? '/tasks' : '/requests'}
        className="inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-primary mb-4 transition-colors"
      >
        <ArrowLeft size={16} /> Back to requests
      </Link>

      {/* ── Header ── */}
      <div className="bg-white rounded-xl border border-border p-6 shadow-sm mb-4">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h2 className="text-lg font-bold text-text mb-1">{request.title}</h2>
            <code className="text-xs text-text-muted">{request.requestCode}</code>
          </div>
          <div className="flex flex-wrap gap-2 justify-end">
            <PriorityBadge priority={request.finalPriority} />
            {request.manualPriority && (
              <span className="text-[10px] px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full font-semibold">
                Override
              </span>
            )}
            <StatusBadge status={request.status} />
            {/* SLA indicator */}
            {!isResolved && !isCancelled && (
              <SlaIndicator slaStatus={request.slaStatus} slaDeadline={request.slaDeadline} />
            )}
            {/* Auto-escalation badge */}
            {request.autoEscalated && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-red-100 text-red-700 border border-red-200">
                <TrendingUp size={11} /> Auto-escalated to Critical
              </span>
            )}
            {/* Possible-duplicate badge — Staff and Admin only */}
            {request.possibleDuplicate && role !== 'CUSTOMER' && (
              <span
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-amber-100 text-amber-700 border border-amber-200"
                title="Submitted while the customer already had an open request in this category"
              >
                <Copy size={11} /> Possible Duplicate
              </span>
            )}
            {/* Customer cancel button */}
            {canCancel && (
              <button
                onClick={() => setShowCancelConfirm(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-red-300 text-red-600 text-xs font-semibold hover:bg-red-50 transition-colors"
              >
                <XCircle size={13} /> Cancel Request
              </button>
            )}
            {/* Technician pursue actions */}
            {canPursue && (
              <button
                onClick={() => pursueMutation.mutate()}
                disabled={pursueMutation.isPending}
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold text-white disabled:opacity-50 transition-colors ${
                  isCritical ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {pursueMutation.isPending ? <Loader2 size={12} className="animate-spin" /> : <PlayCircle size={12} />}
                {isCritical ? 'Pursue Now — Critical' : 'Pursue'}
              </button>
            )}
            {canPursue && (
              <button
                onClick={() => setShowCannotPursue(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-red-300 text-red-600 text-xs font-semibold hover:bg-red-50 transition-colors"
              >
                <XCircle size={12} /> Cannot Pursue
              </button>
            )}
            {/* Technician resolve button — shown while In_Progress */}
            {canResolve && (
              <button
                onClick={() => statusMutation.mutate('Resolved')}
                disabled={statusMutation.isPending}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 disabled:opacity-50 transition-colors"
              >
                {statusMutation.isPending ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle size={12} />}
                Mark Resolved
              </button>
            )}
          </div>
        </div>

        {/* Progress Tracker */}
        <div className="flex items-center gap-0 my-5 relative">
          <div className="absolute top-[15px] left-0 right-0 h-0.5 bg-border" />
          {statusSteps.map((step, i) => {
            const done    = i < completedSteps
            const current = i === completedSteps - 1
            return (
              <div key={step.key} className="flex flex-col items-center flex-1 relative z-10">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold border-2 ${
                  done    ? 'bg-primary border-primary text-white'
                  : current ? 'bg-white border-primary text-primary ring-3 ring-primary/10'
                  : 'bg-white border-border text-text-muted'
                }`}>
                  {done ? '✓' : i + 1}
                </div>
                <span className={`text-[11px] mt-1.5 ${done || current ? 'text-text-secondary font-medium' : 'text-text-muted'}`}>
                  {step.label}
                </span>
              </div>
            )
          })}
        </div>

        {/* Details Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-surface-alt rounded-lg">
          <div>
            <p className="text-[11px] font-semibold text-text-muted uppercase tracking-wide mb-1 flex items-center gap-1">
              <User size={12} /> Customer
            </p>
            <p className="text-sm">{request.customerName}</p>
          </div>
          <div>
            <p className="text-[11px] font-semibold text-text-muted uppercase tracking-wide mb-1 flex items-center gap-1">
              <MapPin size={12} /> Location
            </p>
            <p className="text-sm">{request.district}, {request.province}</p>
          </div>
          <div>
            <p className="text-[11px] font-semibold text-text-muted uppercase tracking-wide mb-1 flex items-center gap-1">
              <Tag size={12} /> Category
            </p>
            <p className="text-sm">{request.categoryName}</p>
          </div>
          <div>
            <p className="text-[11px] font-semibold text-text-muted uppercase tracking-wide mb-1 flex items-center gap-1">
              <Clock size={12} /> Created
            </p>
            <p className="text-sm">
              {new Date(request.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </p>
          </div>
          {request.technicianName && (
            <div className="col-span-2">
              <p className="text-[11px] font-semibold text-text-muted uppercase tracking-wide mb-1">Technician</p>
              <p className="text-sm">{request.technicianName}</p>
            </div>
          )}
          {request.aiPriority && (
            <div>
              <p className="text-[11px] font-semibold text-text-muted uppercase tracking-wide mb-1">AI Priority</p>
              <div className="flex items-center gap-2">
                <PriorityBadge priority={request.aiPriority} />
                {request.aiConfidence && (
                  <span className="text-xs text-text-muted">{(request.aiConfidence * 100).toFixed(0)}%</span>
                )}
              </div>
            </div>
          )}
          {request.estimatedResolutionHours != null && (
            <div>
              <p className="text-[11px] font-semibold text-text-muted uppercase tracking-wide mb-1 flex items-center gap-1">
                <TrendingUp size={12} /> Est. Resolution
              </p>
              <p className="text-sm">{request.estimatedResolutionHours.toFixed(1)}h avg</p>
            </div>
          )}
        </div>

        {/* Description */}
        <div className="mt-4">
          <p className="text-[11px] font-semibold text-text-muted uppercase tracking-wide mb-2">Description</p>
          <p className="text-sm text-text-secondary leading-relaxed">{request.description}</p>
        </div>

        {request.resolutionNotes && (
          <div className="mt-4 p-3 bg-primary-light rounded-lg border-l-3 border-primary">
            <p className="text-xs font-semibold text-primary mb-1">Resolution Notes</p>
            <p className="text-sm text-text-secondary">{request.resolutionNotes}</p>
          </div>
        )}

        {/* Customer satisfaction rating */}
        {isResolved && role === 'CUSTOMER' && (
          <div className="mt-4 p-4 bg-amber-50 rounded-lg border border-amber-200">
            {request.satisfactionRating ? (
              <div>
                <p className="text-xs font-semibold text-amber-700 mb-1">Your Rating</p>
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star
                      key={s}
                      size={18}
                      className={s <= request.satisfactionRating! ? 'fill-amber-400 text-amber-400' : 'text-amber-200'}
                    />
                  ))}
                  <span className="text-xs text-amber-700 ml-1 font-medium">{request.satisfactionRating}/5</span>
                </div>
                {request.customerFeedback && (
                  <p className="text-xs text-text-secondary mt-1 italic">"{request.customerFeedback}"</p>
                )}
              </div>
            ) : (
              <div>
                <p className="text-xs font-semibold text-amber-700 mb-2">How satisfied are you with the resolution?</p>
                <div className="flex items-center gap-1 mb-3">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <button
                      key={s}
                      type="button"
                      onMouseEnter={() => setHoverRating(s)}
                      onMouseLeave={() => setHoverRating(0)}
                      onClick={() => rateMutation.mutate({ rating: s, feedback: ratingFeedback })}
                      disabled={rateMutation.isPending}
                      className="p-0.5 transition-transform hover:scale-110 disabled:opacity-50"
                    >
                      <Star
                        size={24}
                        className={s <= (hoverRating || 0) ? 'fill-amber-400 text-amber-400' : 'text-amber-300'}
                      />
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  value={ratingFeedback}
                  onChange={(e) => setRatingFeedback(e.target.value)}
                  placeholder="Optional feedback…"
                  className="w-full px-3 py-1.5 border border-amber-300 rounded-lg text-xs text-text focus:border-amber-500 outline-none bg-white"
                />
                {rateMutation.isError && (
                  <p className="text-xs text-red-600 mt-1">
                    {(rateMutation.error as Error)?.message ?? 'Failed to submit rating.'}
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {request.aiKeywordsDetected?.keywords?.length ? (
          <div className="mt-4 p-3 bg-red-50 rounded-lg border-l-3 border-red-500">
            <p className="text-xs font-medium text-red-600">
              Urgency keywords: <strong>{request.aiKeywordsDetected.keywords.join(', ')}</strong>
            </p>
          </div>
        ) : null}
      </div>

      {/* ── Management Panel (Staff / Admin / Technician) ── */}
      {canOperate && (
        <div className="bg-white rounded-xl border border-border p-5 shadow-sm mb-4 space-y-5">

          {/* Status update */}
          <div>
            <p className="text-sm font-semibold mb-2">Update Status</p>
            <div className="flex flex-wrap gap-2 mb-3">
              {allStatuses.map((s) => (
                <button
                  key={s}
                  onClick={() => statusMutation.mutate(s)}
                  disabled={statusMutation.isPending}
                  className={`px-4 py-2 rounded-lg border-[1.5px] text-xs font-semibold transition-colors ${
                    request.status === s
                      ? 'bg-primary text-white border-primary'
                      : 'border-border text-text-secondary hover:border-primary hover:text-primary'
                  }`}
                >
                  {s.replace('_', ' ')}
                </button>
              ))}
            </div>
            {statusMutation.isError && (
              <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg border border-red-200 mb-3">
                <AlertTriangle size={13} className="shrink-0" />
                <span>
                  {(statusMutation.error as { response?: { data?: { message?: string } } })?.response?.data?.message
                    ?? 'Status update failed. This transition may not be permitted.'}
                </span>
              </div>
            )}
            {/* Resolution notes editor */}
            <div className="mt-2">
              <label className="flex items-center gap-1.5 text-xs font-semibold text-text-secondary mb-1.5">
                <FileEdit size={13} /> Resolution Notes
                <span className="font-normal text-text-muted">(saved when setting status to Resolved)</span>
              </label>
              <textarea
                value={resolutionNotes}
                onChange={(e) => setResolutionNotes(e.target.value)}
                placeholder={request.resolutionNotes ?? 'Describe how this request was resolved…'}
                rows={3}
                className="w-full px-3.5 py-2.5 border-[1.5px] border-border rounded-lg text-sm text-text focus:border-primary outline-none resize-none"
              />
            </div>
          </div>

          {/* Manual priority override */}
          {canPriority && (
            <div>
              <p className="text-sm font-semibold mb-1 flex items-center gap-2">
                <Flag size={14} /> Priority Override
                {request.manualPriority && (
                  <span className="text-[11px] text-amber-600 font-normal">
                    (AI suggested: {request.aiPriority ?? '—'}, currently overridden)
                  </span>
                )}
              </p>
              <div className="flex flex-wrap gap-2">
                {allPriorities.map((p) => (
                  <button
                    key={p}
                    onClick={() => priorityMutation.mutate(p)}
                    disabled={priorityMutation.isPending}
                    className={`px-4 py-2 rounded-lg border-[1.5px] text-xs font-semibold transition-colors ${
                      effectivePriority === p && request.manualPriority
                        ? 'bg-amber-500 text-white border-amber-500'
                        : effectivePriority === p
                          ? 'bg-primary text-white border-primary'
                          : 'border-border text-text-secondary hover:border-primary hover:text-primary'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-text-muted mt-1.5">
                Selecting a priority overrides the AI prediction. Amber = manual override active.
              </p>
            </div>
          )}

          {/* Smart technician assignment */}
          {canAssign && !isResolved && !isCancelled && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold flex items-center gap-2">
                  <UserCog size={14} /> Assign Technician
                </p>
                <button
                  type="button"
                  onClick={() => setShowRecommendations((v) => !v)}
                  className="flex items-center gap-1.5 text-xs text-primary font-medium hover:underline"
                >
                  <Zap size={12} />
                  {showRecommendations ? 'Hide' : 'Show'} AI Recommendations
                </button>
              </div>

              {showRecommendations && (
                <div className="mb-3">
                  {recLoading ? (
                    <div className="flex items-center gap-2 text-xs text-text-muted py-3">
                      <Spinner /> Ranking technicians...
                    </div>
                  ) : recommendations.length === 0 ? (
                    <p className="text-xs text-text-muted py-2">No technicians available.</p>
                  ) : (
                    <div className="space-y-2">
                      {recommendations.map((rec, idx) => (
                        <div key={rec.id}
                          className="flex items-start justify-between p-3 border border-border rounded-lg hover:border-primary/40 transition-colors bg-surface-alt/50"
                        >
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs font-bold text-primary">#{idx + 1}</span>
                              <span className="text-sm font-semibold text-text">{rec.fullName}</span>
                              {rec.isPursuing && (
                                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 border border-blue-200">
                                  Pursuing
                                </span>
                              )}
                              <div className="flex items-center gap-1 ml-auto mr-3">
                                <div className="w-20 h-1.5 bg-border rounded-full overflow-hidden">
                                  <div
                                    className={`h-full rounded-full transition-all ${
                                      rec.matchScore >= 70 ? 'bg-green-500' :
                                      rec.matchScore >= 40 ? 'bg-amber-500' : 'bg-red-400'
                                    }`}
                                    style={{ width: `${rec.matchScore}%` }}
                                  />
                                </div>
                                <span className="text-[11px] font-semibold text-text-secondary whitespace-nowrap">
                                  {rec.matchScore}/100
                                </span>
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-2 text-[11px] text-text-muted mb-1.5">
                              {rec.specialization && <span>🔧 {rec.specialization}</span>}
                              <span>📋 {rec.currentWorkload}/{rec.maxWorkload} tasks</span>
                              {rec.rating && (
                                <span className="flex items-center gap-0.5">
                                  <Star size={11} className="text-amber-400 fill-amber-400" />
                                  {rec.rating}
                                </span>
                              )}
                              <span>{rec.totalResolved} resolved</span>
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {rec.matchReasons.map((reason, i) => (
                                <span key={i} className="text-[10px] px-2 py-0.5 bg-primary-light text-primary rounded-full">
                                  {reason}
                                </span>
                              ))}
                            </div>
                          </div>
                          <button
                            onClick={() => assignMutation.mutate({ technicianUserId: rec.userId, rank: idx + 1 })}
                            disabled={assignMutation.isPending || request.technicianId === rec.userId}
                            className={`ml-3 px-3 py-1.5 rounded-lg border text-xs font-semibold whitespace-nowrap transition-colors ${
                              request.technicianId === rec.userId
                                ? 'bg-primary text-white border-primary cursor-default'
                                : 'border-primary text-primary hover:bg-primary hover:text-white disabled:opacity-50'
                            }`}
                          >
                            {request.technicianId === rec.userId ? 'Assigned' : 'Assign'}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {assignMutation.isSuccess && (
                <p className="text-xs text-green-600 mt-1">Technician assigned and notified.</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Attachments ── */}
      {request.attachments && request.attachments.length > 0 && (
        <div className="bg-white rounded-xl border border-border p-5 shadow-sm mb-4">
          <p className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Paperclip size={16} /> Attachments
          </p>
          <div className="space-y-2">
            {request.attachments.map((a) => {
              const isImage = a.fileType?.startsWith('image/') ||
                              /\.(jpg|jpeg|png|gif|webp)$/i.test(a.fileName ?? '')
              const viewUrl = fileUrl(a.filePath)
              const dlUrl   = fileUrl(a.filePath, true)
              return (
                <div key={a.id} className="flex items-center gap-3 p-3 bg-surface-alt rounded-lg">
                  {isImage ? (
                    <button
                      type="button"
                      onClick={() => setLightboxSrc(viewUrl)}
                      title="Click to view full size"
                      className="flex-shrink-0 w-14 h-14 rounded-lg overflow-hidden border-2 border-border hover:border-primary transition-colors"
                    >
                      <img
                        src={viewUrl}
                        alt={a.fileName}
                        className="w-full h-full object-cover"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                      />
                    </button>
                  ) : (
                    <div className="flex-shrink-0 w-14 h-14 rounded-lg border-2 border-border bg-white flex items-center justify-center">
                      <Paperclip size={20} className="text-text-muted" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-text truncate">{a.fileName}</p>
                    {a.fileSize && (
                      <p className="text-[11px] text-text-muted mt-0.5">
                        {(a.fileSize / 1024).toFixed(1)} KB
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {isImage && (
                      <button
                        type="button"
                        onClick={() => setLightboxSrc(viewUrl)}
                        title="View photo"
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-semibold text-text-secondary hover:border-primary hover:text-primary hover:bg-primary-light transition-colors"
                      >
                        <Eye size={13} /> View
                      </button>
                    )}
                    <a
                      href={dlUrl}
                      download={a.fileName}
                      title="Download file"
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-primary text-xs font-semibold text-primary hover:bg-primary hover:text-white transition-colors"
                    >
                      <Download size={13} /> Download
                    </a>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Activity Log ── */}
      <div className="bg-white rounded-xl border border-border shadow-sm mb-4">
        <button
          onClick={() => setShowActivityLog((v) => !v)}
          className="w-full flex items-center justify-between px-5 py-4 hover:bg-surface-alt/50 transition-colors"
        >
          <span className="flex items-center gap-2 text-sm font-semibold">
            <History size={15} className="text-text-muted" /> Activity Log
          </span>
          {showActivityLog ? <ChevronUp size={15} className="text-text-muted" /> : <ChevronDown size={15} className="text-text-muted" />}
        </button>

        {showActivityLog && (
          <div className="px-5 pb-5">
            {activityLog.length === 0 ? (
              <p className="text-xs text-text-muted py-3 text-center">No activity recorded yet.</p>
            ) : (
              <ol className="relative border-l border-border ml-2 space-y-4">
                {activityLog.map((entry) => {
                  const actionColors: Record<string, string> = {
                    REQUEST_CREATED:    'bg-green-100 text-green-700',
                    STATUS_CHANGED:     'bg-blue-100 text-blue-700',
                    TECHNICIAN_ASSIGNED:'bg-purple-100 text-purple-700',
                    PRIORITY_OVERRIDDEN:'bg-amber-100 text-amber-700',
                    REQUEST_CANCELLED:  'bg-red-100 text-red-700',
                  }
                  const colorClass = actionColors[entry.action] ?? 'bg-gray-100 text-gray-600'
                  return (
                    <li key={entry.id} className="ml-4">
                      <div className="absolute -left-1.5 w-3 h-3 rounded-full bg-border border-2 border-white" />
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <span className={`inline-block text-[10px] px-2 py-0.5 rounded font-semibold mb-1 ${colorClass}`}>
                            {entry.action.replace(/_/g, ' ')}
                          </span>
                          <p className="text-sm text-text">{entry.description}</p>
                          {(entry.oldValue || entry.newValue) && (
                            <p className="text-xs text-text-muted mt-0.5">
                              {entry.oldValue && <span className="line-through opacity-60 mr-1">{entry.oldValue}</span>}
                              {entry.oldValue && entry.newValue && '→ '}
                              {entry.newValue && <span className="font-medium text-text-secondary">{entry.newValue}</span>}
                            </p>
                          )}
                          <p className="text-[11px] text-text-muted mt-0.5">
                            {entry.actorName} · {entry.actorRole}
                          </p>
                        </div>
                        <span className="text-[10px] text-text-muted whitespace-nowrap shrink-0">
                          {new Date(entry.createdAt).toLocaleString('en-US', {
                            month: 'short', day: 'numeric',
                            hour: '2-digit', minute: '2-digit',
                          })}
                        </span>
                      </div>
                    </li>
                  )
                })}
              </ol>
            )}
          </div>
        )}
      </div>

      {/* ── Internal Comment Thread (Staff, Technician, Admin only) ── */}
      {canComment && (
        <div className="bg-white rounded-xl border border-border shadow-sm mb-4">

          {/* Thread header */}
          <div className="px-5 py-3.5 border-b border-border flex items-center gap-2">
            <MessageSquare size={15} className="text-text-muted" />
            <span className="text-sm font-semibold">
              {role === 'CUSTOMER' ? 'Comments' : 'Internal Thread'}
            </span>
            {role !== 'CUSTOMER' && (
              <span className="text-[11px] text-text-muted ml-0.5">— Staff &amp; Technician only</span>
            )}
            {role === 'CUSTOMER' && (
              <span className="text-[11px] text-text-muted ml-0.5">— Ask questions or add updates</span>
            )}
          </div>

          {/* Message list — fixed height, scrollable */}
          <div className="h-80 overflow-y-auto px-4 py-4 space-y-4">
            {(!request.comments || request.comments.length === 0) ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <MessageSquare size={30} className="text-border mb-2.5" />
                <p className="text-sm font-medium text-text-muted">No messages yet</p>
                <p className="text-xs text-text-muted mt-0.5">
                  {role === 'CUSTOMER'
                    ? 'Have a question? Type it below.'
                    : 'Start the internal conversation below.'}
                </p>
              </div>
            ) : (
              request.comments.map((c) => {
                const isMe        = c.authorId === userId
                const roleLower   = (c.authorRole ?? '').toLowerCase()
                const isEditing   = editingCommentId === c.id
                const isAuthor    = c.authorId === userId
                const canEdit     = isAuthor
                const canDelete   = isAuthor || role === 'STAFF' || role === 'ADMIN'

                // Avatar tint by role
                const avatarCls = isMe
                  ? 'bg-primary text-white'
                  : roleLower === 'staff'
                    ? 'bg-blue-100 text-blue-700 border border-blue-200'
                    : roleLower === 'admin'
                      ? 'bg-slate-200 text-slate-600'
                      : 'bg-violet-100 text-violet-700 border border-violet-200'

                // Bubble tint — own messages go right in primary, others left color-coded
                const bubbleCls = isMe
                  ? 'bg-primary text-white rounded-br-sm'
                  : roleLower === 'staff'
                    ? 'bg-blue-50 text-blue-900 border border-blue-100 rounded-bl-sm'
                    : roleLower === 'admin'
                      ? 'bg-slate-100 text-slate-700 border border-slate-200 rounded-bl-sm'
                      : 'bg-violet-50 text-violet-900 border border-violet-100 rounded-bl-sm'

                const roleLabel =
                  roleLower === 'staff'      ? 'Staff'
                  : roleLower === 'admin'    ? 'Admin'
                  : roleLower === 'technician' ? 'Technician'
                  : c.authorRole ?? ''

                return (
                  <div
                    key={c.id}
                    className={`flex gap-2.5 group ${isMe ? 'flex-row-reverse' : 'flex-row'}`}
                  >
                    {/* Avatar */}
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0 ${avatarCls}`}>
                      {c.authorName?.[0] ?? '?'}
                    </div>

                    {/* Content column */}
                    <div className={`max-w-[72%] flex flex-col gap-0.5 ${isMe ? 'items-end' : 'items-start'}`}>
                      {/* Sender meta */}
                      <div className={`flex items-center gap-1.5 ${isMe ? 'flex-row-reverse' : ''}`}>
                        <span className="text-[11px] font-semibold text-text leading-none">{c.authorName}</span>
                        <span className="text-[10px] text-text-muted">— {roleLabel}</span>
                        <span className="text-[10px] text-text-muted">·</span>
                        <span className="text-[10px] text-text-muted">{timeAgo(c.createdAt)}</span>
                      </div>

                      {/* Bubble or inline editor */}
                      {isEditing ? (
                        <div className="flex gap-2 w-64">
                          <textarea
                            value={editingBody}
                            onChange={(e) => setEditingBody(e.target.value)}
                            rows={2}
                            className="flex-1 px-3 py-2 border border-border rounded-xl text-sm focus:border-primary outline-none resize-none"
                            autoFocus
                          />
                          <div className="flex flex-col gap-1 flex-shrink-0">
                            <button
                              onClick={() => editCommentMutation.mutate({ commentId: c.id, body: editingBody })}
                              disabled={!editingBody.trim() || editCommentMutation.isPending}
                              className="p-1.5 bg-primary text-white rounded-lg hover:bg-primary-dark disabled:opacity-50 transition-colors"
                              title="Save"
                            >
                              <Check size={13} />
                            </button>
                            <button
                              onClick={() => { setEditingCommentId(null); setEditingBody('') }}
                              className="p-1.5 border border-border text-text-muted rounded-lg hover:border-primary hover:text-primary transition-colors"
                              title="Cancel"
                            >
                              <XIcon size={13} />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className={`px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${bubbleCls}`}>
                          {c.body}
                        </div>
                      )}

                      {/* Internal badge + edit/delete (shown on hover via group) */}
                      <div className={`flex items-center gap-1.5 ${isMe ? 'flex-row-reverse' : ''}`}>
                        {c.isInternal && (
                          <span className="text-[9px] font-bold uppercase tracking-wide text-amber-500">
                            Internal
                          </span>
                        )}
                        {!isEditing && (canEdit || canDelete) && (
                          <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            {canEdit && (
                              <button
                                onClick={() => { setEditingCommentId(c.id); setEditingBody(c.body) }}
                                className="p-1 rounded text-text-muted hover:text-primary transition-colors"
                                title="Edit"
                              >
                                <Pencil size={11} />
                              </button>
                            )}
                            {canDelete && (
                              <button
                                onClick={() => deleteCommentMutation.mutate(c.id)}
                                disabled={deleteCommentMutation.isPending}
                                className="p-1 rounded text-text-muted hover:text-red-500 transition-colors disabled:opacity-50"
                                title="Delete"
                              >
                                <Trash2 size={11} />
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })
            )}
            {/* Scroll anchor */}
            <div ref={chatEndRef} />
          </div>

          {/* Message input bar */}
          <div className="px-4 py-3 border-t border-border bg-surface-alt/30 rounded-b-xl">
            <div className="flex items-end gap-2">
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder={role === 'CUSTOMER'
                  ? 'Ask a question or add an update…'
                  : 'Type a message… (Enter to send, Shift+Enter for new line)'}
                rows={1}
                className="flex-1 px-3.5 py-2.5 border-[1.5px] border-border rounded-xl text-sm bg-white focus:border-primary outline-none resize-none"
                style={{ minHeight: '42px', maxHeight: '128px', overflowY: 'auto' }}
                onInput={(e) => {
                  const ta = e.target as HTMLTextAreaElement
                  ta.style.height = 'auto'
                  ta.style.height = Math.min(ta.scrollHeight, 128) + 'px'
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey && comment.trim()) {
                    e.preventDefault()
                    commentMutation.mutate()
                  }
                }}
              />
              {role !== 'CUSTOMER' && (
                <label className="flex items-center gap-1.5 text-xs text-text-muted cursor-pointer whitespace-nowrap pb-2.5 shrink-0">
                  <input
                    type="checkbox"
                    checked={isInternal}
                    onChange={(e) => setIsInternal(e.target.checked)}
                    className="rounded border-border"
                  />
                  Internal
                </label>
              )}
              <button
                onClick={() => commentMutation.mutate()}
                disabled={!comment.trim() || commentMutation.isPending}
                className="p-2.5 bg-primary text-white rounded-xl hover:bg-primary-dark disabled:opacity-50 transition-colors flex-shrink-0 mb-0.5"
                title="Send"
              >
                {commentMutation.isPending
                  ? <Loader2 size={16} className="animate-spin" />
                  : <Send size={16} />}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Cannot-Pursue modal ── */}
      {showCannotPursue && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setShowCannotPursue(false)}
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
                onClick={() => cannotPursueMutation.mutate(cannotPursueReason)}
                disabled={cannotPursueMutation.isPending}
                className="flex items-center gap-1.5 px-4 py-2 bg-red-600 text-white text-xs font-bold rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {cannotPursueMutation.isPending ? <Loader2 size={12} className="animate-spin" /> : <XCircle size={12} />}
                Confirm — Return to Staff
              </button>
              <button
                onClick={() => { setShowCannotPursue(false); setCannotPursueReason('') }}
                className="px-4 py-2 border border-border rounded-lg text-xs text-text-secondary hover:border-primary hover:text-primary transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Image Lightbox ── */}
      {lightboxSrc && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setLightboxSrc(null)}
        >
          <div className="relative max-w-4xl max-h-full" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setLightboxSrc(null)}
              className="absolute -top-3 -right-3 w-7 h-7 rounded-full bg-white flex items-center justify-center shadow-lg hover:bg-gray-100 z-10"
            >
              <XIcon size={15} />
            </button>
            <img
              src={lightboxSrc}
              alt="Attachment preview"
              className="max-w-full max-h-[85vh] rounded-lg shadow-2xl object-contain"
            />
            <a
              href={lightboxSrc + (lightboxSrc.includes('?') ? '&' : '?') + 'download=true'}
              download
              className="absolute bottom-3 right-3 flex items-center gap-1.5 px-3 py-1.5 bg-white/90 backdrop-blur text-primary text-xs font-semibold rounded-lg shadow hover:bg-white transition-colors"
              onClick={(e) => e.stopPropagation()}
            >
              <Download size={13} /> Download
            </a>
          </div>
        </div>
      )}

      {/* ── Cancel Confirmation Modal ── */}
      {showCancelConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <XCircle size={20} className="text-red-600" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-text">Cancel Request?</h3>
                <p className="text-xs text-text-muted mt-0.5">{request.requestCode}</p>
              </div>
            </div>
            <p className="text-sm text-text-secondary mb-5">
              This will permanently cancel your request. This action cannot be undone and the request will no longer be processed.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowCancelConfirm(false)}
                className="flex-1 px-4 py-2.5 border border-border rounded-lg text-sm font-semibold text-text-secondary hover:bg-surface-alt transition-colors"
              >
                Keep Request
              </button>
              <button
                onClick={() => cancelMutation.mutate()}
                disabled={cancelMutation.isPending}
                className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {cancelMutation.isPending ? 'Cancelling…' : 'Yes, Cancel'}
              </button>
            </div>
            {cancelMutation.isError && (
              <p className="text-xs text-red-600 mt-2 text-center">
                {(cancelMutation.error as Error)?.message ?? 'Failed to cancel. Please try again.'}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
