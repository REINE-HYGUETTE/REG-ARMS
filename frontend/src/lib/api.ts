import axios from 'axios'

// In dev, leave VITE_API_URL unset → uses '/api' (Vite proxy → :8080).
// In production, set VITE_API_URL to the backend origin, e.g.
//   https://reg-arms-api.onrender.com/api
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('reg_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

let redirectingToLogin = false

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (
      error.response?.status === 401 &&
      !window.location.pathname.includes('/login') &&
      !redirectingToLogin
    ) {
      redirectingToLogin = true
      localStorage.removeItem('reg_token')
      localStorage.removeItem('reg_user')
      window.location.href = '/login'
      setTimeout(() => { redirectingToLogin = false }, 3000)
    }
    return Promise.reject(error)
  }
)

export default api
