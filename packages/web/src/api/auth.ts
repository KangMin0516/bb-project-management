import api from './client'

export interface LoginPayload {
  email: string
  password: string
}

export interface RegisterPayload {
  email: string
  name: string
  password: string
}

export interface AuthResponse {
  accessToken: string
  user: { id: string; email: string }
}

export interface UserProfile {
  id: string
  email: string
  name: string
  avatar: string | null
  isSuperuser: boolean
  createdAt: string
}

export const authApi = {
  login: (data: LoginPayload) =>
    api.post<{ data: AuthResponse }>('/auth/login', data).then((r) => r.data.data),
  register: (data: RegisterPayload) =>
    api.post<{ data: AuthResponse }>('/auth/register', data).then((r) => r.data.data),
  getProfile: () =>
    api.get<{ data: UserProfile }>('/auth/me').then((r) => r.data.data),
}
