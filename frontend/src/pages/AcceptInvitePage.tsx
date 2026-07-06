import { useEffect, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import api from '@/lib/api'
import { Eye, EyeOff, CheckCircle, AlertTriangle } from 'lucide-react'
import Spinner from '@/components/ui/Spinner'

type InviteInfo = { email: string; role: string }

const roleLabel: Record<string, string> = {
  ADMIN: 'Administrator',
  STAFF: 'Staff',
  TECHNICIAN: 'Technician',
  CUSTOMER: 'Customer',
}

export default function AcceptInvitePage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const token = params.get('token') ?? ''

  const [checking, setChecking] = useState(true)
  const [invite, setInvite] = useState<InviteInfo | null>(null)
  const [invalidReason, setInvalidReason] = useState('')

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  // Validate the token on load
  useEffect(() => {
    if (!token) {
      setInvalidReason('This invitation link is missing its token.')
      setChecking(false)
      return
    }
    api
      .get<InviteInfo>('/auth/invitation', { params: { token } })
      .then(({ data }) => setInvite(data))
      .catch((err) =>
        setInvalidReason(
          err.response?.data?.message ??
            'This invitation link is invalid or has expired. Please ask an administrator to resend it.',
        ),
      )
      .finally(() => setChecking(false))
  }, [token])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!firstName.trim() || !lastName.trim()) {
      setError('Please enter your first and last name.')
      return
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)
    try {
      await api.post('/auth/accept-invite', { token, firstName, lastName, phone, password })
      setSuccess(true)
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'Could not complete setup. The link may have expired.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <div className="bg-white rounded-2xl border border-border shadow-sm w-full max-w-md p-8">
        {/* Logo */}
        <div className="flex items-center gap-2 mb-8">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-white font-bold text-sm">R</div>
          <span className="font-bold text-xl text-primary-dark">REG ARMS</span>
        </div>

        {checking ? (
          <div className="flex flex-col items-center py-8">
            <Spinner className="h-6 w-6" />
            <p className="text-sm text-text-muted mt-3">Checking your invitation…</p>
          </div>
        ) : invalidReason ? (
          <div className="flex items-start gap-2 bg-red-50 text-red-700 border border-red-200 rounded-lg px-4 py-3 text-sm">
            <AlertTriangle size={16} className="shrink-0 mt-0.5" />
            <div>
              {invalidReason}
              <button onClick={() => navigate('/login')} className="block mt-3 text-primary font-semibold">
                Go to Sign In
              </button>
            </div>
          </div>
        ) : success ? (
          <div className="text-center">
            <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
              <CheckCircle size={28} className="text-green-600" />
            </div>
            <h2 className="text-lg font-bold text-text mb-2">Account ready!</h2>
            <p className="text-sm text-text-secondary mb-6">
              Your account has been set up. You can now sign in with your email and the password you chose.
            </p>
            <button
              onClick={() => navigate('/login')}
              className="w-full bg-primary hover:bg-primary-dark text-white rounded-lg py-2.5 text-sm font-semibold transition-colors"
            >
              Go to Sign In
            </button>
          </div>
        ) : (
          <>
            <h2 className="text-lg font-bold text-text mb-1">Set up your account</h2>
            <p className="text-sm text-text-secondary mb-1">
              You've been invited as a <strong>{roleLabel[invite!.role] ?? invite!.role}</strong>.
            </p>
            <p className="text-xs text-text-muted mb-6">{invite!.email}</p>

            {error && (
              <div className="bg-red-50 text-red-700 border border-red-200 rounded-lg px-4 py-3 text-sm mb-4">{error}</div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-text-muted uppercase tracking-wide mb-1.5">First Name</label>
                  <input
                    required
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="w-full border border-border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-muted uppercase tracking-wide mb-1.5">Last Name</label>
                  <input
                    required
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="w-full border border-border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-muted uppercase tracking-wide mb-1.5">Phone <span className="text-text-muted/60 normal-case font-normal">(optional)</span></label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+250 …"
                  className="w-full border border-border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-muted uppercase tracking-wide mb-1.5">Password</label>
                <div className="relative">
                  <input
                    type={showPw ? 'text' : 'password'}
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full border border-border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary pr-10"
                    placeholder="Minimum 8 characters"
                  />
                  <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted">
                    {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-muted uppercase tracking-wide mb-1.5">Confirm Password</label>
                <input
                  type="password"
                  required
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="w-full border border-border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-primary hover:bg-primary-dark text-white rounded-lg py-2.5 text-sm font-semibold transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {loading ? <Spinner className="h-4 w-4" /> : null}
                Create Account
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
