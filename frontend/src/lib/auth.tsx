import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import type { AuthResponse, UserRole } from '@/types'
import api from './api'

interface AuthState {
  token: string | null
  userId: number | null
  fullName: string | null
  email: string | null
  role: UserRole | null
}

interface AuthContextType extends AuthState {
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<AuthResponse>
  /** Returns the server's success message. Does NOT log the user in (account needs approval). */
  register: (data: Record<string, string>) => Promise<string>
  logout: () => void
}

const AuthContext = createContext<AuthContextType | null>(null)

function loadState(): AuthState {
  const stored = localStorage.getItem('reg_user')
  if (stored) {
    try {
      return JSON.parse(stored)
    } catch { /* ignore */ }
  }
  return { token: null, userId: null, fullName: null, email: null, role: null }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(loadState)

  const saveAuth = useCallback((res: AuthResponse) => {
    const next: AuthState = {
      token: res.token,
      userId: res.userId,
      fullName: res.fullName,
      email: res.email,
      role: res.role,
    }
    localStorage.setItem('reg_token', res.token)
    localStorage.setItem('reg_user', JSON.stringify(next))
    setState(next)
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const { data } = await api.post<AuthResponse>('/auth/login', { email, password })
    saveAuth(data)
    return data
  }, [saveAuth])

  const register = useCallback(async (body: Record<string, string>) => {
    const { data } = await api.post<{ success: boolean; message: string }>('/auth/register', body)
    // Account requires admin approval — do NOT save any auth token.
    return data.message
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('reg_token')
    localStorage.removeItem('reg_user')
    setState({ token: null, userId: null, fullName: null, email: null, role: null })
  }, [])

  return (
    <AuthContext.Provider value={{ ...state, isAuthenticated: !!state.token, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
