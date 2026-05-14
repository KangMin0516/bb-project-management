export const STATUSES = ['BACKLOG', 'TODO', 'IN_PROGRESS', 'REVIEW_QA', 'DONE', 'CANCELED'] as const

export const STATUS_LABELS: Record<string, string> = {
  BACKLOG: 'Backlog',
  TODO: 'To Do',
  IN_PROGRESS: 'In Progress',
  REVIEW_QA: 'Review/QA',
  DONE: 'Done',
  CANCELED: 'Canceled',
}

export const STATUS_COLORS: Record<string, string> = {
  BACKLOG: 'bg-gray-400',
  TODO: 'bg-blue-400',
  IN_PROGRESS: 'bg-yellow-400',
  REVIEW_QA: 'bg-purple-400',
  DONE: 'bg-green-400',
  CANCELED: 'bg-red-400',
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
  HIGH: 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400',
  MEDIUM: 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-400',
  LOW: 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400',
}

export const PRIORITY_DOT_COLORS: Record<string, string> = {
  HIGH: 'bg-red-500',
  MEDIUM: 'bg-yellow-500',
  LOW: 'bg-green-500',
}

export const TYPE_ICONS: Record<string, string> = {
  EPIC: '⚡',
  TASK: '✅',
  BUG: '🐛',
  SUB_TASK: '📎',
}

export const SPEC_STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400',
  REVIEW: 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400',
  APPROVED: 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400',
  DEPRECATED: 'bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400',
}

export const STATUS_BAR_COLORS: Record<string, string> = {
  BACKLOG: 'bg-gray-400',
  TODO: 'bg-blue-400',
  IN_PROGRESS: 'bg-yellow-400',
  REVIEW_QA: 'bg-purple-400',
  DONE: 'bg-green-400',
  CANCELED: 'bg-red-400',
}

export const ORDER_GAP = 1000

export const TOAST_DURATION = 4000

export const ASSIGNMENT_UNDO_DURATION = 10000

export const DEBOUNCE_DELAY = 300

export const STATUS_BADGE_COLORS: Record<string, string> = {
  BACKLOG: 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300',
  TODO: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400',
  IN_PROGRESS: 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-400',
  REVIEW_QA: 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-400',
  DONE: 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400',
  CANCELED: 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400',
}

export const EPIC_STATUS_ORDER: Record<string, number> = {
  IN_PROGRESS: 0,
  TODO: 1,
  BACKLOG: 2,
  REVIEW_QA: 3,
  DONE: 4,
  CANCELED: 5,
}

export const STANDUP_STATUSES = ['ANSWERED', 'ACTIVE', 'UNANSWERED', 'AWAY', 'CANCELED'] as const

export const STANDUP_STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string }> = {
  ANSWERED: { label: 'Answered', color: 'text-green-600 dark:text-green-400', bgColor: 'bg-green-100 dark:bg-green-900/30' },
  ACTIVE: { label: 'In Progress', color: 'text-yellow-600 dark:text-yellow-400', bgColor: 'bg-yellow-100 dark:bg-yellow-900/30' },
  UNANSWERED: { label: 'No Response', color: 'text-red-500 dark:text-red-400', bgColor: 'bg-red-100 dark:bg-red-900/30' },
  AWAY: { label: 'Away', color: 'text-gray-400', bgColor: 'bg-gray-100 dark:bg-gray-700' },
  CANCELED: { label: 'Canceled', color: 'text-gray-400', bgColor: 'bg-gray-100 dark:bg-gray-700' },
}

export function getBestStandupStatus(statuses: string[]): string {
  return statuses.reduce((best, s) => {
    const order = STANDUP_STATUSES.indexOf(s as typeof STANDUP_STATUSES[number])
    const bestOrder = STANDUP_STATUSES.indexOf(best as typeof STANDUP_STATUSES[number])
    return (order !== -1 && (bestOrder === -1 || order < bestOrder)) ? s : best
  }, statuses[0])
}

export function calculateDropOrder(
  destIssues: { order?: number }[],
  destIndex: number,
): number {
  if (destIssues.length === 0) return ORDER_GAP
  if (destIndex === 0) return (destIssues[0]?.order ?? ORDER_GAP) / 2
  if (destIndex >= destIssues.length) {
    return (destIssues[destIssues.length - 1]?.order ?? 0) + ORDER_GAP
  }
  const before = destIssues[destIndex - 1]?.order ?? 0
  const after = destIssues[destIndex]?.order ?? before + ORDER_GAP * 2
  return (before + after) / 2
}
