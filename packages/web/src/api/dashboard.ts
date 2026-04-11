import api from './client'
import { type Activity, type Issue } from './issues'

export interface CompletionStat {
  user: { id: string; name: string; avatar: string | null }
  total: number
  done: number
}

export interface BurndownPoint {
  date: string
  openCount: number
}

export interface WorkloadAssignee {
  assigneeId: string
  name: string
  avatar: string | null
  statuses: Record<string, number>
  total: number
}

export interface OverdueIssue {
  id: string
  number: number
  title: string
  status: string
  priority: string
  dueDate: string
  assignee: { id: string; name: string; avatar: string | null } | null
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
  workloadByAssignee: WorkloadAssignee[]
  burndownData: BurndownPoint[]
  overdueIssues: OverdueIssue[]
  overdueCount: number
  recentActivities: Activity[]
  myIssues: Issue[]
  myFocusIssues: Issue[]
}

export const dashboardApi = {
  getStats: (projectId: string) =>
    api.get<{ data: DashboardStats }>(`/projects/${projectId}/dashboard`).then((r) => r.data.data),
}
