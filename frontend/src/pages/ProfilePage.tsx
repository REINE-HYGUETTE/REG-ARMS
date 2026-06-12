import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Save, Lock, Loader2, Camera, User, Mail, Phone, MapPin,
  Shield, Calendar, CheckCircle, UserCog,
} from 'lucide-react'
import api from '@/lib/api'
import Spinner from '@/components/ui/Spinner'
import LocationSelector, { type LocationValue } from '@/components/ui/LocationSelector'
import { RoleBadge } from '@/components/ui/Badge'
import { useAuth } from '@/lib/auth'
import type { User as UserType, Technician } from '@/types'

const emptyLocation: LocationValue = {
  province: '', district: '', sector: '', cell: '', village: '',
}

const STORAGE_KEY = (userId?: number) => `reg_arms_avatar_${userId}`

export default function ProfilePage() {
  const queryClient = useQueryClient()
  const { userId } = useAuth()
  const fileRef = useRef<HTMLInputElement>(null)

  const [pwForm, setPwForm]   = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })
  const [pwMsg, setPwMsg]     = useState<{ ok: boolean; text: string } | null>(null)
  const [avatarSrc, setAvatarSrc] = useState<string | null>(null)

  const { data: profile, isLoading } = useQuery({
    queryKey: ['profile', userId],
    queryFn: async () => {
      const { data } = await api.get<UserType>('/profile')
      return data
    },
    enabled: !!userId,
  })

  const [form, setForm]         = useState({ firstName: '', lastName: '', phone: '' })
  const [location, setLocation] = useState<LocationValue>(emptyLocation)

  // Load avatar: prefer backend profilePhoto, fall back to localStorage cache
  useEffect(() => {
    if (profile?.profilePhoto) {
      setAvatarSrc(profile.profilePhoto)
      // Keep localStorage in sync so Topbar reads it on next load without an extra fetch
      localStorage.setItem(STORAGE_KEY(userId ?? undefined), profile.profilePhoto)
    } else {
      const cached = localStorage.getItem(STORAGE_KEY(userId ?? undefined))
      if (cached) setAvatarSrc(cached)
    }
  }, [profile, userId])

  useEffect(() => {
    if (profile) {
      setForm({ firstName: profile.firstName, lastName: profile.lastName, phone: profile.phone ?? '' })
      setLocation({
        province: profile.province ?? '',
        district: profile.district ?? '',
        sector:   profile.sector   ?? '',
        cell:     profile.cell     ?? '',
        village:  profile.village  ?? '',
      })
    }
  }, [profile])

  const updateMutation = useMutation({
    mutationFn: async () => {
      await api.put('/profile', {
        firstName: form.firstName,
        lastName:  form.lastName,
        phone:     form.phone,
        province:  location.province,
        district:  location.district,
        sector:    location.sector,
        cell:      location.cell,
        village:   location.village,
      })
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['profile', userId] }),
  })

  const pwMutation = useMutation({
    mutationFn: async () => {
      await api.post('/profile/change-password', pwForm)
    },
    onSuccess: () => {
      setPwMsg({ ok: true, text: 'Password changed successfully.' })
      setPwForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
    },
    onError: () => setPwMsg({ ok: false, text: 'Failed — check your current password.' }),
  })

  const photoMutation = useMutation({
    mutationFn: async (photo: string) => {
      await api.patch('/profile/photo', { photo })
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['profile', userId] }),
  })

  // Handle avatar file selection — persist to backend + broadcast to Topbar
  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const result = ev.target?.result as string
      setAvatarSrc(result)
      // 1. Cache locally for instant Topbar update
      localStorage.setItem(STORAGE_KEY(userId ?? undefined), result)
      // 2. Broadcast to Topbar immediately
      window.dispatchEvent(new CustomEvent('avatar-updated', { detail: result }))
      // 3. Persist to the backend so it survives across devices / sessions
      photoMutation.mutate(result)
    }
    reader.readAsDataURL(file)
  }

  if (isLoading) return <div className="flex justify-center py-16"><Spinner /></div>
  if (!profile)  return null

  const initials = [profile.firstName[0], profile.lastName[0]].join('').toUpperCase()
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))

  const pwValid = pwForm.newPassword.length >= 8 && pwForm.newPassword === pwForm.confirmPassword && !!pwForm.currentPassword

  const locationSummary = [profile.province, profile.district].filter(Boolean).join(', ') || '—'

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 w-full">

      {/* ── LEFT COLUMN ── */}
      <div className="lg:col-span-1 space-y-5">

        {/* Profile card */}
        <div className="bg-white rounded-2xl border border-border/70 shadow-sm overflow-hidden">
          {/* Banner */}
          <div className="h-24 relative" style={{ background: 'linear-gradient(135deg, #B91C1C 0%, #DC2626 55%, #EF4444 100%)' }}>
            {/* Decorative rings */}
            <div className="absolute right-4 top-4 w-16 h-16 rounded-full border-2 border-white/10" />
            <div className="absolute right-8 -top-4 w-24 h-24 rounded-full border-2 border-white/5" />
          </div>

          <div className="px-6 pb-6">
            {/* Avatar */}
            <div className="flex items-end justify-between -mt-10 mb-4">
              <div className="relative group">
                <div className="w-20 h-20 rounded-2xl ring-4 ring-white shadow-lg overflow-hidden bg-primary flex items-center justify-center">
                  {avatarSrc ? (
                    <img src={avatarSrc} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-2xl font-bold text-white">{initials}</span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="absolute inset-0 rounded-2xl bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
                  title="Change photo"
                >
                  <Camera size={18} className="text-white" />
                </button>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
              </div>
              <RoleBadge role={profile.role} />
            </div>

            <h2 className="text-base font-bold text-text">{profile.firstName} {profile.lastName}</h2>
            <p className="text-xs text-text-muted mt-0.5">{profile.email}</p>

            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="mt-4 w-full flex items-center justify-center gap-2 py-2 rounded-xl border-[1.5px] border-dashed border-border hover:border-primary hover:text-primary text-xs font-semibold text-text-muted transition-colors"
            >
              <Camera size={13} /> {avatarSrc ? 'Change Photo' : 'Upload Photo'}
            </button>
          </div>
        </div>

        {/* Account info card */}
        <div className="bg-white rounded-2xl border border-border/70 shadow-sm p-5 space-y-3">
          <h3 className="text-xs font-bold text-text-muted uppercase tracking-widest mb-3">Account Details</h3>

          <InfoRow icon={<Mail size={13} />} label="Email" value={profile.email} />
          <InfoRow icon={<Phone size={13} />} label="Phone" value={profile.phone || '—'} />
          <InfoRow icon={<MapPin size={13} />} label="Location" value={locationSummary} />
          <InfoRow
            icon={<Calendar size={13} />}
            label="Member Since"
            value={new Date(profile.createdAt ?? Date.now()).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          />
        </div>

        {/* Security / Change Password */}
        <div className="bg-white rounded-2xl border border-border/70 shadow-sm p-5">
          <div className="flex items-center gap-2.5 mb-5">
            <div className="w-8 h-8 rounded-xl bg-amber-50 flex items-center justify-center">
              <Lock size={15} className="text-amber-600" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-text">Security</h3>
              <p className="text-[11px] text-text-muted">Change your account password</p>
            </div>
          </div>

          <div className="space-y-3">
            <Field
              label="Current Password"
              name="currentPassword"
              value={pwForm.currentPassword}
              onChange={(e) => setPwForm((p) => ({ ...p, currentPassword: e.target.value }))}
              type="password"
              icon={<Lock size={14} />}
            />
            <Field
              label="New Password"
              name="newPassword"
              value={pwForm.newPassword}
              onChange={(e) => setPwForm((p) => ({ ...p, newPassword: e.target.value }))}
              type="password"
              icon={<Shield size={14} />}
            />
            <Field
              label="Confirm Password"
              name="confirmPassword"
              value={pwForm.confirmPassword}
              onChange={(e) => setPwForm((p) => ({ ...p, confirmPassword: e.target.value }))}
              type="password"
              icon={<Shield size={14} />}
            />
          </div>

          {/* Password strength indicator */}
          {pwForm.newPassword.length > 0 && (
            <div className="mt-3">
              <div className="flex gap-1">
                {[...Array(4)].map((_, i) => (
                  <div
                    key={i}
                    className={`h-1.5 flex-1 rounded-full transition-all ${
                      i < strengthLevel(pwForm.newPassword)
                        ? strengthColor(pwForm.newPassword)
                        : 'bg-border'
                    }`}
                  />
                ))}
              </div>
              <p className="text-[11px] text-text-muted mt-1 font-medium">{strengthLabel(pwForm.newPassword)}</p>
            </div>
          )}

          <div className="mt-4 flex flex-col gap-2">
            <button
              type="button"
              onClick={() => pwMutation.mutate()}
              disabled={!pwValid || pwMutation.isPending}
              className="w-full flex items-center justify-center gap-2 bg-primary text-white px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-primary-dark transition-colors disabled:opacity-50 shadow-sm"
            >
              {pwMutation.isPending ? <Loader2 size={15} className="animate-spin" /> : <Lock size={15} />}
              Update Password
            </button>
            {pwMsg && (
              <p className={`text-xs font-semibold text-center ${pwMsg.ok ? 'text-emerald-600' : 'text-red-600'}`}>
                {pwMsg.ok ? '✓ ' : '✗ '}{pwMsg.text}
              </p>
            )}
          </div>

          <p className="text-[10px] text-text-muted mt-3 leading-relaxed">
            Must be at least 8 characters with uppercase, numbers, and special characters.
          </p>
        </div>
      </div>

      {/* ── RIGHT COLUMN ── */}
      <div className="lg:col-span-2 space-y-5">

        {/* Personal Info */}
        <form onSubmit={(e) => { e.preventDefault(); updateMutation.mutate() }}>
          <div className="bg-white rounded-2xl border border-border/70 shadow-sm p-7">
            <div className="flex items-center gap-2.5 mb-6">
              <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center">
                <User size={15} className="text-blue-600" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-text">Personal Information</h3>
                <p className="text-[11px] text-text-muted">Update your name, phone number, and location</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="First Name" name="firstName" value={form.firstName} onChange={handleChange} icon={<User size={14} />} />
              <Field label="Last Name"  name="lastName"  value={form.lastName}  onChange={handleChange} icon={<User size={14} />} />

              {/* Email — read-only */}
              <div className="sm:col-span-2">
                <label className="block text-[11px] font-bold text-text-muted uppercase tracking-widest mb-1.5">Email Address</label>
                <div className="relative">
                  <Mail size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" />
                  <input
                    value={profile.email}
                    readOnly
                    className="w-full pl-10 pr-4 py-2.5 border-[1.5px] border-border rounded-xl text-sm bg-surface-alt text-text-muted cursor-not-allowed outline-none"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-text-muted bg-border/50 px-1.5 py-0.5 rounded">read-only</span>
                </div>
              </div>

              <div className="sm:col-span-2">
                <Field label="Phone Number" name="phone" value={form.phone} onChange={handleChange} type="tel" icon={<Phone size={14} />} />
              </div>

              <div className="sm:col-span-2">
                <p className="text-[11px] font-bold text-text-muted uppercase tracking-widest mb-3 flex items-center gap-1.5">
                  <MapPin size={12} /> Location
                </p>
                <LocationSelector value={location} onChange={setLocation} compact />
              </div>
            </div>

            <div className="mt-6 flex items-center gap-3">
              <button
                type="submit"
                disabled={updateMutation.isPending}
                className="flex items-center gap-2 bg-primary text-white px-6 py-2.5 rounded-xl text-sm font-bold hover:bg-primary-dark transition-colors disabled:opacity-50 shadow-sm"
              >
                {updateMutation.isPending ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                Save Changes
              </button>
              {updateMutation.isSuccess && (
                <span className="flex items-center gap-1 text-xs text-emerald-600 font-semibold">
                  <CheckCircle size={13} /> Profile updated
                </span>
              )}
              {updateMutation.isError && (
                <span className="text-xs text-red-600 font-semibold">Failed to save. Try again.</span>
              )}
            </div>
          </div>
        </form>

        {/* Professional Profile — technicians only */}
        {profile.role === 'TECHNICIAN' && <TechnicianProfileSection />}
      </div>
    </div>
  )
}

// ── Technician Professional Profile section ───────────────────────────────────
function TechnicianProfileSection() {
  const queryClient = useQueryClient()

  const { data: techProfile } = useQuery({
    queryKey: ['technician-me'],
    queryFn: () => api.get<Technician>('/technicians/me').then(r => r.data),
  })

  // Fetch the user profile to get their admin-assigned district/province
  const { data: userProfile } = useQuery({
    queryKey: ['profile'],
    queryFn: () => api.get<UserType>('/profile').then(r => r.data),
  })

  const { data: categories = [] } = useQuery<{ id: number; name: string; isActive?: boolean }[]>({
    queryKey: ['categories'],
    queryFn: () => api.get('/categories').then(r => r.data),
    staleTime: 5 * 60_000,
  })

  const [specText,     setSpecText]     = useState('')
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [saved,        setSaved]        = useState(false)
  const [saveError,    setSaveError]    = useState<string | null>(null)

  // Populate from saved technician profile
  useEffect(() => {
    if (techProfile) {
      setSpecText(techProfile.specialization ?? '')
      setSelectedTags(techProfile.specializationTags ?? [])
    }
  }, [techProfile])

  const toggleTag = (name: string) =>
    setSelectedTags(prev => prev.includes(name) ? prev.filter(t => t !== name) : [...prev, name])

  const mutation = useMutation({
    mutationFn: () => api.patch('/technicians/me/profile', {
      specialization:     specText.trim() || null,
      specializationTags: selectedTags,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['technician-me'] })
      setSaved(true)
      setSaveError(null)
      setTimeout(() => setSaved(false), 3000)
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message ?? err?.response?.data ?? err?.message ?? 'Failed to save.'
      setSaveError(typeof msg === 'string' ? msg : 'Failed to save. Check backend logs.')
    },
  })

  const activeCategories = categories.filter(c => c.isActive !== false)
  const assignedProvince = userProfile?.province
  const assignedDistrict = userProfile?.district

  return (
    <div className="bg-white rounded-2xl border border-border/70 shadow-sm p-7">
      <div className="flex items-center gap-2.5 mb-6">
        <div className="w-8 h-8 rounded-xl bg-primary-light flex items-center justify-center">
          <UserCog size={15} className="text-primary" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-text">Professional Profile</h3>
          <p className="text-[11px] text-text-muted">
            Used by the AI to match you to the right requests — keep this accurate
          </p>
        </div>
      </div>

      <div className="space-y-6">

        {/* ── Assigned Coverage Area — read-only ── */}
        <div>
          <label className="block text-[11px] font-bold text-text-muted uppercase tracking-widest mb-1.5">
            Assigned Coverage Area
          </label>
          <p className="text-[11px] text-text-muted mb-3">
            Your district and province are assigned by your administrator. You will only receive requests from this area.
          </p>
          <div className="flex flex-wrap gap-2">
            {assignedProvince ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-600 text-white border border-emerald-600 shadow-sm">
                <MapPin size={11} /> {assignedProvince}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                No province assigned
              </span>
            )}
            {assignedDistrict ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-blue-600 text-white border border-blue-600 shadow-sm">
                <MapPin size={11} /> {assignedDistrict}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                No district assigned
              </span>
            )}
          </div>
          {(!assignedProvince || !assignedDistrict) && (
            <p className="text-[11px] text-amber-600 font-medium mt-2">
              Contact your administrator to have your coverage area assigned.
            </p>
          )}
        </div>

        {/* ── Specialization description ── */}
        <div>
          <label className="block text-[11px] font-bold text-text-muted uppercase tracking-widest mb-1.5">
            Specialization
          </label>
          <input
            value={specText}
            onChange={e => setSpecText(e.target.value)}
            placeholder="e.g. High Voltage Distribution, Meter Installation"
            className="w-full px-3.5 py-2.5 border-[1.5px] border-border rounded-xl text-sm bg-surface-alt focus:border-primary focus:ring-4 focus:ring-primary/8 focus:bg-white outline-none transition-all"
          />
          <p className="text-[11px] text-text-muted mt-1">A short description of your technical expertise</p>
        </div>

        {/* ── Service Category Tags — badge chips ── */}
        <div>
          <label className="block text-[11px] font-bold text-text-muted uppercase tracking-widest mb-1.5">
            Service Categories
          </label>
          <p className="text-[11px] text-text-muted mb-3">
            Select the request categories you specialise in. The AI uses this to prioritise you for matching requests.
          </p>
          <div className="flex flex-wrap gap-2">
            {activeCategories.map(c => {
              const active = selectedTags.includes(c.name)
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => toggleTag(c.name)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                    active
                      ? 'bg-primary text-white border-primary shadow-sm'
                      : 'bg-surface-alt text-text-secondary border-border hover:border-primary hover:text-primary'
                  }`}
                >
                  {active && <CheckCircle size={11} />}
                  {c.name}
                </button>
              )
            })}
            {activeCategories.length === 0 && (
              <p className="text-xs text-text-muted">Loading categories...</p>
            )}
          </div>
        </div>

        {/* ── Save ── */}
        <div className="flex items-center gap-3 pt-1 border-t border-border/40">
          <button
            type="button"
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            className="flex items-center gap-2 bg-primary text-white px-6 py-2.5 rounded-xl text-sm font-bold hover:bg-primary-dark transition-colors disabled:opacity-50 shadow-sm"
          >
            {mutation.isPending ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
            Save Profile
          </button>
          {saved && (
            <span className="flex items-center gap-1 text-xs text-emerald-600 font-semibold">
              <CheckCircle size={13} /> Saved successfully
            </span>
          )}
          {saveError && (
            <span className="text-xs text-red-600 font-semibold">{saveError}</span>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Info row for left panel ───────────────────────────────────────────────────
function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <div className="w-7 h-7 rounded-lg bg-surface-alt flex items-center justify-center text-text-muted shrink-0 mt-0.5">
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-[10px] font-bold text-text-muted uppercase tracking-widest">{label}</div>
        <div className="text-xs font-semibold text-text truncate">{value}</div>
      </div>
    </div>
  )
}

// ── Reusable field component ──────────────────────────────────────────────────
function Field({
  label, name, value, onChange, type = 'text', icon,
}: {
  label: string
  name: string
  value: string
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  type?: string
  icon?: React.ReactNode
}) {
  return (
    <div>
      <label className="block text-[11px] font-bold text-text-muted uppercase tracking-widest mb-1.5">{label}</label>
      <div className="relative">
        {icon && (
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted">{icon}</span>
        )}
        <input
          name={name}
          value={value}
          onChange={onChange}
          type={type}
          className={`
            w-full py-2.5 border-[1.5px] border-border rounded-xl text-sm
            bg-surface-alt focus:border-primary focus:ring-4 focus:ring-primary/8
            focus:bg-white outline-none transition-all
            ${icon ? 'pl-10 pr-4' : 'px-4'}
          `}
        />
      </div>
    </div>
  )
}

// ── Password strength helpers ─────────────────────────────────────────────────
function strengthLevel(pw: string): number {
  let score = 0
  if (pw.length >= 8)                         score++
  if (/[A-Z]/.test(pw))                       score++
  if (/[0-9]/.test(pw))                       score++
  if (/[^A-Za-z0-9]/.test(pw))               score++
  return score
}
function strengthColor(pw: string): string {
  const l = strengthLevel(pw)
  return l <= 1 ? 'bg-red-400' : l === 2 ? 'bg-amber-400' : l === 3 ? 'bg-yellow-400' : 'bg-emerald-500'
}
function strengthLabel(pw: string): string {
  const l = strengthLevel(pw)
  return ['', 'Weak — add uppercase letters', 'Fair — add numbers', 'Good — add special characters', '✓ Strong password'][l] ?? ''
}
