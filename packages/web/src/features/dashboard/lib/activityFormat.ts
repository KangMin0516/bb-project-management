import { STATUS_LABELS, PRIORITY_LABELS } from '@/shared/config/constants'

const FIELD_LABELS: Record<string, string> = {
  status: 'Status',
  assigneeId: 'Assignee',
  reviewerAssigneeId: 'Reviewer',
  priority: 'Priority',
  title: 'Title',
  description: 'Description',
  type: 'Type',
  dueDate: 'Due date',
  focusDate: 'Focus date',
  parentId: 'Parent',
  order: 'Order',
  created: 'Created',
}

const TYPE_LABELS: Record<string, string> = { EPIC: 'Epic', TASK: 'Task', BUG: 'Bug', SUB_TASK: 'Sub-task' }

function formatValue(field: string, value: string | null): string | null {
  if (!value) return null
  if (field === 'status') return STATUS_LABELS[value] ?? value
  if (field === 'priority') return PRIORITY_LABELS[value] ?? value
  if (field === 'type') return TYPE_LABELS[value] ?? value
  return value
}

/** Renders an activity-log entry as a human sentence. */
export function formatFieldChange(field: string, oldValue: string | null, newValue: string | null): string {
  const label = FIELD_LABELS[field] ?? field
  if (field === 'created') return 'Issue created'
  const fmtOld = formatValue(field, oldValue)
  const fmtNew = formatValue(field, newValue)
  if (fmtOld && fmtNew) return `${label}: ${fmtOld} → ${fmtNew}`
  if (fmtNew) return `${label} → ${fmtNew}`
  if (fmtOld) return `${label}: ${fmtOld} → (removed)`
  return `${label} changed`
}

export function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  return `${d.getMonth() + 1}/${d.getDate()} (${days[d.getDay()]})`
}
