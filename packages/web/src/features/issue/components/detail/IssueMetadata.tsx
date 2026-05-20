import type { IssueDetail, Issue, UpdateIssuePayload } from '@/features/issue/api'
import type { ProjectMember, Label } from '@/features/project/api'
import { STATUSES, STATUS_LABELS, STATUS_BADGE_COLORS, STATUS_COLORS, PRIORITY_COLORS, PRIORITY_DOT_COLORS, TYPE_ICONS } from '@/shared/config/constants'
import { cn } from '@/shared/lib/utils'
import InlineField from '@/shared/ui/atoms/InlineField'
import DatePopover from '@/shared/ui/DatePopover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/ui/select'
import Combobox from '@/shared/ui/combobox'
import UserAvatar from '@/entities/user/UserAvatar'
import UserPicker from '@/entities/user/UserPicker'
import IssueLabelsPicker from './IssueLabelsPicker'
import IssueComponentsPicker from './IssueComponentsPicker'

/** Sentinel for the Parent/Epic Select since Radix Select disallows empty value. */
const NO_PARENT = '__none__'

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
          <span className={cn(
            'inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium',
            STATUS_BADGE_COLORS[d.status] || 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300',
          )}>
            <span className={cn('h-1.5 w-1.5 rounded-full', STATUS_COLORS[d.status] || 'bg-gray-400')} />
            {STATUS_LABELS[d.status] || d.status}
          </span>
        }
      >
        {(close) => (
          <Select
            defaultOpen
            value={d.status}
            onValueChange={(v) => { onUpdate({ status: v }); close() }}
          >
            <SelectTrigger className="h-8 text-sm">
              <SelectValue>
                <span className={cn(
                  'inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium',
                  STATUS_BADGE_COLORS[d.status] || 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300',
                )}>
                  <span className={cn('h-1.5 w-1.5 rounded-full', STATUS_COLORS[d.status] || 'bg-gray-400')} />
                  {STATUS_LABELS[d.status] || d.status}
                </span>
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  <span className="inline-flex items-center gap-2">
                    <span className={cn('h-1.5 w-1.5 rounded-full', STATUS_COLORS[s] || 'bg-gray-400')} />
                    <span>{STATUS_LABELS[s] || s}</span>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </InlineField>

      <InlineField
        label="Priority"
        fieldId="priority"
        display={
          <span className={cn(
            'inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium',
            PRIORITY_COLORS[d.priority] || 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300',
          )}>
            <span className={cn('h-1.5 w-1.5 rounded-full', PRIORITY_DOT_COLORS[d.priority] || 'bg-gray-400')} />
            {d.priority}
          </span>
        }
      >
        {(close) => (
          <Select
            defaultOpen
            value={d.priority}
            onValueChange={(v) => { onUpdate({ priority: v }); close() }}
          >
            <SelectTrigger className="h-8 text-sm">
              <SelectValue>
                <span className={cn(
                  'inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium',
                  PRIORITY_COLORS[d.priority] || 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300',
                )}>
                  <span className={cn('h-1.5 w-1.5 rounded-full', PRIORITY_DOT_COLORS[d.priority] || 'bg-gray-400')} />
                  {d.priority}
                </span>
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {['HIGH', 'MEDIUM', 'LOW'].map((p) => (
                <SelectItem key={p} value={p}>
                  <span className="inline-flex items-center gap-2">
                    <span className={cn('h-1.5 w-1.5 rounded-full', PRIORITY_DOT_COLORS[p] || 'bg-gray-400')} />
                    <span>{p}</span>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
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

      <DateField label="Start Date" fieldId="start-date" value={d.startDate} onChange={(v) => onUpdate({ startDate: v })} />
      <DateField label="Due Date" fieldId="due-date" value={d.dueDate} onChange={(v) => onUpdate({ dueDate: v })} />

      {d.type !== 'EPIC' && (
        <InlineField
          label={d.type === 'SUB_TASK' ? 'Parent' : 'Epic'}
          display={
            d.parent
              ? <span className="text-gray-700">{TYPE_ICONS[d.parent.type] || '⚡'} #{d.parent.number} {d.parent.title}</span>
              : <span className="text-gray-400 italic">{d.type === 'SUB_TASK' ? 'No parent' : 'No epic'}</span>
          }
        >
          {(close) => (
            <Combobox
              defaultOpen
              value={d.parentId || NO_PARENT}
              onChange={(v) => {
                onUpdate({ parentId: v === NO_PARENT ? null : v })
                close()
              }}
              onOpenChange={(open) => { if (!open) close() }}
              options={[
                { value: NO_PARENT, label: d.type === 'SUB_TASK' ? 'No parent' : 'No epic' },
                ...(epics || []).filter((ep) => ep.id !== d.id).map((ep) => ({
                  value: ep.id,
                  label: `⚡ #${ep.number} ${ep.title}`,
                  searchValue: `${ep.number} ${ep.title}`,
                })),
              ]}
              placeholder="Select epic..."
              searchPlaceholder="Search epic..."
              emptyMessage="No matches"
              className="h-8"
            />
          )}
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

/** Date row using the shared popover-based picker. Single commit when the
 *  user clicks a day or "Clear" — no per-segment activity spam from the
 *  legacy native <input type="date"> path. */
function DateField({
  label,
  fieldId,
  value,
  onChange,
}: {
  label: string
  fieldId: string
  value: string | null
  onChange: (next: string | null) => void
}) {
  const display = value
    ? <span className="text-gray-700 dark:text-gray-300">{new Date(value).toLocaleDateString()}</span>
    : <span className="text-gray-400 italic">{`No ${label.toLowerCase()}`}</span>

  return (
    <div className="flex items-center gap-2 py-1.5">
      <span className="w-20 shrink-0 text-xs font-medium text-gray-400 dark:text-gray-500">{label}</span>
      <div className="flex-1">
        <DatePopover value={value} onChange={onChange}>
          <button
            data-field-trigger={fieldId}
            className="flex w-full items-center justify-between rounded px-1.5 py-0.5 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition -mx-1.5"
          >
            {display}
          </button>
        </DatePopover>
      </div>
    </div>
  )
}
