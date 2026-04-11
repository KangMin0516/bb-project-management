export const STATUSES = ['BACKLOG', 'TODO', 'IN_PROGRESS', 'REVIEW_QA', 'DONE', 'CANCELED', 'RECHECK'] as const

export const STATUS_LABELS: Record<string, string> = {
  BACKLOG: 'Backlog',
  TODO: 'To Do',
  IN_PROGRESS: 'In Progress',
  REVIEW_QA: 'Review/QA',
  DONE: 'Done',
  CANCELED: 'Canceled',
  RECHECK: 'Recheck',
}

export const STATUS_COLORS: Record<string, string> = {
  BACKLOG: 'bg-gray-400',
  TODO: 'bg-blue-400',
  IN_PROGRESS: 'bg-yellow-400',
  REVIEW_QA: 'bg-purple-400',
  DONE: 'bg-green-400',
  CANCELED: 'bg-red-400',
  RECHECK: 'bg-orange-400',
}

export const PRIORITIES = ['HIGH', 'MEDIUM', 'LOW'] as const

export const PRIORITY_LABELS: Record<string, string> = {
  HIGH: 'High',
  MEDIUM: 'Medium',
  LOW: 'Low',
}

export const PRIORITY_ORDER: Record<string, number> = {
  HIGH: 0,
  MEDIUM: 1,
  LOW: 2,
}

export const PRIORITY_COLORS: Record<string, string> = {
  HIGH: 'bg-red-100 text-red-700',
  MEDIUM: 'bg-yellow-100 text-yellow-700',
  LOW: 'bg-green-100 text-green-700',
}

export const TYPE_ICONS: Record<string, string> = {
  EPIC: '⚡',
  TASK: '✅',
  BUG: '🐛',
  SUB_TASK: '📎',
}

export const SPEC_STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-600',
  REVIEW: 'bg-amber-100 text-amber-700',
  APPROVED: 'bg-green-100 text-green-700',
  DEPRECATED: 'bg-red-100 text-red-600',
}

export const ORDER_GAP = 1000
