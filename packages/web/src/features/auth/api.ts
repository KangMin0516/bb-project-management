import api from '@/shared/api/client'

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
  refreshToken: string
  user: { id: string; email: string }
}

export interface RegisterResponse {
  message: string
}

export interface UserProfile {
  id: string
  email: string
  name: string
  avatar: string | null
  isSuperuser: boolean
  createdAt: string
}

export interface ChangePasswordPayload {
  currentPassword: string
  newPassword: string
}

export interface UpdateProfilePayload {
  name?: string
  avatar?: string
}

export const authApi = {
  login: (data: LoginPayload) =>
    api.post<{ data: AuthResponse }>('/auth/login', data).then((r) => r.data.data),
  register: (data: RegisterPayload) =>
    api.post<{ data: RegisterResponse }>('/auth/register', data).then((r) => r.data.data),
  refresh: (refreshToken: string) =>
    api.post<{ data: AuthResponse }>('/auth/refresh', { refreshToken }).then((r) => r.data.data),
  getProfile: () =>
    api.get<{ data: UserProfile }>('/auth/me').then((r) => r.data.data),
  changePassword: (data: ChangePasswordPayload) =>
    api.patch<{ data: { message: string } }>('/auth/change-password', data).then((r) => r.data.data),
  updateProfile: (data: UpdateProfilePayload) =>
    api.patch<{ data: UserProfile }>('/auth/profile', data).then((r) => r.data.data),
  uploadAvatar: (file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    return api.post<{ data: { url: string } }>('/upload/avatar', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then((r) => r.data.data)
  },
}
