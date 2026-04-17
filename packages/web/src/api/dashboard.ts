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

export interface GlobalOverdueIssue extends OverdueIssue {
  project: { id: string; name: string; key: string }
}

export interface GlobalIssue extends Issue {
  project: { id: string; name: string; key: string }
}

export interface ProjectSummary {
  id: string
  name: string
  key: string
  totalIssues: number
  doneIssues: number
  myIssueCount: number
}

export interface GlobalDashboard {
  projects: ProjectSummary[]
  focusIssues: GlobalIssue[]
  myIssues: GlobalIssue[]
  overdueIssues: GlobalOverdueIssue[]
}

// Team Dashboard types
export interface TeamMember {
  user: { id: string; email: string; name: string; avatar: string | null }
  projects: { id: string; name: string; key: string; role: string }[]
  today: { focusCount: number; todoCount: number; inProgressCount: number; completedCount: number; overdueCount: number }
  overall: { totalActive: number; totalHistorical: number; doneHistorical: number }
  recentActivityCount: number
}

export interface StandupReportEntry {
  slackUsername: string
  status: 'ANSWERED' | 'ACTIVE' | 'UNANSWERED' | 'AWAY' | 'CANCELED'
  configName: string
  completedAt: string | null
  answers: { question: string; answer: string }[]
}

export interface TeamStandup {
  total: number
  answered: number
  unanswered: number
  reports: StandupReportEntry[]
}

export interface TeamDashboard {
  summary: { activeMembers: number; completedToday: number; overdueTotal: number; unassignedTotal: number }
  members: TeamMember[]
  standup: TeamStandup
  heatmap: {
    projects: { id: string; name: string; key: string }[]
    rows: { userId: string; userName: string; cells: { projectId: string; activeCount: number }[] }[]
  }
}

export const dashboardApi = {
  getStats: (projectId: string) =>
    api.get<{ data: DashboardStats }>(`/projects/${projectId}/dashboard`).then((r) => r.data.data),
  getMyDashboard: () =>
    api.get<{ data: GlobalDashboard }>('/dashboard/my').then((r) => r.data.data),
  getTeamDashboard: () =>
    api.get<{ data: TeamDashboard }>('/dashboard/team').then((r) => r.data.data),
}
