import { useMemo } from 'react'
import {
  CircleDot,
  Signal,
  UserCircle,
  Tag,
  Calendar,
  Type,
  FileText,
  GitBranch,
  Plus,
  ArrowRight,
} from 'lucide-react'
import type { Activity } from '@/api/issues'
import type { ProjectMember } from '@/api/projects'
import { timeAgo } from '@/lib/time'
import {
  STATUS_LABELS,
  STATUS_COLORS,
  PRIORITY_LABELS,
  PRIORITY_COLORS,
} from '@/lib/constants'

const TYPE_LABELS: Record<string, string> = {
  EPIC: 'Epic',
  TASK: 'Task',
  BUG: 'Bug',
  SUB_TASK: 'Sub Task',
}

const PRIORITY_DOT_COLORS: Record<string, string> = {
  HIGH: 'bg-red-500',
  MEDIUM: 'bg-yellow-500',
  LOW: 'bg-blue-500',
}

const FIELD_ICONS: Record<string, React.ElementType> = {
  status: CircleDot,
  priority: Signal,
  assigneeId: UserCircle,
  type: Tag,
  dueDate: Calendar,
  title: Type,
  description: FileText,
  parentId: GitBranch,
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function StatusBadge({ value }: { value: string }) {
  const colorClass = STATUS_COLORS[value] || 'bg-gray-400'
  const label = STATUS_LABELS[value] || value.replace(/_/g, ' ')
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
      <span className={`h-2 w-2 rounded-full ${colorClass}`} />
      {label}
    </span>
  )
}

function PriorityBadge({ value }: { value: string }) {
  const dotColor = PRIORITY_DOT_COLORS[value] || 'bg-gray-400'
  const colorClass = PRIORITY_COLORS[value] || 'bg-gray-100 text-gray-700'
  const label = PRIORITY_LABELS[value] || value
  return (
    <span className={`inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-xs font-medium ${colorClass}`}>
      <span className={`h-2 w-2 rounded-full ${dotColor}`} />
      {label}
    </span>
  )
}

function UserAvatar({ name }: { name: string }) {
  const initial = name?.charAt(0)?.toUpperCase() || '?'
  return (
    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary-100 text-[10px] font-medium text-primary-700">
      {initial}
    </span>
  )
}

interface ActivityTimelineProps {
  activities: Activity[]
  members: ProjectMember[]
  projectKey?: string
}

function resolveUserName(userId: string | null, members: ProjectMember[]): string | null {
  if (!userId) return null
  const member = members.find((m) => m.user.id === userId)
  return member?.user.name || null
}

function formatFieldValue(
  field: string,
  value: string | null,
  members: ProjectMember[],
): React.ReactNode {
  if (value === null || value === undefined) return null

  switch (field) {
    case 'status':
      return <StatusBadge value={value} />
    case 'priority':
      return <PriorityBadge value={value} />
    case 'type':
      return (
        <span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
          {TYPE_LABELS[value] || value.replace(/_/g, ' ')}
        </span>
      )
    case 'assigneeId': {
      const name = resolveUserName(value, members)
      if (name) {
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-700">
            <UserAvatar name={name} />
            {name}
          </span>
        )
      }
      return <span className="text-xs text-gray-500">Unassigned</span>
    }
    case 'parentId':
      return (
        <span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-mono text-gray-600">
          {value.slice(0, 8)}...
        </span>
      )
    case 'dueDate':
      return (
        <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-700">
          {formatDate(value)}
        </span>
      )
    case 'title':
      return (
        <span className="max-w-[200px] truncate text-xs font-medium text-gray-700" title={value}>
          {value.length > 50 ? value.slice(0, 50) + '...' : value}
        </span>
      )
    case 'description':
      return null
    default:
      return <span className="text-xs text-gray-700">{value}</span>
  }
}

function getFieldLabel(field: string): string {
  switch (field) {
    case 'status': return 'status'
    case 'priority': return 'priority'
    case 'type': return 'type'
    case 'assigneeId': return 'assignee'
    case 'parentId': return 'parent issue'
    case 'dueDate': return 'due date'
    case 'title': return 'title'
    case 'description': return 'description'
    default: return field
  }
}

export default function ActivityTimeline({ activities, members, projectKey }: ActivityTimelineProps) {
  const sortedActivities = useMemo(
    () => [...activities].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [activities],
  )

  if (sortedActivities.length === 0) return null

  return (
    <div className="space-y-0">
      {sortedActivities.map((activity) => (
        <ActivityItem
          key={activity.id}
          activity={activity}
          members={members}
          projectKey={projectKey}
        />
      ))}
    </div>
  )
}

function ActivityItem({
  activity,
  members,
  projectKey: _projectKey,
}: {
  activity: Activity
  members: ProjectMember[]
  projectKey?: string
}) {
  const { field, oldValue, newValue, user, createdAt } = activity
  const isCreation = field === 'created' || (!oldValue && field === 'status')
  const isDescription = field === 'description'
  const Icon = FIELD_ICONS[field] || CircleDot

  return (
    <div className="flex gap-3 py-2.5">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-100 text-[10px] font-medium text-gray-600">
        {user?.name?.charAt(0)?.toUpperCase() || '?'}
      </div>

      <div className="min-w-0 flex-1 pt-0.5">
        <div className="flex flex-wrap items-center gap-1 text-xs">
          <span className="font-medium text-gray-800">{user?.name || 'Unknown'}</span>

          {isCreation ? (
            <>
              <span className="text-gray-500">created the issue</span>
              <Plus className="h-3 w-3 text-green-500" />
            </>
          ) : isDescription ? (
            <span className="text-gray-500">
              <FileText className="mr-1 inline h-3 w-3 text-gray-400" />
              updated description
            </span>
          ) : (
            <>
              <span className="text-gray-500">changed</span>
              <Icon className="h-3 w-3 text-gray-400" />
              <span className="text-gray-500">{getFieldLabel(field)}</span>
            </>
          )}
        </div>

        {!isCreation && !isDescription && (
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {oldValue !== null && oldValue !== undefined ? (
              <span className="inline-flex items-center opacity-60">
                {field === 'assigneeId' && !resolveUserName(oldValue, members) ? (
                  <span className="text-xs text-gray-400 line-through">Unassigned</span>
                ) : field === 'title' ? (
                  <span className="max-w-[180px] truncate text-xs text-gray-400 line-through" title={oldValue}>
                    {oldValue.length > 40 ? oldValue.slice(0, 40) + '...' : oldValue}
                  </span>
                ) : (
                  formatFieldValue(field, oldValue, members)
                )}
              </span>
            ) : (
              <span className="text-xs italic text-gray-300">none</span>
            )}
            <ArrowRight className="h-3 w-3 flex-shrink-0 text-gray-300" />
            {newValue !== null && newValue !== undefined ? (
              <span className="inline-flex items-center">
                {field === 'assigneeId' && !resolveUserName(newValue, members) ? (
                  <span className="text-xs text-gray-500">Unassigned</span>
                ) : (
                  formatFieldValue(field, newValue, members)
                )}
              </span>
            ) : (
              <span className="text-xs italic text-gray-400">none</span>
            )}
          </div>
        )}

        <div className="mt-1 text-[11px] text-gray-400">{timeAgo(createdAt)}</div>
      </div>
    </div>
  )
}
