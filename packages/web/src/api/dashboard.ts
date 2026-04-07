import api from './client'
import { type Activity, type Issue } from './issues'

export interface DashboardStats {
  project: { id: string; name: string; key: string }
  totalIssues: number
  memberCount: number
  byStatus: { status: string; count: number }[]
  byPriority: { priority: string; count: number }[]
  byType: { type: string; count: number }[]
  byAssignee: { assignee: { id: string; name: string; avatar: string | null } | null; count: number }[]
  recentActivities: Activity[]
  myIssues: Issue[]
}

export const dashboardApi = {
  getStats: (projectId: string) =>
    api.get<{ data: DashboardStats }>(`/projects/${projectId}/dashboard`).then((r) => r.data.data),
}
