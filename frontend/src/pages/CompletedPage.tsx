import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { CheckCircle, ChevronLeft, ChevronRight } from 'lucide-react'
import api from '@/lib/api'
import { PriorityBadge } from '@/components/ui/Badge'
import Spinner from '@/components/ui/Spinner'
import type { Page, RequestListItem } from '@/types'

const PAGE_SIZE = 20

export default function CompletedPage() {
  const [page, setPage] = useState(0)

  const { data, isLoading } = useQuery({
    queryKey: ['completed-requests', page],
    queryFn: async () => {
      const { data } = await api.get<Page<RequestListItem>>('/requests', {
        params: { status: 'Resolved', size: PAGE_SIZE, page, sort: 'updatedAt,desc' },
      })
      return data
    },
  })

  if (isLoading) return <div className="flex justify-center py-16"><Spinner /></div>

  const items = data?.content ?? []

  return (
    <div className="w-full">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
          <CheckCircle size={20} className="text-emerald-600" />
        </div>
        <div>
          <h2 className="text-[15px] font-bold text-text">Completed Tasks</h2>
          <p className="text-[11px] text-text-muted">{data?.totalElements ?? 0} resolved requests</p>
        </div>
      </div>

      {!items.length ? (
        <div className="bg-white rounded-2xl border border-border/70 p-16 text-center shadow-sm">
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 flex items-center justify-center mx-auto mb-3">
            <CheckCircle size={24} className="text-emerald-500" />
          </div>
          <p className="text-sm font-bold text-text mb-1">No completed tasks yet</p>
          <p className="text-xs text-text-muted">Resolved requests will appear here.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-border/70 shadow-sm overflow-hidden">
          <div className="divide-y divide-border/50">
            {items.map((r) => (
              <Link
                key={r.id}
                to={`/requests/${r.id}`}
                className="flex items-center gap-4 px-5 py-4 hover:bg-surface-alt/60 transition-colors group"
              >
                {/* Resolved indicator */}
                <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
                  <CheckCircle size={15} className="text-emerald-600" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                    <span className="font-mono text-[10px] font-bold text-text-muted bg-surface-alt px-1.5 py-0.5 rounded">
                      {r.requestCode}
                    </span>
                    <PriorityBadge priority={r.finalPriority} />
                  </div>
                  <p className="text-sm font-semibold text-text truncate group-hover:text-primary transition-colors">{r.title}</p>
                  <p className="text-[11px] text-text-muted mt-0.5">
                    {r.district}, {r.province} · {r.categoryName}
                    {r.technicianName && <> · <span className="font-medium">by {r.technicianName}</span></>}
                  </p>
                </div>

                <div className="text-right shrink-0">
                  <div className="text-[11px] text-text-muted">
                    {r.updatedAt
                      ? new Date(r.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                      : '—'}
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 mt-1 inline-block">
                    Resolved
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Pagination */}
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
