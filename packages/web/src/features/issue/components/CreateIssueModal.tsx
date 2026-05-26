import { useState, useEffect, useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { type CreateIssuePayload } from '@/features/issue/api'
import { templateApi } from '@/features/template/api'
import { projectRepository } from '@/features/project/repository'
import { componentApi } from '@/features/project/component-api'
import { useAuthStore } from '@/features/auth/store'
import TipTapEditor from '@/shared/ui/editor/TipTapEditor'
import MentionableEditor from '@/shared/ui/editor/MentionableEditor'
import { useToastStore } from '@/shared/lib/toast'
import { getErrorMessage } from '@/shared/lib/error'
import { issueRepository } from '@/features/issue/repository'
import { useDeferredClose } from '@/shared/lib/useDeferredClose'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/ui/select'
import Combobox from '@/shared/ui/combobox'
import UserAvatar from '@/entities/user/UserAvatar'

interface CreateIssueModalProps {
  projectId: string
  defaultStatus?: string
  /** Pre-select Parent Issue (e.g. when "+" is clicked on a swimlane). */
  defaultParentId?: string
  /** Pre-select Type (e.g. when Table of Content "+ Add Module" is clicked). */
  defaultType?: 'DOMAIN' | 'EPIC' | 'TASK' | 'BUG' | 'SUB_TASK'
  onClose: () => void
  onCreated?: (issueId: string) => void
}

/** Sentinel values — Radix Select rejects empty string item values. */
const UNASSIGNED = '__unassigned__'
const NO_PARENT = '__none__'
const NO_REVIEWER = '__no_reviewer__'
const CREATE_ISSUE_DRAFT_VERSION = 1

interface CreateIssueDraft {
  version: number
  title: string
  description: string
  priority: string
  type: string
  assigneeId: string
  reviewerAssigneeId: string | null
  labelIds: string[]
  componentIds: string[]
  parentId: string
}

export default function CreateIssueModal({ projectId, defaultStatus, defaultParentId, defaultType, onClose, onCreated }: CreateIssueModalProps) {
  const { open, requestClose } = useDeferredClose(onClose)
  // PM-81: default Reviewer = creator (current user). User can clear to
  // "No reviewer" via the picker, in which case we send explicit null so
  // the BE honours the opt-out instead of defaulting again.
  const currentUserId = useAuthStore((s) => s.user?.id) ?? ''

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState('MEDIUM')
  const [type, setType] = useState<string>(defaultType ?? 'TASK')
  const [assigneeId, setAssigneeId] = useState('')
  /** `null` = explicit "No reviewer" (opt-out). Empty string = use default. */
  const [reviewerAssigneeId, setReviewerAssigneeId] = useState<string | null>(currentUserId)
  const [labelIds, setLabelIds] = useState<string[]>([])
  const [componentIds, setComponentIds] = useState<string[]>([])
  const [parentId, setParentId] = useState(defaultParentId ?? '')
  const [mentionedUserIds, setMentionedUserIds] = useState<string[]>([])
  const [draftHydrated, setDraftHydrated] = useState(false)
  const queryClient = useQueryClient()
  const draftStorageKey = useMemo(() => `create-issue-draft:${projectId}`, [projectId])

  const { data: members } = useQuery({
    queryKey: ['members', projectId],
    queryFn: () => projectRepository.listMembers(projectId),
  })

  const { data: labels } = useQuery({
    queryKey: ['labels', projectId],
    queryFn: () => projectRepository.listLabels(projectId),
  })

  const { data: components } = useQuery({
    queryKey: ['components', projectId],
    queryFn: () => componentApi.list(projectId),
  })

  const { data: issuesData } = useQuery({
    queryKey: ['issues', projectId, 'parent-options'],
    queryFn: () => issueRepository.findInProjectRaw(projectId, { limit: '200' }),
  })

  const { data: templates } = useQuery({
    queryKey: ['templates'],
    queryFn: templateApi.list,
  })

  // Auto-fill description from template when type changes — but only as
  // long as the user hasn't typed anything. Once the user edits the
  // description the touched flag latches true and we never overwrite
  // their input, even across subsequent type changes.
  const [descriptionTouched, setDescriptionTouched] = useState(false)

  useEffect(() => {
    const raw = localStorage.getItem(draftStorageKey)
    if (!raw) {
      setDraftHydrated(true)
      return
    }
    try {
      const parsed = JSON.parse(raw) as CreateIssueDraft
      if (parsed.version !== CREATE_ISSUE_DRAFT_VERSION) {
        localStorage.removeItem(draftStorageKey)
        setDraftHydrated(true)
        return
      }
      setTitle(parsed.title || '')
      setDescription(parsed.description || '')
      setPriority(parsed.priority || 'MEDIUM')
      setType(parsed.type || (defaultType ?? 'TASK'))
      setAssigneeId(parsed.assigneeId || '')
      setReviewerAssigneeId(parsed.reviewerAssigneeId ?? currentUserId)
      setLabelIds(Array.isArray(parsed.labelIds) ? parsed.labelIds : [])
      setComponentIds(Array.isArray(parsed.componentIds) ? parsed.componentIds : [])
      setParentId(parsed.parentId || '')
      setDescriptionTouched(Boolean(parsed.description))
    } catch {
      localStorage.removeItem(draftStorageKey)
    } finally {
      setDraftHydrated(true)
    }
  }, [currentUserId, defaultType, draftStorageKey])

  useEffect(() => {
    if (!draftHydrated) return
    if (descriptionTouched) return
    const match = templates?.find((t) => t.type === type)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (match?.description) setDescription(match.description)
    else setDescription('')
  }, [type, templates, descriptionTouched, draftHydrated])

  useEffect(() => {
    if (!draftHydrated) return
    const draft: CreateIssueDraft = {
      version: CREATE_ISSUE_DRAFT_VERSION,
      title,
      description,
      priority,
      type,
      assigneeId,
      reviewerAssigneeId,
      labelIds,
      componentIds,
      parentId,
    }
    localStorage.setItem(draftStorageKey, JSON.stringify(draft))
  }, [
    assigneeId,
    componentIds,
    description,
    draftHydrated,
    draftStorageKey,
    labelIds,
    parentId,
    priority,
    reviewerAssigneeId,
    title,
    type,
  ])

  const parentOptions = useMemo(() => {
    if (!issuesData?.items) return []
    if (type === 'DOMAIN') {
      // DOMAIN is top-level — never has a parent.
      return []
    }
    if (type === 'EPIC') {
      // EPIC's only valid parent is a DOMAIN (4-level hierarchy).
      return issuesData.items.filter((i) => i.type === 'DOMAIN')
    }
    if (type === 'SUB_TASK') {
      // Sub-task can pick any non-SUB_TASK / non-DOMAIN as parent.
      return issuesData.items.filter((i) => i.type !== 'SUB_TASK' && i.type !== 'DOMAIN')
    }
    // TASK/BUG can only pick EPIC as parent.
    return issuesData.items.filter((i) => i.type === 'EPIC')
  }, [issuesData, type])

  const mutation = useMutation({
    mutationFn: (data: CreateIssuePayload) => issueRepository.create(projectId, data),
    onSuccess: (data) => {
      localStorage.removeItem(draftStorageKey)
      queryClient.invalidateQueries({ queryKey: ['board', projectId] })
      queryClient.invalidateQueries({ queryKey: ['issues', projectId] })
      onCreated?.(data.id)
      requestClose()
    },
    onError: (err: unknown) => {
      useToastStore.getState().addToast(getErrorMessage(err, 'Failed to create issue'), 'error')
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    mutation.mutate({
      title,
      description: description || undefined,
      status: defaultStatus,
      priority,
      type,
      assigneeId: assigneeId || undefined,
      // PM-81: send explicit null when user picked "No reviewer", omit
      // otherwise so the BE applies the creator-default. Sending undefined
      // ≠ sending null in the payload — keep them distinct.
      reviewerAssigneeId:
        reviewerAssigneeId === null
          ? null
          : reviewerAssigneeId || undefined,
      parentId: parentId || undefined,
      labelIds: labelIds.length ? labelIds : undefined,
      componentIds: componentIds.length ? componentIds : undefined,
      mentionedUserIds:
        description && mentionedUserIds.length ? mentionedUserIds : undefined,
    })
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) requestClose() }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Issue</DialogTitle>
          <DialogDescription className="sr-only">Form to create a new issue</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Issue title"
            className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none"
            autoFocus
            required
          />

          {members && members.length > 0 ? (
            <MentionableEditor
              content={description}
              onChange={(v) => { setDescription(v); setDescriptionTouched(true) }}
              members={members}
              placeholder="Description (optional, @ to mention)"
              minHeight="100px"
              onMentionsChange={setMentionedUserIds}
            />
          ) : (
            <TipTapEditor
              content={description}
              onChange={(v) => { setDescription(v); setDescriptionTouched(true) }}
              placeholder="Description (optional)"
              minHeight="100px"
            />
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">Type</label>
              <Select value={type} onValueChange={(v) => { setType(v); setParentId('') }}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TASK">Task</SelectItem>
                  <SelectItem value="BUG">Bug</SelectItem>
                  <SelectItem value="EPIC">Epic</SelectItem>
                  <SelectItem value="DOMAIN">Module</SelectItem>
                  <SelectItem value="SUB_TASK">Sub-task</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">Priority</label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="HIGH">High</SelectItem>
                  <SelectItem value="MEDIUM">Medium</SelectItem>
                  <SelectItem value="LOW">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">Assignee</label>
            <Combobox
              value={assigneeId || UNASSIGNED}
              onChange={(v) => setAssigneeId(v === UNASSIGNED ? '' : v)}
              options={[
                { value: UNASSIGNED, label: 'Unassigned' },
                ...(members ?? []).map((m) => ({
                  value: m.user.id,
                  label: m.user.name,
                  searchValue: `${m.user.name} ${m.user.email}`,
                  // List rows show the full identity (stacked).
                  render: (
                    <span className="flex items-center gap-2">
                      <UserAvatar user={m.user} size="sm" />
                      <span className="flex flex-col leading-tight">
                        <span className="text-sm">{m.user.name}</span>
                        <span className="text-[10px] text-gray-400 dark:text-gray-500">{m.user.email}</span>
                      </span>
                    </span>
                  ),
                  // Trigger stays compact — avatar + name on one line,
                  // so the input doesn't grow taller and the content
                  // hugs the left edge instead of looking centred.
                  triggerRender: (
                    <span className="flex items-center gap-2">
                      <UserAvatar user={m.user} size="sm" />
                      <span className="text-sm">{m.user.name}</span>
                    </span>
                  ),
                })),
              ]}
              placeholder="Unassigned"
              searchPlaceholder="Search member..."
              emptyMessage="No matches"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">Reviewer</label>
            <Combobox
              value={reviewerAssigneeId ?? NO_REVIEWER}
              onChange={(v) => setReviewerAssigneeId(v === NO_REVIEWER ? null : v)}
              options={[
                { value: NO_REVIEWER, label: 'No reviewer' },
                ...(members ?? []).map((m) => ({
                  value: m.user.id,
                  label: m.user.name,
                  searchValue: `${m.user.name} ${m.user.email}`,
                  render: (
                    <span className="flex items-center gap-2">
                      <UserAvatar user={m.user} size="sm" />
                      <span className="flex flex-col leading-tight">
                        <span className="text-sm">{m.user.name}</span>
                        <span className="text-[10px] text-gray-400 dark:text-gray-500">{m.user.email}</span>
                      </span>
                    </span>
                  ),
                  triggerRender: (
                    <span className="flex items-center gap-2">
                      <UserAvatar user={m.user} size="sm" />
                      <span className="text-sm">{m.user.name}</span>
                    </span>
                  ),
                })),
              ]}
              placeholder="No reviewer"
              searchPlaceholder="Search member..."
              emptyMessage="No matches"
            />
          </div>

          {type !== 'EPIC' && type !== 'DOMAIN' && (
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">
                Parent Issue{type === 'SUB_TASK' ? ' *' : ''}
              </label>
              <Combobox
                value={parentId || NO_PARENT}
                onChange={(v) => setParentId(v === NO_PARENT ? '' : v)}
                options={[
                  { value: NO_PARENT, label: 'None' },
                  ...parentOptions.map((issue) => ({
                    value: issue.id,
                    label: `#${issue.number} ${issue.title}`,
                    searchValue: `${issue.number} ${issue.title}`,
                  })),
                ]}
                placeholder="Select parent..."
                searchPlaceholder={type === 'SUB_TASK' ? 'Search issue...' : 'Search epic...'}
                emptyMessage="No matches"
              />
            </div>
          )}

          {type === 'EPIC' && (
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">
                Parent Module
              </label>
              <Combobox
                value={parentId || NO_PARENT}
                onChange={(v) => setParentId(v === NO_PARENT ? '' : v)}
                options={[
                  { value: NO_PARENT, label: 'None (unassigned)' },
                  ...parentOptions.map((issue) => ({
                    value: issue.id,
                    label: `📁 ${issue.title}`,
                    searchValue: issue.title,
                  })),
                ]}
                placeholder="Select module..."
                searchPlaceholder="Search module..."
                emptyMessage="No modules yet"
              />
            </div>
          )}

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">Labels</label>
            <div className="flex flex-wrap gap-1.5">
              {labels?.map((label) => {
                const selected = labelIds.includes(label.id)
                return (
                  <button
                    key={label.id}
                    type="button"
                    onClick={() =>
                      setLabelIds((ids) =>
                        ids.includes(label.id) ? ids.filter((id) => id !== label.id) : [...ids, label.id],
                      )
                    }
                    className={selected
                      ? 'rounded-full border px-2.5 py-1 text-xs font-medium transition'
                      : 'rounded-full border border-transparent bg-gray-100 dark:bg-gray-700 px-2.5 py-1 text-xs font-medium text-gray-600 dark:text-gray-300 transition hover:bg-gray-200 dark:hover:bg-gray-600'}
                    style={selected
                      ? { backgroundColor: label.color + '30', color: label.color, borderColor: label.color }
                      : undefined}
                  >
                    {label.name}
                  </button>
                )
              })}
            </div>
          </div>

          {components && components.length > 0 && (
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">Components</label>
              <div className="flex flex-wrap gap-1.5">
                {components.map((comp) => (
                  <button
                    key={comp.id}
                    type="button"
                    onClick={() =>
                      setComponentIds((ids) =>
                        ids.includes(comp.id) ? ids.filter((id) => id !== comp.id) : [...ids, comp.id],
                      )
                    }
                    className={`rounded-full px-2.5 py-1 text-xs font-medium transition ${
                      componentIds.includes(comp.id)
                        ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border border-blue-400'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 border border-transparent'
                    }`}
                  >
                    {comp.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => {
                localStorage.removeItem(draftStorageKey)
                requestClose()
              }}
              className="rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
            >
              {mutation.isPending ? 'Creating...' : 'Create'}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
