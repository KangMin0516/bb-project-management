import api from './client'

export interface User {
  id: string
  email: string
  name: string
  avatar: string | null
  isSuperuser: boolean
  createdAt: string
}

export interface PendingUser {
  id: string
  email: string
  name: string
  createdAt: string
}

export interface AdminUser {
  id: string
  email: string
  name: string
  avatar: string | null
  status: 'ACTIVE' | 'PENDING' | 'REJECTED'
  isSuperuser: boolean
  createdAt: string
}

export const userApi = {
  list: (search?: string) =>
    api.get<{ data: User[] }>('/users', { params: search ? { search } : {} }).then((r) => r.data.data),
  get: (id: string) =>
    api.get<{ data: User }>(`/users/${id}`).then((r) => r.data.data),
  listPending: () =>
    api.get<{ data: PendingUser[] }>('/users/pending').then((r) => r.data.data),
  approve: (id: string) =>
    api.patch<{ data: unknown }>(`/users/${id}/approve`).then((r) => r.data.data),
  reject: (id: string) =>
    api.patch<{ data: unknown }>(`/users/${id}/reject`).then((r) => r.data.data),

  // Admin
  adminList: (params?: { status?: string; search?: string }) =>
    api.get<{ data: AdminUser[] }>('/users/admin/all', { params }).then((r) => r.data.data),
  adminUpdate: (id: string, data: { name?: string; email?: string; isSuperuser?: boolean }) =>
    api.patch<{ data: AdminUser }>(`/users/${id}/admin/update`, data).then((r) => r.data.data),
  adminResetPassword: (id: string, newPassword: string) =>
    api.patch<{ data: { message: string } }>(`/users/${id}/admin/reset-password`, { newPassword }).then((r) => r.data.data),
  adminSuspend: (id: string) =>
    api.patch<{ data: AdminUser }>(`/users/${id}/admin/suspend`).then((r) => r.data.data),
  adminActivate: (id: string) =>
    api.patch<{ data: AdminUser }>(`/users/${id}/admin/activate`).then((r) => r.data.data),
  adminDelete: (id: string) =>
    api.delete<{ data: unknown }>(`/users/${id}/admin`).then((r) => r.data.data),
}
