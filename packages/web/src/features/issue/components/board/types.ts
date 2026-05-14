export interface ChildIssue {
  id: string
  number: number
  title: string
  status: string
  priority: string
  assignee: { id: string; name: string; avatar: string | null } | null
}
