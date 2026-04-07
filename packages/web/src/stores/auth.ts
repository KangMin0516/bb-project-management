import { create } from 'zustand'
import { authApi, type UserProfile } from '@/api/auth'

interface AuthState {
  user: UserProfile | null
  token: string | null
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (email: string, name: string, password: string) => Promise<string>
  loadUser: () => Promise<void>
  setTokens: (accessToken: string, refreshToken: string) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: localStorage.getItem('token'),
  isLoading: true,

  login: async (email, password) => {
    const res = await authApi.login({ email, password })
    useAuthStore.getState().setTokens(res.accessToken, res.refreshToken)
    const user = await authApi.getProfile()
    set({ user })
  },

  register: async (email, name, password) => {
    const res = await authApi.register({ email, name, password })
    return res.message
  },

  loadUser: async () => {
    try {
      const user = await authApi.getProfile()
      set({ user, isLoading: false })
    } catch {
      localStorage.removeItem('token')
      localStorage.removeItem('refreshToken')
      set({ user: null, token: null, isLoading: false })
    }
  },

  setTokens: (accessToken, refreshToken) => {
    localStorage.setItem('token', accessToken)
    localStorage.setItem('refreshToken', refreshToken)
    set({ token: accessToken })
  },

  logout: () => {
    localStorage.removeItem('token')
    localStorage.removeItem('refreshToken')
    set({ user: null, token: null })
  },
}))
