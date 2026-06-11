import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { useAuth } from '@/lib/auth'
import MetricCard from '@/components/ui/MetricCard'
import { PriorityBadge, StatusBadge } from '@/components/ui/Badge'
import type { Page, RequestListItem } from '@/types'
import { FileText, Clock, Loader, CheckCircle, ArrowRight, Plus, Zap } from 'lucide-react'
import { Link } from 'react-router-dom'

interface CustomerStats {
  total: number
  pending: number
  inProgress: number
  resolved: number
  closed: number
}

export default function CustomerDashboard() {
  const { fullName } = useAuth()

  const { data: stats } = useQuery({
    queryKey: ['my-stats'],
    queryFn: async () => (await api.get<CustomerStats>('/requests/my-stats')).data,
  })

  const { data } = useQuery({
    queryKey: ['my-requests', { page: 0, size: 6 }],
    queryFn: async () =>
      (await api.get<Page<RequestListItem>>('/requests?size=6&sort=createdAt,desc')).data,
  })

  const requests = data?.content ?? []
  const firstName = fullName?.split(' ')[0] ?? 'there'

  return (
    <div className="space-y-6">

      {/* ── Welcome hero ── */}
      <div className="rounded-2xl p-7 text-white shadow-lg" style={{ background: 'linear-gradient(135deg, #B91C1C 0%, #DC2626 55%, #EF4444 100%)' }}>
        <div className="flex items-center gap-2 mb-3">
          <Zap size={16} style={{ color: '#F5C518' }} />
          <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.65)' }}>Rwanda Energy Group</span>
        </div>
        <h2 className="text-2xl font-bold mb-1">
          Welcome back, <span style={{ color: '#F5C518' }}>{firstName}!</span>
        </h2>
        <p className="text-sm mb-5 max-w-md" style={{ color: 'rgba(255,255,255,0.75)' }}>
          Track your energy service requests and get AI-powered priority handling.
        </p>
        <Link
          to="/submit-request"
          className="inline-flex items-center gap-2 font-bold text-sm px-5 py-2.5 rounded-xl shadow-sm transition-all duration-200"
          style={{ backgroundColor: '#ffffff', color: '#DC2626' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = '#F5C518'; (e.currentTarget as HTMLElement).style.color = '#7F1D1D'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = '#ffffff'; (e.currentTarget as HTMLElement).style.color = '#DC2626'; }}
        >
          <Plus size={16} /> Submit New Request
        </Link>
      </div>

      {/* ── Metrics ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <MetricCard label="Total"       value={stats?.total     ?? 0} icon={<FileText   size={20} />} variant="blue"  />
        <MetricCard label="Pending"     value={stats?.pending   ?? 0} icon={<Clock      size={20} />} variant="amber" />
        <MetricCard label="In Progress" value={stats?.inProgress ?? 0} icon={<Loader    size={20} />} variant="purple"/>
        <MetricCard
          label="Resolved"
          value={(stats?.resolved ?? 0) + (stats?.closed ?? 0)}
          icon={<CheckCircle size={20} />}
          variant="green"
        />
      </div>

      {/* ── Recent Requests ── */}
      <div className="bg-white rounded-2xl border border-border/70 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/70">
          <h3 className="text-sm font-bold text-text">Recent Requests</h3>
          <Link
            to="/my-requests"
            className="flex items-center gap-1 text-[11px] font-bold text-primary hover:text-primary-dark transition-colors"
          >
            View All <ArrowRight size={12} />
          </Link>
        </div>

        <div className="divide-y divide-border/50">
          {requests.length === 0 ? (
            <div className="px-6 py-14 text-center">
              <div className="w-12 h-12 rounded-2xl bg-primary-light flex items-center justify-center mx-auto mb-3">
                <FileText size={20} className="text-primary" />
              </div>
              <p className="text-sm font-semibold text-text mb-1">No requests yet</p>
              <p className="text-xs text-text-muted">Submit your first request to get started.</p>
            </div>
          ) : (
            requests.map((r) => (
              <Link
                key={r.id}
                to={`/requests/${r.id}`}
                className="flex items-center gap-4 px-6 py-4 hover:bg-slate-50 transition-colors group"
              >
                {/* Left color dot */}
                <div className="w-2 h-2 rounded-full shrink-0 bg-primary opacity-40 group-hover:opacity-100 transition-opacity" />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="font-mono text-[11px] font-bold text-primary bg-primary-light px-2 py-0.5 rounded-md">
                      {r.requestCode}
                    </span>
                    <PriorityBadge priority={r.finalPriority} />
                  </div>
                  <div className="text-sm font-semibold text-text truncate group-hover:text-primary transition-colors">
                    {r.title}
                  </div>
                  <div className="text-[11px] text-text-muted mt-0.5">{r.province} · {r.categoryName}</div>
                </div>

                <div className="text-right ml-2 shrink-0 space-y-1">
                  <StatusBadge status={r.status} />
                  <div className="text-[10px] text-text-muted">
                    {new Date(r.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </div>
                </div>
              </Link>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
