import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Plus, Pencil, Trash2, X, Loader2, Tag,
  ToggleRight, ToggleLeft, Zap, Search,
  CheckCircle2, Layers,
} from 'lucide-react'
import api from '@/lib/api'
import Spinner from '@/components/ui/Spinner'
import { PriorityBadge } from '@/components/ui/Badge'
import type { Category, PriorityLevel } from '@/types'

const priorities: PriorityLevel[] = ['Low', 'Medium', 'High', 'Critical']

type Form = { name: string; description: string; defaultPriority: PriorityLevel }
const empty: Form = { name: '', description: '', defaultPriority: 'Medium' }

// Color palette for category cards (cycles through)
const CARD_ACCENTS = [
  { bg: 'bg-blue-500',    light: 'bg-blue-50',    text: 'text-blue-600'    },
  { bg: 'bg-violet-500',  light: 'bg-violet-50',  text: 'text-violet-600'  },
  { bg: 'bg-emerald-500', light: 'bg-emerald-50', text: 'text-emerald-600' },
  { bg: 'bg-amber-500',   light: 'bg-amber-50',   text: 'text-amber-600'   },
  { bg: 'bg-rose-500',    light: 'bg-rose-50',    text: 'text-rose-600'    },
  { bg: 'bg-cyan-500',    light: 'bg-cyan-50',    text: 'text-cyan-600'    },
  { bg: 'bg-indigo-500',  light: 'bg-indigo-50',  text: 'text-indigo-600'  },
  { bg: 'bg-teal-500',    light: 'bg-teal-50',    text: 'text-teal-600'    },
]

