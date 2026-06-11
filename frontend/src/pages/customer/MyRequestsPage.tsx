import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Search, ChevronLeft, ChevronRight, XCircle } from 'lucide-react'
import api from '@/lib/api'
import { PriorityBadge, StatusBadge } from '@/components/ui/Badge'
import Spinner from '@/components/ui/Spinner'
import type { Page, RequestListItem, RequestStatus } from '@/types'

const statusFilters: { label: string; value: string }[] = [
  { label: 'All', value: '' },
  { label: 'Pending', value: 'Pending' },
  { label: 'In Progress', value: 'In_Progress' },
  { label: 'Resolved', value: 'Resolved' },
  { label: 'Closed', value: 'Closed' },
  { label: 'Cancelled', value: 'Cancelled' },
]

export default function MyRequestsPage() {
  const [page, setPage]                           = useState(0)
  const [status, setStatus]                       = useState('')
  const [search, setSearch]                       = useState('')
  const [confirmCancelId, setConfirmCancelId]     = useState<number | null>(null)
  const queryClient                               = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['my-requests', page, status, search],
    queryFn: async () => {
      const params: Record<string, string | number> = { page, size: 10 }
      if (status) params.status = status
      if (search) params.search = search
      const { data } = await api.get<Page<RequestListItem>>('/requests', { params })
      return data
    },
  })

  const cancelMutation = useMutation({
    mutationFn: async (id: number) => {
      await api.post(`/requests/${id}/cancel`)
    },
    onSuccess: () => {
      setConfirmCancelId(null)
      queryClient.invalidateQueries({ queryKey: ['my-requests'] })
      queryClient.invalidateQueries({ queryKey: ['my-stats'] })
    },
  })

  const statusDot: Record<RequestStatus, string> = {
    Pending: 'bg-amber-500',
    In_Progress: 'bg-blue-500',
    Resolved: 'bg-green-600',
    Closed: 'bg-gray-400',
    Cancelled: 'bg-gray-300',
  }

  return (
    <div>
      <div className="mb-5">
        <h2 className="text-lg font-bold">My Requests</h2>
        <p className="text-xs text-text-muted mt-0.5">Track and manage all your service requests</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0) }}
            placeholder="Search requests..."
            className="w-full pl-9 pr-3 py-2.5 border-[1.5px] border-border rounded-lg text-sm bg-white focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none"
          />
        </div>
        <div className="flex gap-1 flex-wrap">
          {statusFilters.map((f) => (
            <button
              key={f.value}
              onClick={() => { setStatus(f.value); setPage(0) }}
              className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors ${
                status === f.value
                  ? 'bg-primary text-white'
                  : 'bg-white border border-border text-text-secondary hover:border-primary hover:text-primary'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Request Cards */}
      {isLoading ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : !data?.content.length ? (
        <div className="text-center py-16 text-text-muted">
          <p className="text-sm">No requests found.</p>
          <Link to="/submit-request" className="text-primary text-sm font-semibold mt-2 inline-block">
            Submit your first request
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {data.content.map((r) => (
            <div
              key={r.id}
              className="flex items-start gap-4 bg-white rounded-xl border border-border p-4 shadow-sm hover:border-primary hover:shadow-md transition-all"
            >
              <div className={`w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0 ${statusDot[r.status]}`} />
              <Link to={`/requests/${r.id}`} className="flex-1 min-w-0">
                <h4 className="text-sm font-semibold text-text mb-1 truncate">{r.title}</h4>
                <p className="text-xs text-text-muted mb-2">
                  {r.district}, {r.province} · {r.categoryName}
                </p>
                <div className="flex flex-wrap gap-2">
                  <PriorityBadge priority={r.finalPriority} />
                  <StatusBadge status={r.status} />
                  {r.technicianName && (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium bg-surface-alt text-text-muted border border-border">
                      {r.technicianName}
                    </span>
                  )}
                </div>
              </Link>
              <div className="text-right flex-shrink-0 flex flex-col items-end gap-2">
                <div>
                  <div className="text-[11px] text-text-muted">
                    {new Date(r.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </div>
                  <code className="text-[10px] text-text-muted block mt-1">{r.requestCode}</code>
                </div>
                {/* Cancel button — only for Pending requests */}
                {r.status === 'Pending' && (
                  <button
                    onClick={(e) => { e.preventDefault(); setConfirmCancelId(r.id) }}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border border-red-200 text-red-500 text-[11px] font-semibold hover:bg-red-50 transition-colors"
                  >
                    <XCircle size={11} /> Cancel
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-between mt-5">
          <p className="text-xs text-text-muted">
            Page {data.number + 1} of {data.totalPages} ({data.totalElements} total)
          </p>
          <div className="flex gap-2">
            <button
              disabled={data.first}
              onClick={() => setPage((p) => p - 1)}
              className="p-2 border border-border rounded-lg disabled:opacity-30 hover:border-primary transition-colors"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              disabled={data.last}
              onClick={() => setPage((p) => p + 1)}
              className="p-2 border border-border rounded-lg disabled:opacity-30 hover:border-primary transition-colors"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Cancel confirmation modal */}
      {confirmCancelId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <XCircle size={20} className="text-red-600" />
              </div>
              <div>
                <p className="font-semibold text-text text-sm">Cancel this request?</p>
                <p className="text-xs text-text-muted mt-0.5">
                  This action cannot be undone.
                </p>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => setConfirmCancelId(null)}
                disabled={cancelMutation.isPending}
                className="flex-1 px-4 py-2.5 border border-border rounded-lg text-sm font-semibold text-text-secondary hover:bg-surface-alt transition-colors"
              >
                Keep Request
              </button>
              <button
                onClick={() => cancelMutation.mutate(confirmCancelId)}
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
