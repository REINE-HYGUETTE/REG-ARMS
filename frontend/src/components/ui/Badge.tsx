import { clsx } from 'clsx'
import type { PriorityLevel, RequestStatus, UserRole } from '@/types'

/* ── Priority ──────────────────────────────────────────── */
const priorityStyles: Record<PriorityLevel, { pill: string; dot: string }> = {
  Critical: { pill: 'bg-red-50    text-red-700    ring-1 ring-red-200',    dot: 'bg-red-500'    },
  High:     { pill: 'bg-orange-50 text-orange-700 ring-1 ring-orange-200', dot: 'bg-orange-500' },
  Medium:   { pill: 'bg-amber-50  text-amber-700  ring-1 ring-amber-200',  dot: 'bg-amber-500'  },
  Low:      { pill: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200', dot: 'bg-emerald-500' },
}

/* ── Status ────────────────────────────────────────────── */
const statusStyles: Record<RequestStatus, { pill: string; dot: string }> = {
  Pending:      { pill: 'bg-amber-50  text-amber-700  ring-1 ring-amber-200',   dot: 'bg-amber-400'  },
  Assigned:     { pill: 'bg-violet-50 text-violet-700 ring-1 ring-violet-200',  dot: 'bg-violet-500' },
  In_Progress:  { pill: 'bg-blue-50   text-blue-700   ring-1 ring-blue-200',    dot: 'bg-blue-500'   },
  Problematic:  { pill: 'bg-orange-50 text-orange-700 ring-1 ring-orange-200',  dot: 'bg-orange-500' },
  Resolved:     { pill: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200', dot: 'bg-emerald-500' },
  Closed:       { pill: 'bg-slate-100 text-slate-600  ring-1 ring-slate-200',   dot: 'bg-slate-400'  },
  Cancelled:    { pill: 'bg-gray-100  text-gray-500   ring-1 ring-gray-200',    dot: 'bg-gray-400'   },
}

/* ── Role ──────────────────────────────────────────────── */
const roleStyles: Record<UserRole, string> = {
  ADMIN:      'bg-amber-50  text-amber-800  ring-1 ring-amber-200',
  STAFF:      'bg-blue-50   text-blue-800   ring-1 ring-blue-200',
  TECHNICIAN: 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200',
  CUSTOMER:   'bg-violet-50 text-violet-800 ring-1 ring-violet-200',
}

const base = 'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap'
const dot  = 'w-1.5 h-1.5 rounded-full shrink-0'

export function PriorityBadge({ priority }: { priority: PriorityLevel }) {
  const s = priorityStyles[priority]
  if (!s) return null
  return (
    <span className={clsx(base, s.pill)}>
      <span className={clsx(dot, s.dot)} />
      {priority}
    </span>
  )
}

export function StatusBadge({ status }: { status: RequestStatus }) {
  const s = statusStyles[status]
  if (!s) return null
  return (
    <span className={clsx(base, s.pill)}>
      <span className={clsx(dot, s.dot)} />
      {status.replace('_', ' ')}
    </span>
  )
}

export function RoleBadge({ role }: { role: UserRole }) {
  return <span className={clsx(base, roleStyles[role])}>{role}</span>
}
