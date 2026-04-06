import api from './client'

export interface Project {
  id: string
  name: string
  key: string
  description: string | null
  createdAt: string
  updatedAt: string
  _count: { issues: number; members: number }
}

export interface ProjectDetail extends Omit<Project, '_count'> {
  members: ProjectMember[]
  labels: Label[]
  _count: { issues: number }
}

export interface ProjectMember {
  id: string
  role: string
  createdAt: string
  userId: string
  projectId: string
  user: { id: string; email: string; name: string; avatar: string | null }
}

export interface Label {
  id: string
  name: string
  color: string
  projectId: string
}

export interface CreateProjectPayload {
  name: string
  key: string
  description?: string
}

export const projectApi = {
  list: () =>
    api.get<{ data: Project[] }>('/projects').then((r) => r.data.data),
  get: (id: string) =>
    api.get<{ data: ProjectDetail }>(`/projects/${id}`).then((r) => r.data.data),
  create: (data: CreateProjectPayload) =>
    api.post<{ data: ProjectDetail }>('/projects', data).then((r) => r.data.data),
  update: (id: string, data: Partial<CreateProjectPayload>) =>
    api.patch<{ data: ProjectDetail }>(`/projects/${id}`, data).then((r) => r.data.data),
  delete: (id: string) =>
    api.delete(`/projects/${id}`),

  // Members
  listMembers: (projectId: string) =>
    api.get<{ data: ProjectMember[] }>(`/projects/${projectId}/members`).then((r) => r.data.data),
  addMember: (projectId: string, data: { userId: string; role: string }) =>
    api.post<{ data: ProjectMember }>(`/projects/${projectId}/members`, data).then((r) => r.data.data),
  updateMember: (projectId: string, memberId: string, data: { role: string }) =>
    api.patch<{ data: ProjectMember }>(`/projects/${projectId}/members/${memberId}`, data).then((r) => r.data.data),
  removeMember: (projectId: string, memberId: string) =>
    api.delete(`/projects/${projectId}/members/${memberId}`),

  // Labels
  listLabels: (projectId: string) =>
    api.get<{ data: Label[] }>(`/projects/${projectId}/labels`).then((r) => r.data.data),
  createLabel: (projectId: string, data: { name: string; color?: string }) =>
    api.post<{ data: Label }>(`/projects/${projectId}/labels`, data).then((r) => r.data.data),
  seedLabels: (projectId: string) =>
    api.post(`/projects/${projectId}/labels/seed`),
}
