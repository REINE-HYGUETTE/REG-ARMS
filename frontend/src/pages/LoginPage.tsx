import { useState } from 'react'
import { useNavigate, Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/lib/auth'
import api from '@/lib/api'
import { Zap, Shield, Users, BarChart3, Eye, EyeOff, CheckCircle, Clock, ArrowLeft } from 'lucide-react'
import Spinner from '@/components/ui/Spinner'

type Tab = 'login' | 'register'

const PROVINCES = [
  'Kigali City',
  'Northern Province',
  'Southern Province',
  'Eastern Province',
  'Western Province',
]

export default function LoginPage() {
  const { isAuthenticated, login, register } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as any)?.from ?? '/'
  const [tab, setTab] = useState<Tab>('login')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [registered, setRegistered] = useState(false)
  const [showForgot, setShowForgot] = useState(false)   // inline forgot-password panel

  const [loginForm, setLoginForm] = useState({ email: '', password: '' })
  const [regForm, setRegForm] = useState({
    firstName: '', lastName: '', email: '', phone: '',
    province: '', password: '', confirmPassword: '',
  })
  const [forgotEmail, setForgotEmail] = useState('')
  const [forgotSent, setForgotSent] = useState(false)

  if (isAuthenticated) return <Navigate to="/" replace />

  const changeTab = (t: Tab) => {
    setTab(t)
    setError('')
    setSuccess('')
    setRegistered(false)
    setShowForgot(false)
    setForgotSent(false)
    setForgotEmail('')
  }

  // ── Login ──────────────────────────────────────────────────
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(loginForm.email, loginForm.password)
      navigate(from, { replace: true })
    } catch (err: any) {
      const msg: string = err.response?.data?.message ?? ''
      if (msg.toLowerCase().includes('pending')) {
        setError(msg)
      } else if (msg.toLowerCase().includes('deactivated')) {
        setError(msg)
      } else {
        setError('Invalid email or password. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  // ── Register ───────────────────────────────────────────────
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (regForm.password !== regForm.confirmPassword) {
      setError('Passwords do not match')
      return
    }
    setLoading(true)
    try {
      await register({
        firstName: regForm.firstName,
        lastName:  regForm.lastName,
        email:     regForm.email,
        phone:     regForm.phone,
        province:  regForm.province,
        password:  regForm.password,
      })
      setRegistered(true)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Registration failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  // ── Forgot password ────────────────────────────────────────
  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await api.post('/auth/forgot-password', { email: forgotEmail })
    } finally {
      setForgotSent(true)
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2">

      {/* ── Hero panel ── */}
      <div className="hidden lg:flex flex-col justify-center bg-gradient-to-br from-primary-dark to-primary p-12 text-white">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-xl overflow-hidden bg-white p-1 flex items-center justify-center">
            <img src="/REG logo.png" alt="REG Logo" className="w-full h-full object-contain" />
          </div>
          <div>
            <div className="text-2xl font-bold">REG ARMS</div>
            <div className="text-white/70 text-sm">Rwanda Energy Group</div>
          </div>
        </div>
        <h2 className="text-3xl font-bold mb-4">AI-Based Request<br/>Management System</h2>
        <p className="text-white/70 mb-10 max-w-md">
          Streamline energy service requests with AI-powered priority prediction,
          intelligent routing, and real-time tracking.
        </p>
        <div className="grid grid-cols-2 gap-4 max-w-md">
          {[
            { icon: <Zap size={20} />,      label: '94% AI Accuracy', desc: 'Priority prediction' },
            { icon: <Shield size={20} />,    label: '3.2x Faster',    desc: 'Request resolution'  },
            { icon: <Users size={20} />,     label: 'Role-Based',     desc: 'Full RBAC system'    },
            { icon: <BarChart3 size={20} />, label: 'Real-time',      desc: 'Analytics & reports' },
          ].map((f) => (
            <div key={f.label} className="bg-white/10 rounded-xl p-4">
              <div className="text-accent mb-2">{f.icon}</div>
              <div className="font-semibold text-sm">{f.label}</div>
              <div className="text-white/60 text-xs">{f.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Auth panel ── */}
      <div className="flex items-center justify-center p-8 bg-white">
        <div className="w-full max-w-md">

          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-white font-bold">R</div>
            <span className="font-bold text-xl text-primary-dark">REG ARMS</span>
          </div>

          {/* Tabs — Login | Register only */}
          {!showForgot && (
            <div className="flex gap-1 bg-gray-100 rounded-lg p-1 mb-6">
              {(['login', 'register'] as Tab[]).map((t) => (
                <button
                  key={t}
                  onClick={() => changeTab(t)}
                  className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${
                    tab === t ? 'bg-white shadow text-primary-dark' : 'text-text-muted hover:text-text'
                  }`}
                >
                  {t === 'login' ? 'Sign In' : 'Register'}
                </button>
              ))}
            </div>
          )}

          {/* Forgot-password back button */}
          {showForgot && (
            <button
              onClick={() => { setShowForgot(false); setForgotSent(false); setForgotEmail(''); setError('') }}
              className="flex items-center gap-1.5 text-sm text-text-muted hover:text-primary mb-6 transition-colors"
            >
              <ArrowLeft size={15} /> Back to Sign In
            </button>
          )}

          {error   && <div className="bg-red-50 text-red-700 border border-red-200 rounded-lg px-4 py-3 text-sm mb-4">{error}</div>}
          {success && <div className="bg-primary-light text-primary rounded-lg px-4 py-3 text-sm mb-4">{success}</div>}

          {/* ── Login form ── */}
          {tab === 'login' && !showForgot && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-text-muted uppercase tracking-wide mb-1.5">Email</label>
                <input type="email" required value={loginForm.email}
                  onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
                  className="w-full border border-border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  placeholder="you@example.com" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-text-muted uppercase tracking-wide mb-1.5">Password</label>
                <div className="relative">
                  <input type={showPw ? 'text' : 'password'} required value={loginForm.password}
                    onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                    className="w-full border border-border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary pr-10" />
                  <button type="button" onClick={() => setShowPw(!showPw)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted">
                    {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {/* Forgot password link — right-aligned below the field */}
                <div className="flex justify-end mt-1.5">
                  <button
                    type="button"
                    onClick={() => { setShowForgot(true); setError('') }}
                    className="text-xs text-primary hover:underline font-medium"
                  >
                    Forgot password?
                  </button>
                </div>
              </div>
              <button type="submit" disabled={loading}
                className="w-full bg-primary hover:bg-primary-dark text-white rounded-lg py-2.5 text-sm font-semibold transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
                {loading ? <Spinner className="h-4 w-4" /> : null} Sign In
              </button>
            </form>
          )}

          {/* ── Forgot password panel (inline, replaces login form) ── */}
          {showForgot && !forgotSent && (
            <form onSubmit={handleForgot} className="space-y-4">
              <div>
                <h3 className="text-base font-bold text-text mb-1">Reset your password</h3>
                <p className="text-sm text-text-secondary mb-4">
                  Enter the email address associated with your account and we'll send you a password reset link.
                </p>
                <label className="block text-xs font-semibold text-text-muted uppercase tracking-wide mb-1.5">Email address</label>
                <input type="email" required value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full border border-border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
              </div>
              <button type="submit" disabled={loading}
                className="w-full bg-primary hover:bg-primary-dark text-white rounded-lg py-2.5 text-sm font-semibold transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
                {loading ? <Spinner className="h-4 w-4" /> : null} Send Reset Link
              </button>
            </form>
          )}

          {/* ── Forgot password — success state ── */}
          {showForgot && forgotSent && (
            <div className="text-center py-4">
              <div className="w-14 h-14 rounded-full bg-primary-light flex items-center justify-center mx-auto mb-4">
                <CheckCircle size={28} className="text-primary" />
              </div>
              <h3 className="text-base font-bold text-text mb-2">Check your inbox</h3>
              <p className="text-sm text-text-secondary mb-5">
                If an account exists for <strong>{forgotEmail}</strong>, a password reset link has been sent. Check your spam folder if you don't see it within a few minutes.
              </p>
              <button
                onClick={() => { setShowForgot(false); setForgotSent(false); setForgotEmail('') }}
                className="w-full border-[1.5px] border-primary text-primary rounded-lg py-2.5 text-sm font-semibold hover:bg-primary-light transition-colors"
              >
                Back to Sign In
              </button>
            </div>
          )}

          {/* ── Register form ── */}
          {tab === 'register' && !showForgot && !registered && (
            <form onSubmit={handleRegister} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-text-muted uppercase tracking-wide mb-1">First Name *</label>
                  <input type="text" required value={regForm.firstName}
                    onChange={(e) => setRegForm({ ...regForm, firstName: e.target.value })}
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-muted uppercase tracking-wide mb-1">Last Name *</label>
                  <input type="text" required value={regForm.lastName}
                    onChange={(e) => setRegForm({ ...regForm, lastName: e.target.value })}
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-muted uppercase tracking-wide mb-1">Email *</label>
                <input type="email" required value={regForm.email}
                  onChange={(e) => setRegForm({ ...regForm, email: e.target.value })}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-text-muted uppercase tracking-wide mb-1">Phone *</label>
                  <input type="tel" required value={regForm.phone}
                    onChange={(e) => setRegForm({ ...regForm, phone: e.target.value })}
                    placeholder="+250 7xx xxx xxx"
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-muted uppercase tracking-wide mb-1">Province</label>
                  <select value={regForm.province}
                    onChange={(e) => setRegForm({ ...regForm, province: e.target.value })}
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white">
                    <option value="">Select…</option>
                    {PROVINCES.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-text-muted uppercase tracking-wide mb-1">Password *</label>
                  <input type="password" required minLength={8} value={regForm.password}
                    onChange={(e) => setRegForm({ ...regForm, password: e.target.value })}
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-muted uppercase tracking-wide mb-1">Confirm *</label>
                  <input type="password" required value={regForm.confirmPassword}
                    onChange={(e) => setRegForm({ ...regForm, confirmPassword: e.target.value })}
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
                </div>
              </div>

              <p className="text-[11px] text-text-muted">
                Your account will be reviewed and activated by an admin within 1–2 business days.
              </p>

              <button type="submit" disabled={loading}
                className="w-full bg-primary hover:bg-primary-dark text-white rounded-lg py-2.5 text-sm font-semibold transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
                {loading ? <Spinner className="h-4 w-4" /> : null} Create Account
              </button>
            </form>
          )}

          {/* ── Registration pending approval ── */}
          {tab === 'register' && !showForgot && registered && (
            <div className="text-center py-4">
              <div className="w-16 h-16 rounded-full bg-primary-light flex items-center justify-center mx-auto mb-4">
                <Clock size={32} className="text-primary" />
              </div>
              <h3 className="text-lg font-bold text-text mb-2">Account Submitted!</h3>
              <p className="text-sm text-text-secondary mb-4">
                Your registration has been received. An admin will review your account and you'll receive a confirmation email once it's activated.
              </p>
              <div className="bg-surface-alt rounded-xl p-4 text-left space-y-2 mb-5">
                <div className="flex items-center gap-2 text-sm text-text-secondary">
                  <CheckCircle size={15} className="text-primary flex-shrink-0" />
                  Account created successfully
                </div>
                <div className="flex items-center gap-2 text-sm text-text-secondary">
                  <CheckCircle size={15} className="text-primary flex-shrink-0" />
                  Confirmation email sent to <strong>{regForm.email}</strong>
                </div>
                <div className="flex items-center gap-2 text-sm text-text-muted">
                  <Clock size={15} className="text-text-muted flex-shrink-0" />
                  Awaiting admin approval (1–2 business days)
                </div>
              </div>
              <button
                onClick={() => changeTab('login')}
                className="w-full border-[1.5px] border-primary text-primary rounded-lg py-2.5 text-sm font-semibold hover:bg-primary-light transition-colors">
                Back to Sign In
              </button>
            </div>
          )}


        </div>
      </div>
    </div>
  )
}
