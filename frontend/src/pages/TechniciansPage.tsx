import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Wrench, X, ClipboardList, History, User, Check, Tag, MapPin, Gauge, UserPlus, Loader2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import api from '@/lib/api'
import { useAuth } from '@/lib/auth'
import Spinner from '@/components/ui/Spinner'
import { PriorityBadge, StatusBadge } from '@/components/ui/Badge'
import type { Technician, TechnicianRequests } from '@/types'

type Tab = 'profile' | 'active' | 'history'

function WorkloadBar({ current, max }: { current: number; max: number }) {
  const pct = max > 0 ? (current / max) * 100 : 0
  const color = pct > 80 ? '#F43F5E' : pct > 50 ? '#F97316' : '#10B981'
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <span className="text-xs text-text-muted">{current}/{max}</span>
    </div>
  )
}

// ── Set Capacity modal (staff-only) ──────────────────────────────────────────
interface EditModalProps {
  tech: Technician
  onClose: () => void
  onSaved: () => void
}

function SetCapacityModal({ tech, onClose, onSaved }: EditModalProps) {
  const [maxWorkload, setMaxWorkload] = useState(String(tech.maxWorkload))

  const saveMutation = useMutation({
    mutationFn: async () =>
      api.patch(`/technicians/${tech.id}/profile`, { maxWorkload: Number(maxWorkload) }),
    onSuccess: () => { onSaved(); onClose() },
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-50 flex items-center justify-center">
              <Gauge size={15} className="text-amber-600" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-text">Set Capacity</h3>
              <p className="text-[11px] text-text-muted">{tech.fullName}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-surface-alt rounded-md text-text-muted">
            <X size={15} />
          </button>
        </div>

        <div className="p-5">
          <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wide mb-1.5">
            Max Concurrent Tasks
          </label>
          <p className="text-[11px] text-text-muted mb-3">
            How many active requests this technician can handle at the same time. The AI will stop auto-assigning once this limit is reached.
          </p>
          <div className="flex items-center gap-3">
            <input
              type="number"
              min={1}
              max={20}
              value={maxWorkload}
              onChange={(e) => setMaxWorkload(e.target.value)}
              className="w-24 px-3 py-2.5 border-[1.5px] border-border rounded-xl text-sm font-bold text-center focus:border-primary outline-none transition-all"
            />
            <span className="text-xs text-text-muted">tasks max (current: {tech.currentWorkload} active)</span>
          </div>

          {saveMutation.isError && (
            <p className="text-xs text-red-600 mt-3">Failed to save. Please try again.</p>
          )}
        </div>

        <div className="flex gap-3 px-5 py-4 border-t border-border">
          <button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending || !maxWorkload || Number(maxWorkload) < 1}
            className="flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-primary-dark disabled:opacity-50 transition-colors"
          >
            {saveMutation.isPending ? <Spinner /> : <Check size={15} />}
            Save
          </button>
          <button
            onClick={onClose}
            className="px-5 py-2.5 border border-border rounded-lg text-sm text-text-secondary hover:border-primary hover:text-primary transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Create Technician Modal (STAFF + ADMIN) ───────────────────────────────────
interface CreateTechForm {
  firstName: string; lastName: string; email: string
  password: string; phone: string
}
const emptyTechForm: CreateTechForm = { firstName: '', lastName: '', email: '', password: '', phone: '' }

function CreateTechnicianModal({ onClose, onCreated, isStaff }: {
  onClose: () => void
  onCreated: () => void
  isStaff: boolean
}) {
  const [form, setForm] = useState<CreateTechForm>(emptyTechForm)
  const mutation = useMutation({
    mutationFn: async () => api.post('/admin/users', { ...form, role: 'TECHNICIAN' }),
    onSuccess: () => { onCreated(); onClose() },
  })

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-[200] flex items-center justify-center p-6" onClick={onClose}>
      <div className="bg-white rounded-2xl w-[520px] max-w-[95vw] max-h-[90vh] overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between px-6 pt-5 pb-4 border-b border-border/60">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-violet-50 border border-violet-100 flex items-center justify-center">
              <UserPlus size={17} className="text-violet-600" />
            </div>
            <div>
              <h3 className="text-[15px] font-bold text-text">Add Technician</h3>
              {isStaff
                ? <p className="text-[11px] text-text-muted mt-0.5">Technician will be assigned to your district automatically.</p>
                : <p className="text-[11px] text-text-muted mt-0.5">Province &amp; district will be set via Edit after creation.</p>
              }
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-surface-alt rounded-xl text-text-muted">
            <X size={17} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <TechField label="First Name *" value={form.firstName} onChange={(v) => setForm((p) => ({ ...p, firstName: v }))} />
            <TechField label="Last Name *"  value={form.lastName}  onChange={(v) => setForm((p) => ({ ...p, lastName: v }))} />
          </div>
          <TechField label="Email Address *" value={form.email} onChange={(v) => setForm((p) => ({ ...p, email: v }))} type="email" />
          <div className="grid grid-cols-2 gap-3">
            <TechField label="Phone" value={form.phone} onChange={(v) => setForm((p) => ({ ...p, phone: v }))} type="tel" />
            <TechField label="Password (optional)" value={form.password} onChange={(v) => setForm((p) => ({ ...p, password: v }))} type="password" placeholder="Auto-generate" />
          </div>

          <p className="text-[11px] text-text-muted flex items-center gap-1.5 pt-1">
            A welcome email with login credentials will be sent automatically.
          </p>

          {mutation.isError && (
            <p className="text-xs text-red-600 font-medium">
              {(mutation.error as any)?.response?.data?.message ?? 'Failed to create technician. Email may already be in use.'}
            </p>
          )}

          <div className="flex gap-3 pt-2">
            <button
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending || !form.firstName || !form.lastName || !form.email}
              className="flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-primary-dark disabled:opacity-50 shadow-sm transition-colors"
            >
              {mutation.isPending ? <Loader2 size={15} className="animate-spin" /> : <UserPlus size={15} />}
              Create & Send Invite
            </button>
            <button onClick={onClose} className="px-5 py-2.5 border border-border rounded-xl text-sm font-medium text-text-secondary hover:bg-surface-alt transition-colors">
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function TechField({ label, value, onChange, type = 'text', placeholder }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string
}) {
  return (
    <div>
      <label className="block text-[11px] font-bold text-text-muted uppercase tracking-widest mb-1.5">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        type={type}
        placeholder={placeholder}
        className="w-full px-3.5 py-2.5 border-[1.5px] border-border rounded-xl text-sm bg-surface-alt focus:border-primary focus:bg-white focus:ring-2 focus:ring-primary/10 outline-none transition-all"
      />
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function TechniciansPage() {
  const { role } = useAuth()
  const queryClient = useQueryClient()
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [tab, setTab]               = useState<Tab>('profile')
  const [editOpen, setEditOpen]     = useState(false)
  const [createOpen, setCreateOpen] = useState(false)

  const canEdit   = role === 'STAFF' || role === 'ADMIN'
  const isStaff   = role === 'STAFF'

  const { data: technicians = [], isLoading } = useQuery({
    queryKey: ['technicians'],
    queryFn: async () => (await api.get<Technician[]>('/technicians')).data,
  })

  // Derive selected from live data so mutations instantly reflect in the detail panel
  const selected = technicians.find(t => t.id === selectedId) ?? null

  const { data: techRequests, isLoading: reqLoading } = useQuery({
    queryKey: ['technician-requests', selectedId],
    queryFn: async () => (await api.get<TechnicianRequests>(`/technicians/${selectedId}/requests`)).data,
    enabled: !!selectedId,
  })

  const openDetail = (t: Technician) => { setSelectedId(t.id); setTab('profile') }

  if (isLoading) return <div className="flex justify-center py-16"><Spinner /></div>

  return (
    <div className="flex gap-5">
      {/* ── List ── */}
      <div className={`${selected ? 'w-[55%]' : 'w-full'} transition-all`}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Wrench size={20} /> Technicians
            <span className="text-sm font-normal text-text-muted ml-1">({technicians.length})</span>
          </h2>
          {canEdit && (
            <button
              onClick={() => setCreateOpen(true)}
              className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-primary-dark transition-colors shadow-sm"
            >
              <UserPlus size={15} />
              {isStaff ? 'Add Technician' : 'Add Technician'}
            </button>
          )}
        </div>

        <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-surface-alt border-b border-border">
                <th className="text-left px-4 py-3 text-[11px] font-semibold text-text-muted uppercase">Name</th>
                {!selected && <th className="text-left px-4 py-3 text-[11px] font-semibold text-text-muted uppercase">Specialization</th>}
                <th className="text-left px-4 py-3 text-[11px] font-semibold text-text-muted uppercase">Workload</th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold text-text-muted uppercase">Resolved</th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold text-text-muted uppercase">Status</th>
              </tr>
            </thead>
            <tbody>
              {technicians.map((t) => (
                <tr
                  key={t.id}
                  onClick={() => openDetail(t)}
                  className={`border-b border-border last:border-0 cursor-pointer transition-colors ${
                    selected?.id === t.id ? 'bg-primary-light' : 'hover:bg-surface-alt'
                  }`}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-primary-light flex items-center justify-center text-xs font-bold text-primary flex-shrink-0">
                        {t.fullName.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                      </div>
                      <div>
                        <div className="text-sm font-medium">{t.fullName}</div>
                        {selected && <div className="text-[11px] text-text-muted">{t.specialization ?? '—'}</div>}
                        {!selected && <div className="text-[11px] text-text-muted">{t.email}</div>}
                        {t.district && (
                          <div className="flex items-center gap-0.5 mt-0.5">
                            <MapPin size={9} className="text-blue-500" />
                            <span className="text-[10px] text-blue-600 font-medium">{t.district}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  {!selected && <td className="px-4 py-3 text-sm text-text-secondary">{t.specialization ?? '—'}</td>}
                  <td className="px-4 py-3"><WorkloadBar current={t.currentWorkload} max={t.maxWorkload} /></td>
                  <td className="px-4 py-3 text-sm font-semibold text-green-700">{t.totalResolved}</td>
                  <td className="px-4 py-3">
                    {t.isPursuing ? (
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                        Pursuing
                      </span>
                    ) : t.isAvailable ? (
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                        Free
                      </span>
                    ) : (
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                        Unavailable
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Detail Panel ── */}
      {selected && (
        <div className="flex-1 bg-white rounded-xl border border-border shadow-sm overflow-hidden flex flex-col">
          {/* Header */}
          <div className="flex items-start justify-between px-5 py-4 border-b border-border">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-full bg-primary-light flex items-center justify-center text-sm font-bold text-primary">
                {selected.fullName.split(' ').map((n) => n[0]).join('').slice(0, 2)}
              </div>
              <div>
                <div className="text-sm font-bold">{selected.fullName}</div>
                <div className="text-xs text-text-muted">{selected.email}</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {canEdit && (
                <button
                  onClick={() => setEditOpen(true)}
                  className="flex items-center gap-1.5 text-xs font-semibold text-amber-600 hover:bg-amber-50 px-2.5 py-1.5 rounded-lg transition-colors border border-amber-200"
                >
                  <Gauge size={12} /> Set Capacity
                </button>
              )}
              <button onClick={() => setSelectedId(null)} className="p-1.5 hover:bg-surface-alt rounded-md text-text-muted">
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-border px-4">
            {([['profile', <User size={13} />, 'Profile'], ['active', <ClipboardList size={13} />, 'Active Cases'], ['history', <History size={13} />, 'History']] as [Tab, React.ReactNode, string][]).map(([key, icon, label]) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`flex items-center gap-1.5 px-3 py-3 text-xs font-semibold border-b-2 transition-colors ${
                  tab === key ? 'border-primary text-primary' : 'border-transparent text-text-muted hover:text-text'
                }`}
              >
                {icon} {label}
                {key === 'active' && techRequests && (
                  <span className="ml-1 px-1.5 py-0.5 bg-primary text-white rounded-full text-[10px]">{techRequests.active.length}</span>
                )}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {tab === 'profile' && (
              <div className="space-y-4">
                {/* District/Province assignment */}
                {(selected.district || selected.province) && (
                  <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg flex items-start gap-2">
                    <MapPin size={14} className="text-blue-500 mt-0.5 shrink-0" />
                    <div>
                      <div className="text-[11px] text-blue-600 font-bold uppercase tracking-wide mb-0.5">District Assignment</div>
                      <div className="text-sm font-semibold text-blue-800">
                        {[selected.district, selected.province].filter(Boolean).join(' · ')}
                      </div>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  {[
                    ['Employee ID',    selected.employeeId ?? '—'],
                    ['Max Workload',   String(selected.maxWorkload)],
                    ['Total Resolved', String(selected.totalResolved)],
                    ['Rating',         selected.rating ? `${Number(selected.rating).toFixed(1)} / 5` : '—'],
                    ['Status',         selected.isPursuing ? 'Pursuing' : selected.isAvailable ? 'Free' : 'Unavailable'],
                  ].map(([label, value]) => (
                    <div key={label} className="p-3 bg-surface-alt rounded-lg">
                      <div className="text-[11px] text-text-muted font-semibold uppercase tracking-wide mb-1">{label}</div>
                      <div className="text-sm font-medium">{value}</div>
                    </div>
                  ))}
                </div>

                {/* Specialization tags (Item 6) */}
                {(selected.specializationTags ?? []).length > 0 ? (
                  <div className="p-3 bg-surface-alt rounded-lg">
                    <div className="text-[11px] text-text-muted font-semibold uppercase tracking-wide mb-2 flex items-center gap-1.5">
                      <Tag size={10} /> Specialization Tags
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {selected.specializationTags!.map((t) => (
                        <span key={t} className="px-2 py-0.5 bg-primary text-white text-xs rounded-full font-medium">{t}</span>
                      ))}
                    </div>
                  </div>
                ) : selected.specialization ? (
                  <div className="p-3 bg-surface-alt rounded-lg">
                    <div className="text-[11px] text-text-muted font-semibold uppercase tracking-wide mb-1">Specialization</div>
                    <div className="text-sm">{selected.specialization}</div>
                    {canEdit && (
                      <p className="text-[10px] text-amber-600 mt-1.5">
                        ⚠ Using free-text matching — add specialization tags for precise AI matching
                      </p>
                    )}
                  </div>
                ) : canEdit ? (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <p className="text-xs text-amber-700 font-medium">No specialization set — this technician scores 0 pts on the biggest AI matching factor.</p>
                    <p className="text-[11px] text-amber-600 mt-1">The technician can set their specialization tags from their Profile page.</p>
                  </div>
                ) : null}

                {/* Province coverage */}
                {selected.provinceCoverage && selected.provinceCoverage.length > 0 && (
                  <div className="p-3 bg-surface-alt rounded-lg">
                    <div className="text-[11px] text-text-muted font-semibold uppercase tracking-wide mb-2">Province Coverage</div>
                    <div className="flex flex-wrap gap-1.5">
                      {selected.provinceCoverage.map((p) => (
                        <span key={p} className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full font-medium">{p}</span>
                      ))}
                    </div>
                  </div>
                )}

                {/* District coverage (Item 1) */}
                {selected.districtCoverage && selected.districtCoverage.length > 0 && (
                  <div className="p-3 bg-surface-alt rounded-lg">
                    <div className="text-[11px] text-text-muted font-semibold uppercase tracking-wide mb-2">District Coverage</div>
                    <div className="flex flex-wrap gap-1.5">
                      {selected.districtCoverage.map((d) => (
                        <span key={d} className="px-2 py-0.5 bg-blue-50 text-blue-600 border border-blue-200 text-xs rounded-full">{d}</span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Category history (Item 2) */}
                {selected.categoryResolvedCounts && Object.keys(selected.categoryResolvedCounts).length > 0 && (
                  <div className="p-3 bg-surface-alt rounded-lg">
                    <div className="text-[11px] text-text-muted font-semibold uppercase tracking-wide mb-2">Resolution History by Category</div>
                    <div className="space-y-1.5">
                      {Object.entries(selected.categoryResolvedCounts)
                        .sort(([, a], [, b]) => b - a)
                        .map(([cat, count]) => (
                          <div key={cat} className="flex items-center justify-between">
                            <span className="text-xs text-text-secondary">{cat}</span>
                            <span className="text-xs font-semibold text-green-700">{count} resolved</span>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                <div className="p-3 bg-surface-alt rounded-lg">
                  <div className="text-[11px] text-text-muted font-semibold uppercase tracking-wide mb-2">Current Workload</div>
                  <WorkloadBar current={selected.currentWorkload} max={selected.maxWorkload} />
                </div>
              </div>
            )}

            {(tab === 'active' || tab === 'history') && (
              <>
                {reqLoading ? (
                  <div className="flex justify-center py-8"><Spinner /></div>
                ) : (
                  <div className="space-y-2">
                    {(tab === 'active' ? techRequests?.active : techRequests?.history)?.length === 0 ? (
                      <p className="text-xs text-text-muted text-center py-8">
                        {tab === 'active' ? 'No active cases' : 'No resolved cases yet'}
                      </p>
                    ) : (
                      (tab === 'active' ? techRequests?.active : techRequests?.history)?.map((r) => (
                        <Link
                          key={r.id}
                          to={`/requests/${r.id}`}
                          className="block p-3 bg-surface-alt rounded-lg hover:border-primary border border-transparent transition-colors"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-semibold text-text truncate">{r.title}</div>
                              <div className="text-[11px] text-text-muted mt-0.5">{r.requestCode} · {r.categoryName}</div>
                            </div>
                            <div className="flex gap-1.5 flex-shrink-0">
                              <PriorityBadge priority={r.finalPriority} />
                              <StatusBadge status={r.status} />
                            </div>
                          </div>
                          <div className="text-[11px] text-text-muted mt-1.5">{r.province}, {r.district} · {new Date(r.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
                        </Link>
                      ))
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Set Capacity Modal ── */}
      {editOpen && selected && (
        <SetCapacityModal
          tech={selected}
          onClose={() => setEditOpen(false)}
          onSaved={() => {
            queryClient.invalidateQueries({ queryKey: ['technicians'] })
          }}
        />
      )}

      {/* ── Create Technician Modal ── */}
      {createOpen && (
        <CreateTechnicianModal
          isStaff={isStaff}
          onClose={() => setCreateOpen(false)}
          onCreated={() => {
            queryClient.invalidateQueries({ queryKey: ['technicians'] })
          }}
        />
      )}
    </div>
  )
}
