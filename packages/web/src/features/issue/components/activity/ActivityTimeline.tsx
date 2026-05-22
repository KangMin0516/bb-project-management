import { useMemo } from 'react'
import { useQueries } from '@tanstack/react-query'
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
import type { Activity } from '@/features/issue/api'
import type { ProjectMember } from '@/features/project/api'
import { issueRepository } from '@/features/issue/repository'
import { timeAgo } from '@/shared/lib/time'
import SourceBadge from '@/shared/ui/SourceBadge'
import UserAvatar from '@/entities/user/UserAvatar'
import {
  STATUS_LABELS,
  STATUS_COLORS,
  PRIORITY_LABELS,
  PRIORITY_COLORS,
  TYPE_ICONS,
} from '@/shared/config/constants'

/** Minimal info needed to render a resolved parent reference inline. */
type ParentRef = { number: number; title: string; type: string }
type ParentMap = Map<string, ParentRef>

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
  reviewerAssigneeId: UserCircle,
  type: Tag,
  dueDate: Calendar,
  startDate: Calendar,
  focusDate: Calendar,
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
    <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 dark:bg-gray-700 px-2 py-0.5 text-xs font-medium text-gray-700 dark:text-gray-300">
      <span className={`h-2 w-2 rounded-full ${colorClass}`} />
      {label}
    </span>
  )
}

function PriorityBadge({ value }: { value: string }) {
  const dotColor = PRIORITY_DOT_COLORS[value] || 'bg-gray-400'
  const colorClass = PRIORITY_COLORS[value] || 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
  const label = PRIORITY_LABELS[value] || value
  return (
    <span className={`inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-xs font-medium ${colorClass}`}>
      <span className={`h-2 w-2 rounded-full ${dotColor}`} />
      {label}
    </span>
  )
}

interface ActivityTimelineProps {
  activities: Activity[]
  members: ProjectMember[]
  projectId?: string
  projectKey?: string
}

function resolveUser(
  userId: string | null,
  members: ProjectMember[],
): { name: string; avatar: string | null } | null {
  if (!userId) return null
  const member = members.find((m) => m.user.id === userId)
  return member ? { name: member.user.name, avatar: member.user.avatar } : null
}

function resolveUserName(userId: string | null, members: ProjectMember[]): string | null {
  return resolveUser(userId, members)?.name ?? null
}

function formatFieldValue(
  field: string,
  value: string | null,
  members: ProjectMember[],
  parents: ParentMap,
): React.ReactNode {
  if (value === null || value === undefined) return null

  switch (field) {
    case 'status':
      return <StatusBadge value={value} />
    case 'priority':
      return <PriorityBadge value={value} />
    case 'type':
      return (
        <span className="rounded bg-gray-100 dark:bg-gray-700 px-2 py-0.5 text-xs font-medium text-gray-700 dark:text-gray-300">
          {TYPE_LABELS[value] || value.replace(/_/g, ' ')}
        </span>
      )
    case 'assigneeId':
    case 'reviewerAssigneeId': {
      const user = resolveUser(value, members)
      if (user) {
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-700 dark:text-gray-300">
            <UserAvatar user={user} size="sm" />
            {user.name}
          </span>
        )
      }
      return <span className="text-xs text-gray-500 dark:text-gray-400">Unassigned</span>
    }
    case 'parentId': {
      const ref = parents.get(value)
      if (ref) {
        return (
          <span
            className="inline-flex max-w-[220px] items-center gap-1 rounded bg-gray-100 dark:bg-gray-700 px-2 py-0.5 text-xs font-medium text-gray-700 dark:text-gray-300"
            title={ref.title}
          >
            <span className="shrink-0">{TYPE_ICONS[ref.type] || ''} #{ref.number}</span>
            <span className="truncate">{ref.title}</span>
          </span>
        )
      }
      // Fallback while the lookup is in-flight or failed.
      return (
        <span className="rounded bg-gray-100 dark:bg-gray-700 px-2 py-0.5 text-xs font-mono text-gray-600 dark:text-gray-500">
          {value.slice(0, 8)}...
        </span>
      )
    }
    case 'dueDate':
    case 'startDate':
    case 'focusDate':
      return (
        <span className="rounded bg-gray-100 dark:bg-gray-700 px-2 py-0.5 text-xs text-gray-700 dark:text-gray-300">
          {formatDate(value)}
        </span>
      )
    case 'title':
      return (
        <span className="max-w-[200px] truncate text-xs font-medium text-gray-700 dark:text-gray-300" title={value}>
          {value.length > 50 ? value.slice(0, 50) + '...' : value}
        </span>
      )
    case 'description':
      return null
    default:
      return <span className="text-xs text-gray-700 dark:text-gray-300">{value}</span>
  }
}

