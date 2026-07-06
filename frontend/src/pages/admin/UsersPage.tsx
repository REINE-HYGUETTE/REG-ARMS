import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  UserPlus, Search, X, Loader2, Pencil, Trash2, Send,
  CheckCircle2, XCircle, Clock, ShieldCheck, ToggleLeft, ToggleRight,
  Users,
} from 'lucide-react'
import api from '@/lib/api'
import { useAuth } from '@/lib/auth'
import Spinner from '@/components/ui/Spinner'
import LocationSelector, { type LocationValue } from '@/components/ui/LocationSelector'
import type { User, UserRole } from '@/types'

const roles: UserRole[] = ['ADMIN', 'STAFF', 'TECHNICIAN', 'CUSTOMER']

const emptyLocation: LocationValue = { province: '', district: '', sector: '', cell: '', village: '' }

type CreateForm = {
  firstName: string; lastName: string; email: string
  password: string; phone: string; role: UserRole
  province: string; district: string
}
const emptyCreate: CreateForm = {
  firstName: '', lastName: '', email: '', password: '', phone: '', role: 'TECHNICIAN',
  province: '', district: '',
}

function avatarInitials(u: User) {
  return `${u.firstName[0]}${u.lastName[0]}`.toUpperCase()
}

// Avatar initials background colors
const roleColors: Record<UserRole, string> = {
  ADMIN:      'bg-red-100 text-red-700',
  STAFF:      'bg-blue-100 text-blue-700',
  TECHNICIAN: 'bg-violet-100 text-violet-700',
  CUSTOMER:   'bg-emerald-100 text-emerald-700',
}

// Inline role text color (minimal, no badge)
const roleTextColor: Record<UserRole, string> = {
  ADMIN:      'text-red-600',
  STAFF:      'text-blue-600',
  TECHNICIAN: 'text-violet-600',
  CUSTOMER:   'text-emerald-600',
}

const roleDot: Record<UserRole, string> = {
  ADMIN:      'bg-red-500',
  STAFF:      'bg-blue-500',
  TECHNICIAN: 'bg-violet-500',
  CUSTOMER:   'bg-emerald-500',
}