export default function CategoriesPage() {
  const queryClient = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)
  const [editTarget, setEditTarget] = useState<Category | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null)
  const [form, setForm] = useState<Form>(empty)
  const [search, setSearch] = useState('')
  const [showInactive, setShowInactive] = useState(false)

  const { data: categories = [], isLoading } = useQuery({
    queryKey: ['admin-categories'],
    queryFn: async () => (await api.get<Category[]>('/admin/categories')).data,
  })

  const createMutation = useMutation({
    mutationFn: () => api.post('/admin/categories', form),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-categories'] }); setShowCreate(false); setForm(empty) },
  })

  const editMutation = useMutation({
    mutationFn: () => api.put(`/admin/categories/${editTarget!.id}`, form),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-categories'] }); setEditTarget(null) },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/admin/categories/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-categories'] }); setDeleteTarget(null) },
  })

  const activateMutation = useMutation({
    mutationFn: (id: number) => api.patch(`/admin/categories/${id}/activate`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-categories'] }),
  })

  const openEdit = (c: Category) => {
    setForm({ name: c.name, description: c.description ?? '', defaultPriority: c.defaultPriority })
    setEditTarget(c)
  }

  if (isLoading) return <div className="flex justify-center py-16"><Spinner /></div>

  const active   = categories.filter((c) => c.isActive !== false)
  const inactive = categories.filter((c) => c.isActive === false)

  const displayed = (showInactive ? categories : active)
    .filter((c) => !search || c.name.toLowerCase().includes(search.toLowerCase()) || (c.description ?? '').toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="w-full">

      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary-light flex items-center justify-center">
            <Layers size={20} className="text-primary" />
          </div>
          <div>
            <h2 className="text-[15px] font-bold text-text">Service Categories</h2>
            <p className="text-[11px] text-text-muted">{active.length} active · {inactive.length} inactive</p>
          </div>
        </div>
        <button
          onClick={() => { setForm(empty); setShowCreate(true) }}
          className="flex items-center gap-2 bg-primary text-white px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-primary-dark transition-colors shadow-sm"
        >
          <Plus size={15} /> Add Category
        </button>
      </div>

      {/* ── Stats row ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Total Categories', value: categories.length, icon: <Layers size={16} />, color: 'text-text',       bg: 'bg-surface-alt' },
          { label: 'Active',           value: active.length,      icon: <CheckCircle2 size={16} />, color: 'text-emerald-700', bg: 'bg-emerald-50' },
          { label: 'Inactive',         value: inactive.length,    icon: <ToggleLeft size={16} />, color: 'text-text-muted',  bg: 'bg-surface-alt' },
          { label: 'High / Critical',  value: active.filter(c => c.defaultPriority === 'High' || c.defaultPriority === 'Critical').length, icon: <Zap size={16} />, color: 'text-red-600', bg: 'bg-red-50' },
        ].map(({ label, value, icon, color, bg }) => (
          <div key={label} className="bg-white rounded-2xl border border-border/70 p-4 shadow-sm flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl ${bg} flex items-center justify-center ${color} shrink-0`}>
              {icon}
            </div>
            <div>
              <div className={`text-xl font-bold ${color}`}>{value}</div>
              <div className="text-[10px] text-text-muted font-semibold">{label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Filters ── */}
      <div className="flex items-center gap-3 mb-5">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search categories…"
            className="w-full pl-9 pr-3 py-2 border-[1.5px] border-border rounded-xl text-sm bg-white focus:border-primary outline-none"
          />
        </div>
        <button
          onClick={() => setShowInactive((v) => !v)}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border transition-colors ${
            showInactive
              ? 'bg-primary text-white border-primary'
              : 'bg-white border-border text-text-muted hover:border-primary hover:text-primary'
          }`}
        >
          {showInactive ? <ToggleRight size={13} /> : <ToggleLeft size={13} />}
          {showInactive ? 'Showing all' : 'Show inactive'}
        </button>
      </div>

      {/* ── Card Grid ── */}
      {displayed.length === 0 ? (
        <div className="bg-white rounded-2xl border border-border/70 p-16 text-center shadow-sm">
          <div className="w-14 h-14 rounded-2xl bg-surface-alt flex items-center justify-center mx-auto mb-3">
            <Tag size={24} className="text-text-muted" />
          </div>
          <p className="text-sm font-bold text-text mb-1">No categories found</p>
          <p className="text-xs text-text-muted">
            {search ? 'Try a different search term.' : 'Create your first service category to get started.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {displayed.map((c, i) => {
            const accent = CARD_ACCENTS[i % CARD_ACCENTS.length]
            const isActive = c.isActive !== false
            return (
              <div
                key={c.id}
                className={`bg-white rounded-2xl border shadow-sm overflow-hidden group transition-all duration-200 hover:shadow-md ${
                  isActive ? 'border-border/70 hover:border-border' : 'border-dashed border-border opacity-60'
                }`}
              >
                {/* Color accent top bar */}
                <div className={`h-1.5 w-full ${isActive ? accent.bg : 'bg-gray-200'}`} />

                <div className="p-5">
                  {/* Icon + Status row */}
                  <div className="flex items-start justify-between mb-3">
                    <div className={`w-10 h-10 rounded-xl ${isActive ? accent.light : 'bg-gray-50'} flex items-center justify-center`}>
                      <Tag size={18} className={isActive ? accent.text : 'text-gray-400'} />
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>

                  {/* Name */}
                  <h3 className="text-sm font-bold text-text mb-1 line-clamp-1">{c.name}</h3>

                  {/* Description */}
                  <p className="text-[11px] text-text-muted leading-relaxed line-clamp-2 min-h-[32px] mb-3">
                    {c.description || <span className="italic opacity-60">No description</span>}
                  </p>

                  {/* Priority */}
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Default Priority</span>
                    <PriorityBadge priority={c.defaultPriority} />
                  </div>

                  {/* Divider */}
                  <div className="border-t border-border/50 pt-3 flex items-center gap-1.5">
                    {/* Edit */}
                    <button
                      onClick={() => openEdit(c)}
                      className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs font-semibold text-text-secondary hover:bg-blue-50 hover:text-blue-700 transition-colors border border-transparent hover:border-blue-100"
                    >
                      <Pencil size={12} /> Edit
                    </button>

                    {/* Toggle active/inactive */}
                    {isActive ? (
                      <button
                        onClick={() => setDeleteTarget(c)}
                        className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs font-semibold text-text-muted hover:bg-red-50 hover:text-red-600 transition-colors border border-transparent hover:border-red-100"
                        title="Deactivate"
                      >
                        <ToggleLeft size={13} /> Disable
                      </button>
                    ) : (
                      <button
                        onClick={() => activateMutation.mutate(c.id)}
                        disabled={activateMutation.isPending}
                        className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs font-semibold text-emerald-600 hover:bg-emerald-50 transition-colors border border-transparent hover:border-emerald-100 disabled:opacity-50"
                        title="Re-activate"
                      >
                        {activateMutation.isPending ? <Loader2 size={12} className="animate-spin" /> : <ToggleRight size={13} />}
                        Enable
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}

          {/* Add new card (shortcut) */}
          <button
            onClick={() => { setForm(empty); setShowCreate(true) }}
            className="bg-white rounded-2xl border-2 border-dashed border-border hover:border-primary hover:bg-primary-light/30 transition-all duration-200 min-h-[200px] flex flex-col items-center justify-center gap-3 group"
          >
            <div className="w-12 h-12 rounded-2xl bg-surface-alt group-hover:bg-primary-light flex items-center justify-center transition-colors">
              <Plus size={20} className="text-text-muted group-hover:text-primary transition-colors" />
            </div>
            <span className="text-xs font-bold text-text-muted group-hover:text-primary transition-colors">Add Category</span>
          </button>
        </div>
      )}

      {/* ── Create Modal ── */}
      {showCreate && (
        <CatModal title="Add Category" subtitle="Define a new service category for request classification." icon={<Plus size={16} className="text-primary" />} onClose={() => setShowCreate(false)}>
          <FormFields form={form} setForm={setForm} />
          {createMutation.isError && <p className="text-xs text-red-600 mt-2 font-medium">Failed to create. Name may already exist.</p>}
          <div className="flex gap-3 mt-5">
            <button
              onClick={() => createMutation.mutate()}
              disabled={!form.name || createMutation.isPending}
              className="flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-primary-dark disabled:opacity-50 shadow-sm transition-colors"
            >
              {createMutation.isPending && <Loader2 size={14} className="animate-spin" />} Create Category
            </button>
            <button onClick={() => setShowCreate(false)} className="px-5 py-2.5 border border-border rounded-xl text-sm font-medium text-text-secondary hover:bg-surface-alt transition-colors">Cancel</button>
          </div>
        </CatModal>
      )}

      {/* ── Edit Modal ── */}
      {editTarget && (
        <CatModal title={`Edit — ${editTarget.name}`} subtitle="Update the category details below." icon={<Pencil size={16} className="text-blue-600" />} onClose={() => setEditTarget(null)}>
          <FormFields form={form} setForm={setForm} />
          {editMutation.isError && <p className="text-xs text-red-600 mt-2 font-medium">Failed to update. Name may already exist.</p>}
          {editMutation.isSuccess && <p className="text-xs text-emerald-600 mt-2 font-medium flex items-center gap-1"><CheckCircle2 size={12} /> Saved.</p>}
          <div className="flex gap-3 mt-5">
            <button
              onClick={() => editMutation.mutate()}
              disabled={!form.name || editMutation.isPending}
              className="flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-primary-dark disabled:opacity-50 shadow-sm transition-colors"
            >
              {editMutation.isPending && <Loader2 size={14} className="animate-spin" />} Save Changes
            </button>
            <button onClick={() => setEditTarget(null)} className="px-5 py-2.5 border border-border rounded-xl text-sm font-medium text-text-secondary hover:bg-surface-alt transition-colors">Cancel</button>
          </div>
        </CatModal>
      )}

      {/* ── Deactivate Confirm ── */}
      {deleteTarget && (
        <CatModal title="Deactivate Category" subtitle="This will hide the category from new requests." icon={<Trash2 size={16} className="text-red-600" />} onClose={() => setDeleteTarget(null)}>
          <div className="flex flex-col items-center text-center py-2">
            <div className="w-14 h-14 rounded-2xl bg-red-50 border border-red-100 flex items-center justify-center mb-4">
              <ToggleLeft size={26} className="text-red-500" />
            </div>
            <p className="text-sm text-text mb-1">Deactivate <strong>{deleteTarget.name}</strong>?</p>
            <p className="text-xs text-text-muted max-w-xs">It will no longer appear in request forms. Existing requests are not affected and can be re-activated at any time.</p>
          </div>
          {deleteMutation.isError && <p className="text-xs text-red-600 mt-2 text-center font-medium">Failed to deactivate.</p>}
          <div className="flex gap-3 mt-5">
            <button
              onClick={() => deleteMutation.mutate(deleteTarget.id)}
              disabled={deleteMutation.isPending}
              className="flex-1 flex items-center justify-center gap-2 bg-red-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-red-700 disabled:opacity-50 transition-colors"
            >
              {deleteMutation.isPending && <Loader2 size={14} className="animate-spin" />} Deactivate
            </button>
            <button onClick={() => setDeleteTarget(null)} className="flex-1 px-5 py-2.5 border border-border rounded-xl text-sm font-medium text-text-secondary hover:bg-surface-alt transition-colors">Cancel</button>
          </div>
        </CatModal>
      )}
    </div>
  )
}

// ── Shared form fields ────────────────────────────────────────────────────────
function FormFields({ form, setForm }: { form: Form; setForm: React.Dispatch<React.SetStateAction<Form>> }) {
  const inputCls = 'w-full px-3.5 py-2.5 border-[1.5px] border-border rounded-xl text-sm bg-surface-alt focus:border-primary focus:bg-white focus:ring-2 focus:ring-primary/10 outline-none transition-all'
  const labelCls = 'block text-[11px] font-bold text-text-muted uppercase tracking-widest mb-1.5'
  return (
    <div className="space-y-4">
      <div>
        <label className={labelCls}>Category Name *</label>
        <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputCls} placeholder="e.g. Power Outage" />
      </div>
      <div>
        <label className={labelCls}>Description</label>
        <textarea
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          rows={3}
          className={inputCls}
          placeholder="Brief description of this category…"
        />
      </div>
      <div>
        <label className={labelCls}>Default Priority *</label>
        <select
          value={form.defaultPriority}
          onChange={(e) => setForm({ ...form, defaultPriority: e.target.value as PriorityLevel })}
          className={inputCls}
        >
          {priorities.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <p className="text-[10px] text-text-muted mt-1">The AI model may override this based on the request content.</p>
      </div>
    </div>
  )
}

// ── Modal wrapper ─────────────────────────────────────────────────────────────
function CatModal({ title, subtitle, icon, onClose, children }: {
  title: string; subtitle?: string; icon?: React.ReactNode; onClose: () => void; children: React.ReactNode
}) {
  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-50 flex items-center justify-center p-6" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between px-6 pt-5 pb-4 border-b border-border/60">
          <div className="flex items-start gap-3">
            {icon && (
              <div className="w-8 h-8 rounded-lg bg-surface-alt border border-border flex items-center justify-center shrink-0">
                {icon}
              </div>
            )}
            <div>
              <h3 className="text-sm font-bold text-text">{title}</h3>
              {subtitle && <p className="text-[11px] text-text-muted mt-0.5">{subtitle}</p>}
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-surface-alt rounded-xl text-text-muted hover:text-text transition-colors">
            <X size={16} />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  )
}