function getFieldLabel(field: string): string {
  switch (field) {
    case 'status': return 'status'
    case 'priority': return 'priority'
    case 'type': return 'type'
    case 'assigneeId': return 'assignee'
    case 'reviewerAssigneeId': return 'reviewer'
    case 'parentId': return 'parent issue'
    case 'dueDate': return 'due date'
    case 'startDate': return 'start date'
    case 'focusDate': return 'focus date'
    case 'isRecheck': return 'recheck flag'
    case 'title': return 'title'
    case 'description': return 'description'
    default: return field
  }
}

export default function ActivityTimeline({ activities, members, projectId, projectKey }: ActivityTimelineProps) {
  const sortedActivities = useMemo(
    () => [...activities].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [activities],
  )

  // Collect parent UUIDs referenced by parentId-field activities so we can
  // render "#17 Bugs" instead of a raw UUID truncated to 8 chars.
  const parentIds = useMemo(() => {
    const ids = new Set<string>()
    for (const a of activities) {
      if (a.field !== 'parentId') continue
      if (a.oldValue) ids.add(a.oldValue)
      if (a.newValue) ids.add(a.newValue)
    }
    return Array.from(ids)
  }, [activities])

  const parentQueries = useQueries({
    queries: parentIds.map((id) => ({
      queryKey: ['issue', projectId, id] as const,
      queryFn: () => issueRepository.findOne(projectId as string, id),
      enabled: !!projectId,
      staleTime: 60_000,
    })),
  })

  const parentMap = useMemo<ParentMap>(() => {
    const map: ParentMap = new Map()
    parentQueries.forEach((q, idx) => {
      const data = q.data
      if (data) map.set(parentIds[idx], { number: data.number, title: data.title, type: data.type })
    })
    return map
  }, [parentQueries, parentIds])

  if (sortedActivities.length === 0) return null

  return (
    <div className="space-y-0">
      {sortedActivities.map((activity) => (
        <ActivityItem
          key={activity.id}
          activity={activity}
          members={members}
          projectKey={projectKey}
          parents={parentMap}
        />
      ))}
    </div>
  )
}

function ActivityItem({
  activity,
  members,
  projectKey: _projectKey,
  parents,
}: {
  activity: Activity
  members: ProjectMember[]
  projectKey?: string
  parents: ParentMap
}) {
  const { field, oldValue, newValue, user, createdAt } = activity
  const isCreation = field === 'created' || (!oldValue && field === 'status')
  const isDescription = field === 'description'
  const Icon = FIELD_ICONS[field] || CircleDot

  return (
    <div className="flex gap-3 py-2.5">
      <UserAvatar user={user ?? null} size="md" className="shrink-0" />

      <div className="min-w-0 flex-1 pt-0.5">
        <div className="flex flex-wrap items-center gap-1 text-xs">
          <span className="font-medium text-gray-800 dark:text-gray-200">{user?.name || 'Unknown'}</span>

          {isCreation ? (
            <>
              <span className="text-gray-500 dark:text-gray-400">created the issue</span>
              <Plus className="h-3 w-3 text-green-500" />
            </>
          ) : isDescription ? (
            <span className="text-gray-500 dark:text-gray-400">
              <FileText className="mr-1 inline h-3 w-3 text-gray-400 dark:text-gray-500" />
              updated description
            </span>
          ) : (
            <>
              <span className="text-gray-500 dark:text-gray-400">changed</span>
              <Icon className="h-3 w-3 text-gray-400 dark:text-gray-500" />
              <span className="text-gray-500 dark:text-gray-400">{getFieldLabel(field)}</span>
            </>
          )}
          <SourceBadge source={activity.source} />
        </div>

        {!isCreation && !isDescription && (
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {oldValue !== null && oldValue !== undefined ? (
              <span className="inline-flex items-center opacity-60">
                {(field === 'assigneeId' || field === 'reviewerAssigneeId') && !resolveUserName(oldValue, members) ? (
                  <span className="text-xs text-gray-400 dark:text-gray-500 line-through">Unassigned</span>
                ) : field === 'title' ? (
                  <span className="max-w-[180px] truncate text-xs text-gray-400 dark:text-gray-500 line-through" title={oldValue}>
                    {oldValue.length > 40 ? oldValue.slice(0, 40) + '...' : oldValue}
                  </span>
                ) : (
                  formatFieldValue(field, oldValue, members, parents)
                )}
              </span>
            ) : (
              <span className="text-xs italic text-gray-300">none</span>
            )}
            <ArrowRight className="h-3 w-3 flex-shrink-0 text-gray-300" />
            {newValue !== null && newValue !== undefined ? (
              <span className="inline-flex items-center">
                {(field === 'assigneeId' || field === 'reviewerAssigneeId') && !resolveUserName(newValue, members) ? (
                  <span className="text-xs text-gray-500 dark:text-gray-400">Unassigned</span>
                ) : (
                  formatFieldValue(field, newValue, members, parents)
                )}
              </span>
            ) : (
              <span className="text-xs italic text-gray-400 dark:text-gray-500">none</span>
            )}
          </div>
        )}

        <div className="mt-1 text-[11px] text-gray-400 dark:text-gray-500">{timeAgo(createdAt)}</div>
      </div>
    </div>
  )
}
