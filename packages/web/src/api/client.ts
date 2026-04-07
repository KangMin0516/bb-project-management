import axios, { type AxiosRequestConfig } from 'axios'
import { useAuthStore } from '@/stores/auth'

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Refresh token queue to prevent concurrent refresh calls
let isRefreshing = false
let failedQueue: Array<{
  resolve: (token: string) => void
  reject: (error: unknown) => void
}> = []

function processQueue(error: unknown, token: string | null) {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error)
    } else {
      prom.resolve(token!)
    }
  })
  failedQueue = []
}

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const originalRequest = error.config as AxiosRequestConfig & { _retry?: boolean }

    if (error.response?.status !== 401 || originalRequest._retry) {
      // Not a 401 or already retried — reject
      if (error.response?.status === 401) {
        useAuthStore.getState().logout()
      }
      return Promise.reject(error)
    }

    // Don't retry refresh endpoint itself
    if (originalRequest.url === '/auth/refresh') {
      useAuthStore.getState().logout()
      return Promise.reject(error)
    }

    const refreshToken = localStorage.getItem('refreshToken')
    if (!refreshToken) {
      useAuthStore.getState().logout()
      return Promise.reject(error)
    }

    if (isRefreshing) {
      // Queue this request until refresh completes
      return new Promise((resolve, reject) => {
        failedQueue.push({
          resolve: (token: string) => {
            originalRequest.headers = { ...originalRequest.headers, Authorization: `Bearer ${token}` }
            resolve(api(originalRequest))
          },
          reject: (err: unknown) => reject(err),
        })
      })
    }

    originalRequest._retry = true
    isRefreshing = true

    try {
      const res = await api.post<{ data: { accessToken: string; refreshToken: string } }>(
        '/auth/refresh',
        { refreshToken },
      )
      const { accessToken, refreshToken: newRefreshToken } = res.data.data
      useAuthStore.getState().setTokens(accessToken, newRefreshToken)

      processQueue(null, accessToken)

      originalRequest.headers = { ...originalRequest.headers, Authorization: `Bearer ${accessToken}` }
      return api(originalRequest)
    } catch (refreshError) {
      processQueue(refreshError, null)
      useAuthStore.getState().logout()
      return Promise.reject(refreshError)
    } finally {
      isRefreshing = false
    }
  },
)

export default api
