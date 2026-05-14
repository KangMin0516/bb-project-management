import type { IssueDetail, Issue, UpdateIssuePayload } from '@/features/issue/api'
import type { ProjectMember, Label } from '@/features/project/api'
import { STATUSES, STATUS_LABELS, PRIORITY_COLORS, TYPE_ICONS } from '@/shared/config/constants'
import { cn } from '@/shared/lib/utils'
import InlineField from '@/shared/ui/atoms/InlineField'
import UserAvatar from '@/entities/user/UserAvatar'
import UserPicker from '@/entities/user/UserPicker'
import IssueLabelsPicker from './IssueLabelsPicker'
import IssueComponentsPicker from './IssueComponentsPicker'

interface IssueMetadataProps {
  issue: IssueDetail | Issue
  members: ProjectMember[]
  projectLabels: Label[] | undefined
  projectComponents: { id: string; name: string }[] | undefined
  epics: Issue[] | undefined
  onUpdate: (data: UpdateIssuePayload) => void
  onAssigneeChange: (id: string) => void
  onReviewerChange: (id: string) => void
}

/**
 * Read-only block of click-to-edit metadata rows (status, priority,
 * assignee, reviewer, dates, parent, labels, components). All edits flow
 * through the parent via `onUpdate` so the panel keeps a single update path.
 */
export default function IssueMetadata({
  issue: d,
  members,
  projectLabels,
  projectComponents,
  epics,
  onUpdate,
  onAssigneeChange,
  onReviewerChange,
}: IssueMetadataProps) {
  const labels = d.labels ?? []
  const components = d.components ?? []

  return (
    <div className="divide-y divide-gray-100 dark:divide-gray-700 rounded-lg border border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50 px-3 mx-6 mt-4">
      <InlineField
        label="Status"
        fieldId="status"
        display={
          <div className="flex items-center gap-2">
            <span className="rounded bg-gray-200 px-1.5 py-0.5 text-xs font-medium">
              {STATUS_LABELS[d.status] || d.status}
            </span>
            {d.status === 'IN_PROGRESS' && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onUpdate({ isRecheck: !d.isRecheck }) }}
                className={cn(
                  'rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors',
                  d.isRecheck
                    ? 'bg-orange-100 text-orange-700 hover:bg-orange-200'
                    : 'bg-gray-100 text-gray-400 hover:bg-gray-200 hover:text-gray-600',
                )}
              >
                Recheck {d.isRecheck ? '✓' : ''}
              </button>
            )}
          </div>
        }
      >
        <select
          value={d.status}
          onChange={(e) => onUpdate({ status: e.target.value })}
          className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
          autoFocus
        >
          {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s] || s}</option>)}
        </select>
      </InlineField>

      <InlineField
        label="Priority"
        fieldId="priority"
        display={
          <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${PRIORITY_COLORS[d.priority] || ''}`}>
            {d.priority}
          </span>
        }
      >
        <select
          value={d.priority}
          onChange={(e) => onUpdate({ priority: e.target.value })}
          className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
          autoFocus
        >
          {['HIGH', 'MEDIUM', 'LOW'].map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
      </InlineField>

      <InlineField
        label="Assignee"
        fieldId="assignee"
        display={
          <span className={`flex items-center gap-2 ${d.assignee ? 'text-gray-700' : 'text-gray-400 italic'}`}>
            {d.assignee ? (<><UserAvatar user={d.assignee} />{d.assignee.name}</>) : 'Unassigned'}
          </span>
        }
      >
        {(close) => (
          <UserPicker
            members={members}
            value={d.assigneeId || ''}
            onChange={(id) => { onAssigneeChange(id); close() }}
          />
        )}
      </InlineField>

      <InlineField
        label="Reviewer"
        fieldId="reviewer"
        display={
          <span className={`flex items-center gap-2 ${d.reviewerAssignee ? 'text-gray-700' : 'text-gray-400 italic'}`}>
            {d.reviewerAssignee ? (<><UserAvatar user={d.reviewerAssignee} variant="purple" />{d.reviewerAssignee.name}</>) : 'No reviewer'}
          </span>
        }
      >
        {(close) => (
          <UserPicker
            members={members}
            value={d.reviewerAssigneeId || ''}
            onChange={(id) => { onReviewerChange(id); close() }}
            emptyLabel="No reviewer"
          />
        )}
      </InlineField>

      <DateField label="Start Date" value={d.startDate} onChange={(v) => onUpdate({ startDate: v })} />
      <DateField label="Due Date" value={d.dueDate} onChange={(v) => onUpdate({ dueDate: v })} />

      {d.type !== 'EPIC' && (
        <InlineField
          label={d.type === 'SUB_TASK' ? 'Parent' : 'Epic'}
          display={
            d.parent
              ? <span className="text-gray-700">{TYPE_ICONS[d.parent.type] || '⚡'} #{d.parent.number} {d.parent.title}</span>
              : <span className="text-gray-400 italic">{d.type === 'SUB_TASK' ? 'No parent' : 'No epic'}</span>
          }
        >
          <select
            value={d.parentId || ''}
            onChange={(e) => onUpdate({ parentId: e.target.value || null })}
            className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
            autoFocus
          >
            <option value="">{d.type === 'SUB_TASK' ? 'No parent' : 'No epic'}</option>
            {(epics || []).filter((ep) => ep.id !== d.id).map((ep) => (
              <option key={ep.id} value={ep.id}>⚡ #{ep.number} {ep.title}</option>
            ))}
          </select>
        </InlineField>
      )}

      <IssueLabelsPicker
        labels={labels}
        projectLabels={projectLabels}
        onChange={(labelIds) => onUpdate({ labelIds })}
      />

      {projectComponents && projectComponents.length > 0 && (
        <IssueComponentsPicker
          components={components}
          projectComponents={projectComponents}
          onChange={(componentIds) => onUpdate({ componentIds })}
        />
      )}
    </div>
  )
}

/** Date row with calendar input + clear-button affordance. */
function DateField({ label, value, onChange }: { label: string; value: string | null; onChange: (next: string | null) => void }) {
  const display = value
    ? <span className="text-gray-700">{new Date(value).toLocaleDateString()}</span>
    : <span className="text-gray-400 italic">{`No ${label.toLowerCase()}`}</span>

  return (
    <InlineField label={label} display={display}>
      <div className="flex items-center gap-1">
        <input
          type="date"
          value={value ? value.slice(0, 10) : ''}
          onChange={(e) => onChange(e.target.value ? `${e.target.value}T00:00:00.000Z` : null)}
          className="rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
          autoFocus
        />
        {value && (
          <button onClick={() => onChange(null)} className="text-gray-400 hover:text-gray-600 text-sm px-1">
            ✕
          </button>
        )}
      </div>
    </InlineField>
  )
}
