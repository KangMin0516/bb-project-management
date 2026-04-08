import api from './client'
import { type Activity, type Issue } from './issues'

export interface CompletionStat {
  user: { id: string; name: string; avatar: string | null }
  total: number
  done: number
}

export interface DashboardStats {
  project: { id: string; name: string; key: string }
  totalIssues: number
  memberCount: number
  byStatus: { status: string; count: number }[]
  byPriority: { priority: string; count: number }[]
  byType: { type: string; count: number }[]
  byAssignee: { assignee: { id: string; name: string; avatar: string | null } | null; count: number }[]
  completionByAssignee: CompletionStat[]
  recentActivities: Activity[]
  myIssues: Issue[]
  myFocusIssues: Issue[]
}

export const dashboardApi = {
  getStats: (projectId: string) =>
    api.get<{ data: DashboardStats }>(`/projects/${projectId}/dashboard`).then((r) => r.data.data),
}
