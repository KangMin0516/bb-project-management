import api from './client'

export interface User {
  id: string
  email: string
  name: string
  avatar: string | null
  isSuperuser: boolean
  createdAt: string
}

export const userApi = {
  list: (search?: string) =>
    api.get<{ data: User[] }>('/users', { params: search ? { search } : {} }).then((r) => r.data.data),
  get: (id: string) =>
    api.get<{ data: User }>(`/users/${id}`).then((r) => r.data.data),
}
