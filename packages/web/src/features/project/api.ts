import api from '@/shared/api/client'

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

export interface ProjectWithJoinStatus {
  id: string
  name: string
  key: string
  description: string | null
  createdAt: string
  updatedAt: string
  _count: { issues: number; members: number }
  isMember: boolean
  myRole: string | null
  pendingJoinRequest: { id: string; status: string } | null
}

export interface JoinRequest {
  id: string
  status: string
  message: string | null
  rejectionReason: string | null
  createdAt: string
  resolvedAt: string | null
  requester?: { id: string; email: string; name: string; avatar: string | null }
  project?: { id: string; name: string; key: string }
}

export const projectApi = {
  list: () =>
    api.get<{ data: Project[] }>('/projects').then((r) => r.data.data),
  listAll: () =>
    api.get<{ data: ProjectWithJoinStatus[] }>('/projects/all').then((r) => r.data.data),
  get: (id: string) =>
    api.get<{ data: ProjectDetail }>(`/projects/${id}`).then((r) => r.data.data),
  create: (data: CreateProjectPayload) =>
    api.post<{ data: ProjectDetail }>('/projects', data).then((r) => r.data.data),
  update: (id: string, data: Partial<CreateProjectPayload>) =>
    api.patch<{ data: ProjectDetail }>(`/projects/${id}`, data).then((r) => r.data.data),
  delete: (id: string) =>
    api.delete(`/projects/${id}`),

  listMembers: (projectId: string) =>
    api.get<{ data: ProjectMember[] }>(`/projects/${projectId}/members`).then((r) => r.data.data),
  addMember: (projectId: string, data: { userId: string; role: string }) =>
    api.post<{ data: ProjectMember }>(`/projects/${projectId}/members`, data).then((r) => r.data.data),
  updateMember: (projectId: string, memberId: string, data: { role: string }) =>
    api.patch<{ data: ProjectMember }>(`/projects/${projectId}/members/${memberId}`, data).then((r) => r.data.data),
  removeMember: (projectId: string, memberId: string) =>
    api.delete(`/projects/${projectId}/members/${memberId}`),

  listLabels: (projectId: string) =>
    api.get<{ data: Label[] }>(`/projects/${projectId}/labels`).then((r) => r.data.data),
  createLabel: (projectId: string, data: { name: string; color?: string }) =>
    api.post<{ data: Label }>(`/projects/${projectId}/labels`, data).then((r) => r.data.data),
  seedLabels: (projectId: string) =>
    api.post(`/projects/${projectId}/labels/seed`),

  createJoinRequest: (projectId: string, data?: { message?: string }) =>
    api.post<{ data: JoinRequest }>(`/projects/${projectId}/join-requests`, data ?? {}).then((r) => r.data.data),
  listJoinRequests: (projectId: string) =>
    api.get<{ data: JoinRequest[] }>(`/projects/${projectId}/join-requests`).then((r) => r.data.data),
  approveJoinRequest: (projectId: string, requestId: string) =>
    api.post<{ data: JoinRequest }>(`/projects/${projectId}/join-requests/${requestId}/approve`).then((r) => r.data.data),
  rejectJoinRequest: (projectId: string, requestId: string, data?: { reason?: string }) =>
    api.post<{ data: JoinRequest }>(`/projects/${projectId}/join-requests/${requestId}/reject`, data ?? {}).then((r) => r.data.data),
  myJoinRequests: () =>
    api.get<{ data: JoinRequest[] }>('/me/join-requests').then((r) => r.data.data),
  cancelJoinRequest: (requestId: string) =>
    api.delete(`/me/join-requests/${requestId}`),
}
