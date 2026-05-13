export function todayDateString(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function isFocusToday(focusDate: string | null): boolean {
  if (!focusDate) return false
  return focusDate.slice(0, 10) === todayDateString()
}

function dueDiff(dueDate: string): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const due = new Date(dueDate)
  due.setHours(0, 0, 0, 0)
  return Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

export function isOverdue(dueDate: string | null | undefined): boolean {
  if (!dueDate) return false
  return dueDiff(dueDate) < 0
}

const CLOSED_STATUSES = new Set(['DONE', 'CANCELED'])

export function isIssueOverdue(issue: { status: string; dueDate: string | null }): boolean {
  return !CLOSED_STATUSES.has(issue.status) && isOverdue(issue.dueDate)
}

export function getDueBadge(dueDate: string | null): { text: string; className: string } | null {
  if (!dueDate) return null
  const diff = dueDiff(dueDate)

  if (diff < 0) return { text: `D+${Math.abs(diff)}`, className: 'bg-red-100 text-red-700' }
  if (diff === 0) return { text: 'D-Day', className: 'bg-red-100 text-red-700' }
  if (diff <= 3) return { text: `D-${diff}`, className: 'bg-orange-100 text-orange-700' }
  if (diff <= 7) return { text: `D-${diff}`, className: 'bg-yellow-100 text-yellow-700' }
  const due = new Date(dueDate)
  return { text: `${due.getMonth() + 1}/${due.getDate()}`, className: 'bg-gray-100 text-gray-500' }
}

export function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}
