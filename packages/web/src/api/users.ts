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
}