export default function UsersPage() {
  const queryClient = useQueryClient()
  const { userId: currentUserId } = useAuth()
  const [search, setSearch]         = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [editTarget, setEditTarget] = useState<User | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null)
  const [newUser, setNewUser]       = useState<CreateForm>(emptyCreate)
  const [editBasic, setEditBasic]   = useState({ firstName: '', lastName: '', email: '', phone: '', role: 'CUSTOMER' as UserRole })
  const [editLocation, setEditLocation] = useState<LocationValue>(emptyLocation)
  const [roleFilter, setRoleFilter] = useState<string>('')

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => {
      const { data } = await api.get<User[]>('/admin/users')
      return data
    },
  })

  const toggleMutation   = useMutation({ mutationFn: async (id: number) => api.patch(`/admin/users/${id}/toggle-status`),  onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-users'] }) })
  const createMutation   = useMutation({ mutationFn: async () => api.post('/admin/users', { email: newUser.email, role: newUser.role, province: newUser.province, district: newUser.district }), onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-users'] }); setShowCreate(false); setNewUser(emptyCreate) } })
  const editMutation     = useMutation({ mutationFn: async () => api.put(`/admin/users/${editTarget!.id}`, { ...editBasic, province: editLocation.province, district: editLocation.district, sector: editLocation.sector, cell: editLocation.cell, village: editLocation.village }), onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-users'] }); setEditTarget(null) } })
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const deleteMutation   = useMutation({
    mutationFn: async (id: number) => api.delete(`/admin/users/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-users'] }); setDeleteTarget(null); setDeleteError(null) },
    onError: (err: any) => {
      const msg = err?.response?.data?.message ?? err?.response?.data ?? 'Failed to delete user.'
      setDeleteError(typeof msg === 'string' ? msg : 'Failed to delete user.')
    },
  })
  const resendMutation   = useMutation({ mutationFn: async (id: number) => api.post(`/admin/users/${id}/resend-invite`),  onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-users'] }) })
  const approveMutation  = useMutation({ mutationFn: async (id: number) => api.patch(`/admin/users/${id}/approve`),        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-users'] }) })
  const rejectMutation   = useMutation({ mutationFn: async (id: number) => api.delete(`/admin/users/${id}/reject`),       onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-users'] }) })

  const openEdit = (u: User) => {
    setEditBasic({ firstName: u.firstName, lastName: u.lastName, email: u.email, phone: u.phone ?? '', role: u.role })
    setEditLocation({ province: u.province ?? '', district: u.district ?? '', sector: u.sector ?? '', cell: u.cell ?? '', village: u.village ?? '' })
    setEditTarget(u)
  }

  const pending  = users.filter((u) => !u.isActive && !u.lastLogin)
  const filtered = users
    .filter((u) => u.isActive || u.lastLogin)
    .filter((u) => !roleFilter || u.role === roleFilter)
    .filter((u) => !search || `${u.firstName} ${u.lastName} ${u.email}`.toLowerCase().includes(search.toLowerCase()))

  // Role counts for filter pills
  const roleCounts = roles.reduce<Record<string, number>>((acc, r) => {
    acc[r] = users.filter((u) => (u.isActive || u.lastLogin) && u.role === r).length
    return acc
  }, {})

  if (isLoading) return <div className="flex justify-center py-16"><Spinner /></div>

  return (
    <div>

      {/* ── Pending Approvals ── */}
      {pending.length > 0 && (
        <div className="mb-6 bg-white border border-amber-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="flex items-center gap-2 px-5 py-3.5 border-b border-amber-100 bg-amber-50">
            <div className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center">
              <Clock size={14} className="text-amber-600" />
            </div>
            <span className="text-sm font-bold text-amber-900">Pending Approvals</span>
            <span className="ml-1 bg-amber-500 text-white text-[10px] font-bold rounded-full px-2 py-0.5 leading-none">{pending.length}</span>
            <span className="text-[11px] text-amber-700 ml-1">Self-registered customers awaiting review</span>
          </div>
          <div className="divide-y divide-amber-50">
            {pending.map((u) => (
              <div key={u.id} className="flex items-center justify-between px-5 py-3.5 flex-wrap gap-3 hover:bg-amber-50/50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center text-xs font-bold text-amber-700">
                    {avatarInitials(u)}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-text">{u.firstName} {u.lastName}</div>
                    <div className="text-xs text-text-muted">{u.email}{u.province ? ` · ${u.province}` : ''}</div>
                    <div className="text-[10px] text-text-muted mt-0.5">
                      Registered {new Date(u.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => approveMutation.mutate(u.id)}
                    disabled={approveMutation.isPending}
                    className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 disabled:opacity-50 transition-colors shadow-sm"
                  >
                    {approveMutation.isPending ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
                    Approve
                  </button>
                  <button
                    onClick={() => rejectMutation.mutate(u.id)}
                    disabled={rejectMutation.isPending}
                    className="flex items-center gap-1.5 px-3.5 py-2 bg-white border border-red-200 text-red-600 rounded-xl text-xs font-bold hover:bg-red-50 disabled:opacity-50 transition-colors"
                  >
                    {rejectMutation.isPending ? <Loader2 size={13} className="animate-spin" /> : <XCircle size={13} />}
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-primary-light flex items-center justify-center">
            <Users size={18} className="text-primary" />
          </div>
          <div>
            <h2 className="text-[15px] font-bold text-text">Users & Roles</h2>
            <p className="text-[11px] text-text-muted">{filtered.length} of {users.filter(u => u.isActive || u.lastLogin).length} users shown</p>
          </div>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 bg-primary text-white px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-primary-dark transition-colors shadow-sm"
        >
          <UserPlus size={16} /> Invite User
        </button>
      </div>

      {/* ── Filters ── */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or email…"
            className="w-full pl-9 pr-3 py-2.5 border-[1.5px] border-border rounded-xl text-sm bg-white focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none"
          />
        </div>
        {/* Role filter pills */}
        <div className="flex gap-1.5 flex-wrap">
          <button
            onClick={() => setRoleFilter('')}
            className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors border ${
              roleFilter === '' ? 'bg-primary text-white border-primary' : 'bg-white border-border text-text-muted hover:border-primary hover:text-primary'
            }`}
          >
            All
          </button>
          {roles.map((r) => (
            <button
              key={r}
              onClick={() => setRoleFilter(roleFilter === r ? '' : r)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors border ${
                roleFilter === r
                  ? `${roleColors[r]} border-current`
                  : 'bg-white border-border text-text-muted hover:border-primary hover:text-primary'
              }`}
            >
              {r} <span className="opacity-60">({roleCounts[r] ?? 0})</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Table ── */}
      <div className="bg-white rounded-2xl border border-border/70 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-5 py-3.5 text-[10px] font-bold text-text-muted uppercase tracking-widest bg-surface-alt">User</th>
                <th className="text-left px-5 py-3.5 text-[10px] font-bold text-text-muted uppercase tracking-widest bg-surface-alt">Role</th>
                <th className="text-left px-5 py-3.5 text-[10px] font-bold text-text-muted uppercase tracking-widest bg-surface-alt">Status</th>
                <th className="text-left px-5 py-3.5 text-[10px] font-bold text-text-muted uppercase tracking-widest bg-surface-alt hidden md:table-cell">Joined</th>
                <th className="text-right px-5 py-3.5 text-[10px] font-bold text-text-muted uppercase tracking-widest bg-surface-alt">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-sm text-text-muted">No users found matching your filters.</td>
                </tr>
              ) : (
                filtered.map((u) => {
                  const isSelf = u.id === currentUserId
                  const isInvited = u.isActive && !u.lastLogin
                  return (
                    <tr key={u.id} className={`hover:bg-surface-alt/60 transition-colors ${isSelf ? 'bg-primary-light/30' : ''}`}>
                      {/* User cell */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold shrink-0 ${roleColors[u.role]}`}>
                            {avatarInitials(u)}
                          </div>
                          <div>
                            <div className="text-sm font-semibold text-text flex items-center gap-1.5">
                              {u.firstName} {u.lastName}
                              {isSelf && <span className="text-[9px] font-bold bg-primary-light text-primary px-1.5 py-0.5 rounded-full">You</span>}
                            </div>
                            <div className="text-[11px] text-text-muted">{u.email}</div>
                          </div>
                        </div>
                      </td>

                      {/* Role cell */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-1.5">
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${roleDot[u.role]}`} />
                          <span className={`text-xs font-semibold ${roleTextColor[u.role]}`}>
                            {u.role.charAt(0) + u.role.slice(1).toLowerCase()}
                          </span>
                        </div>
                        {/* Show district assignment for staff */}
                        {u.role === 'STAFF' && u.district && (
                          <div className="flex items-center gap-1 mt-1">
                            <span className="text-[10px] text-text-muted">📍 {u.district}{u.province ? `, ${u.province}` : ''}</span>
                          </div>
                        )}
                      </td>

                      {/* Status cell */}
                      <td className="px-5 py-3.5">
                        <div className="flex flex-col gap-1">
                          <span className={`flex items-center gap-1.5 text-xs font-medium ${u.isActive ? 'text-emerald-600' : 'text-red-500'}`}>
                            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${u.isActive ? 'bg-emerald-500' : 'bg-red-400'}`} />
                            {u.isActive ? 'Active' : 'Inactive'}
                          </span>
                          {isInvited && (
                            <span className="flex items-center gap-1.5 text-xs font-medium text-amber-500">
                              <Send size={10} /> Invite pending
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Joined cell */}
                      <td className="px-5 py-3.5 text-xs text-text-muted hidden md:table-cell">
                        {new Date(u.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </td>

                      {/* Actions cell */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Edit */}
                          <button
                            onClick={() => openEdit(u)}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-text-secondary hover:bg-blue-50 hover:text-blue-700 transition-colors border border-transparent hover:border-blue-200"
                            title="Edit user"
                          >
                            <Pencil size={13} /> Edit
                          </button>

                          {/* Resend invite */}
                          {isInvited && !isSelf && (
                            <button
                              onClick={() => resendMutation.mutate(u.id)}
                              disabled={resendMutation.isPending}
                              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-amber-600 hover:bg-amber-50 transition-colors border border-transparent hover:border-amber-200 disabled:opacity-50"
                              title="Resend invite email"
                            >
                              {resendMutation.isPending ? <Loader2 size={12} className="animate-spin" /> : <Send size={13} />} Resend
                            </button>
                          )}

                          {/* Toggle active */}
                          {!isSelf && (
                            <button
                              onClick={() => toggleMutation.mutate(u.id)}
                              disabled={toggleMutation.isPending}
                              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors border border-transparent disabled:opacity-50 ${
                                u.isActive
                                  ? 'text-text-muted hover:bg-red-50 hover:text-red-600 hover:border-red-200'
                                  : 'text-emerald-600 hover:bg-emerald-50 hover:border-emerald-200'
                              }`}
                              title={u.isActive ? 'Deactivate' : 'Activate'}
                            >
                              {toggleMutation.isPending
                                ? <Loader2 size={13} className="animate-spin" />
                                : u.isActive
                                  ? <ToggleRight size={15} className="text-emerald-600" />
                                  : <ToggleLeft size={15} />}
                              {u.isActive ? 'Deactivate' : 'Activate'}
                            </button>
                          )}

                          {/* Delete */}
                          {!isSelf && (
                            <button
                              onClick={() => setDeleteTarget(u)}
                              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-text-muted hover:bg-red-50 hover:text-red-600 transition-colors border border-transparent hover:border-red-200"
                              title="Delete user"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Invite User Modal ── */}
      {showCreate && (
        <Modal
          title="Invite a User"
          subtitle="Enter an email and role. They'll receive a link to set their own name and password."
          icon={<Send size={18} className="text-primary" />}
          onClose={() => setShowCreate(false)}
        >
          <div className="grid grid-cols-1 gap-4">
            <Field label="Email Address" value={newUser.email} onChange={(v) => setNewUser((p) => ({ ...p, email: v }))} type="email" placeholder="person@example.com" />
            <RoleSelect value={newUser.role} onChange={(v) => setNewUser((p) => ({ ...p, role: v, province: '', district: '' }))} />
          </div>

          {/* Province + District required for Staff accounts */}
          {newUser.role === 'STAFF' && (
            <div className="mt-4 pt-4 border-t border-border/60">
              <p className="text-xs font-bold text-text-secondary uppercase tracking-wide mb-1">
                District Assignment <span className="text-red-500">*</span>
              </p>
              <p className="text-[11px] text-text-muted mb-3">
                This staff member will only manage requests and technicians within this district.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <Field
                  label="Province *"
                  value={newUser.province}
                  onChange={(v) => setNewUser((p) => ({ ...p, province: v }))}
                  placeholder="e.g. Kigali City"
                />
                <Field
                  label="District *"
                  value={newUser.district}
                  onChange={(v) => setNewUser((p) => ({ ...p, district: v }))}
                  placeholder="e.g. Gasabo"
                />
              </div>
            </div>
          )}

          <p className="text-[11px] text-text-muted mt-3 flex items-center gap-1.5">
            <ShieldCheck size={11} className="text-text-muted" />
            An invitation email is sent with a secure link (valid 7 days). The user sets their own name and password — no temporary passwords.
          </p>
          <div className="flex gap-3 mt-5">
            <button
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending || !newUser.email || (newUser.role === 'STAFF' && (!newUser.province || !newUser.district))}
              className="flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-primary-dark disabled:opacity-50 shadow-sm transition-colors"
            >
              {createMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              Send Invitation
            </button>
            <button onClick={() => setShowCreate(false)} className="px-5 py-2.5 border border-border rounded-xl text-sm font-medium text-text-secondary hover:bg-surface-alt transition-colors">Cancel</button>
          </div>
          {createMutation.isError && (
            <p className="text-xs text-red-600 mt-3 font-medium">
              {(createMutation.error as any)?.response?.data?.message ?? 'Failed to send invitation. Email may already be in use.'}
            </p>
          )}
          {createMutation.isSuccess && (
            <p className="text-xs text-emerald-600 mt-3 font-medium flex items-center gap-1"><CheckCircle2 size={12} /> Invitation sent.</p>
          )}
        </Modal>
      )}

      {/* ── Edit User Modal ── */}
      {editTarget && (
        <Modal
          title={`Edit — ${editTarget.firstName} ${editTarget.lastName}`}
          subtitle="Update account details, role, and location."
          icon={<Pencil size={18} className="text-blue-600" />}
          onClose={() => setEditTarget(null)}
        >
          <div className="grid grid-cols-2 gap-4">
            <Field label="First Name" value={editBasic.firstName} onChange={(v) => setEditBasic((p) => ({ ...p, firstName: v }))} />
            <Field label="Last Name"  value={editBasic.lastName}  onChange={(v) => setEditBasic((p) => ({ ...p, lastName: v }))} />
            <div className="col-span-2">
              <Field label="Email Address" value={editBasic.email} onChange={(v) => setEditBasic((p) => ({ ...p, email: v }))} type="email" />
            </div>
            <Field label="Phone" value={editBasic.phone} onChange={(v) => setEditBasic((p) => ({ ...p, phone: v }))} type="tel" />
            <div>
              <RoleSelect value={editBasic.role} onChange={(v) => setEditBasic((p) => ({ ...p, role: v }))} disabled={editTarget.id === currentUserId} />
              {editTarget.id === currentUserId && <p className="text-[11px] text-amber-600 mt-1">You cannot change your own role.</p>}
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-border/60">
            <p className="text-xs font-bold text-text-secondary uppercase tracking-wide mb-3">Location</p>
            <LocationSelector value={editLocation} onChange={setEditLocation} compact />
          </div>

          <div className="flex gap-3 mt-5">
            <button
              onClick={() => editMutation.mutate()}
              disabled={editMutation.isPending}
              className="flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-primary-dark disabled:opacity-50 shadow-sm transition-colors"
            >
              {editMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              Save Changes
            </button>
            <button onClick={() => setEditTarget(null)} className="px-5 py-2.5 border border-border rounded-xl text-sm font-medium text-text-secondary hover:bg-surface-alt transition-colors">Cancel</button>
          </div>
          {editMutation.isError   && <p className="text-xs text-red-600 mt-3 font-medium">Failed to save. Email may already be in use.</p>}
          {editMutation.isSuccess && <p className="text-xs text-emerald-600 mt-3 font-medium flex items-center gap-1"><CheckCircle2 size={12} /> User updated successfully.</p>}
        </Modal>
      )}

      {/* ── Delete Confirmation ── */}
      {deleteTarget && (
        <Modal
          title="Delete User"
          subtitle="This action is permanent and cannot be undone."
          icon={<Trash2 size={18} className="text-red-600" />}
          onClose={() => { setDeleteTarget(null); setDeleteError(null) }}
        >
          <div className="flex flex-col items-center text-center py-3">
            <div className="w-16 h-16 rounded-2xl bg-red-50 border border-red-100 flex items-center justify-center mb-4">
              <Trash2 size={26} className="text-red-500" />
            </div>
            <p className="text-sm text-text mb-1.5">
              Are you sure you want to delete <strong>{deleteTarget.firstName} {deleteTarget.lastName}</strong>?
            </p>
            <p className="text-xs text-text-muted max-w-sm">
              Only users with no requests or activity can be deleted. Users with existing data must be deactivated instead.
            </p>
          </div>
          <div className="flex gap-3 mt-5">
            <button
              onClick={() => { setDeleteError(null); deleteMutation.mutate(deleteTarget.id) }}
              disabled={deleteMutation.isPending}
              className="flex-1 flex items-center justify-center gap-2 bg-red-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-red-700 disabled:opacity-50 transition-colors"
            >
              {deleteMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
              Delete Account
            </button>
            <button onClick={() => { setDeleteTarget(null); setDeleteError(null) }} className="flex-1 px-5 py-2.5 border border-border rounded-xl text-sm font-medium text-text-secondary hover:bg-surface-alt transition-colors">Cancel</button>
          </div>
          {deleteError && (
            <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-xl">
              <p className="text-xs text-red-700 font-semibold text-center">{deleteError}</p>
            </div>
          )}
        </Modal>
      )}
    </div>
  )
}

/* ── Save icon (used in edit modal) ── */
function Save({ size, className }: { size: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
      <polyline points="17 21 17 13 7 13 7 21" />
      <polyline points="7 3 7 8 15 8" />
    </svg>
  )
}

/* ── Shared sub-components ── */
function Modal({ title, subtitle, icon, onClose, children }: {
  title: string
  subtitle?: string
  icon?: React.ReactNode
  onClose: () => void
  children: React.ReactNode
}) {
  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-[200] flex items-center justify-center p-6" onClick={onClose}>
      <div className="bg-white rounded-2xl w-[580px] max-w-[95vw] max-h-[90vh] overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between px-7 pt-6 pb-5 border-b border-border/60">
          <div className="flex items-start gap-3">
            {icon && (
              <div className="w-9 h-9 rounded-xl bg-surface-alt border border-border flex items-center justify-center shrink-0">
                {icon}
              </div>
            )}
            <div>
              <h3 className="text-[15px] font-bold text-text">{title}</h3>
              {subtitle && <p className="text-[11px] text-text-muted mt-0.5">{subtitle}</p>}
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-surface-alt rounded-xl text-text-muted hover:text-text transition-colors">
            <X size={18} />
          </button>
        </div>
        <div className="px-7 py-6">{children}</div>
      </div>
    </div>
  )
}

function Field({ label, value, onChange, type = 'text', placeholder }: {
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

function RoleSelect({ value, onChange, disabled }: { value: UserRole; onChange: (v: UserRole) => void; disabled?: boolean }) {
  return (
    <div>
      <label className="block text-[11px] font-bold text-text-muted uppercase tracking-widest mb-1.5">Role</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as UserRole)}
        disabled={disabled}
        className="w-full px-3.5 py-2.5 border-[1.5px] border-border rounded-xl text-sm bg-surface-alt focus:border-primary focus:bg-white outline-none disabled:cursor-not-allowed disabled:opacity-60 transition-all"
      >
        {roles.map((r) => <option key={r} value={r}>{r.charAt(0) + r.slice(1).toLowerCase()}</option>)}
      </select>
    </div>
  )
}
