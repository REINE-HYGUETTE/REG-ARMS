import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
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
