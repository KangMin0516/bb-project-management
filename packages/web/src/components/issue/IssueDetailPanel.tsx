import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { issueApi, uploadApi, type Issue, type UpdateIssuePayload, type CreateIssuePayload } from '@/api/issues'
import { projectApi } from '@/api/projects'
import { componentApi } from '@/api/components'
import { STATUSES, STATUS_LABELS, PRIORITY_COLORS } from '@/lib/constants'
import type { ShareContext } from '@/lib/types'
import { useToastStore } from '@/stores/toast'
import { getErrorMessage } from '@/lib/error'
import { Trash2, Link2, ChevronsLeft, ChevronsRight } from 'lucide-react'
import { copyIssueLink } from '@/components/issue/IssueActionMenu'
import MarkdownViewer from '@/components/markdown/MarkdownViewer'
import TipTapEditor from '@/components/editor/TipTapEditor'
import ActivityTab from '@/components/issue/ActivityTab'
import AttachmentItem from '@/components/issue/AttachmentItem'
import LinkedIssues from '@/components/issue/LinkedIssues'

interface IssueDetailPanelProps {
  projectId: string
  projectKey: string
  issue: Issue
  context?: ShareContext
  onClose: () => void
  onNavigate: (issue: Issue) => void
}

/** Click-to-edit inline field */
function InlineField({ label, display, children }: { label: string; display: React.ReactNode; children: React.ReactNode }) {
  const [editing, setEditing] = useState(false)
  return (
    <div className="flex items-center gap-2 py-1.5">
      <span className="w-20 shrink-0 text-xs font-medium text-gray-400">{label}</span>
      {editing ? (
        <div className="flex-1" onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) {
            setEditing(false)
          }
        }}>
          {children}
        </div>
      ) : (
        <button
          onClick={() => setEditing(true)}
          className="flex-1 rounded px-1.5 py-0.5 text-left text-sm text-gray-700 hover:bg-gray-50 transition -mx-1.5"
        >
          {display}
        </button>
      )}
    </div>
  )
}

export default function IssueDetailPanel({
  projectId,
  projectKey,
  issue,
  context,
  onClose,
  onNavigate,
}: IssueDetailPanelProps) {
  const [expanded, setExpanded] = useState(() => localStorage.getItem('issue-panel-expanded') === 'true')
  const [activeTab, setActiveTab] = useState<'details' | 'activity'>('details')
  const [editingDescription, setEditingDescription] = useState(false)
  const [draftDescription, setDraftDescription] = useState('')
  const [showSubtaskInput, setShowSubtaskInput] = useState(false)
  const [subtaskTitle, setSubtaskTitle] = useState('')

  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (editingDescription) {
          setEditingDescription(false)
        } else {
          onCloseRef.current()
        }
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [editingDescription])

  const { data: detail } = useQuery({
    queryKey: ['issue', projectId, issue.id],
    queryFn: () => issueApi.get(projectId, issue.id),
  })

  const { data: members } = useQuery({
    queryKey: ['members', projectId],
    queryFn: () => projectApi.listMembers(projectId),
  })

  const { data: projectLabels } = useQuery({
    queryKey: ['labels', projectId],
    queryFn: () => projectApi.listLabels(projectId),
  })

  const { data: projectComponents } = useQuery({
    queryKey: ['components', projectId],
    queryFn: () => componentApi.list(projectId),
  })

  const queryClient = useQueryClient()
  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['board', projectId] })
    queryClient.invalidateQueries({ queryKey: ['issues', projectId] })
    queryClient.invalidateQueries({ queryKey: ['issue', projectId, issue.id] })
  }

  const updateMutation = useMutation({
    mutationFn: (data: UpdateIssuePayload) => issueApi.update(projectId, issue.id, data),
    onSuccess: invalidateAll,
    onError: (err: unknown) => {
      useToastStore.getState().addToast(getErrorMessage(err, 'Failed to update issue'))
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () => issueApi.delete(projectId, issue.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['board', projectId] })
      queryClient.invalidateQueries({ queryKey: ['issues', projectId] })
      onClose()
    },
    onError: (err: unknown) => {
      useToastStore.getState().addToast(getErrorMessage(err, 'Failed to delete issue'))
    },
  })

  const uploadMutation = useMutation({
    mutationFn: (file: File) => uploadApi.upload(file, { issueId: issue.id }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['issue', projectId, issue.id] }),
    onError: (err: unknown) => {
      useToastStore.getState().addToast(getErrorMessage(err, 'Failed to upload file'))
    },
  })

  const deleteAttachmentMutation = useMutation({
    mutationFn: (id: string) => uploadApi.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['issue', projectId, issue.id] }),
    onError: (err: unknown) => {
      useToastStore.getState().addToast(getErrorMessage(err, 'Failed to delete file'))
    },
  })

  const createSubtaskMutation = useMutation({
    mutationFn: (data: CreateIssuePayload) => issueApi.create(projectId, data),
    onSuccess: () => {
      invalidateAll()
      setSubtaskTitle('')
      setShowSubtaskInput(false)
    },
    onError: (err: unknown) => {
      useToastStore.getState().addToast(getErrorMessage(err, 'Failed to create sub-task'))
    },
  })

  const d = detail ?? issue
  const labels = d.labels ?? []
  const components = d.components ?? []
  const linkCount = (detail?.sourceLinks?.length ?? 0) + (detail?.specLinks?.length ?? 0)

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30" role="dialog" aria-modal="true" onClick={onClose}>
      <div
        className={`flex h-full w-full flex-col bg-white shadow-xl transition-[max-width] duration-200 ${expanded ? 'max-w-4xl' : 'max-w-lg'}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="shrink-0 border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <span className="font-mono text-sm text-gray-400">
              {issue.number ? `#${issue.number}` : ''}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => copyIssueLink(projectKey, d.number, context)}
                aria-label="Copy link"
                className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                title="Copy link"
              >
                <Link2 className="h-4 w-4" />
              </button>
              <button
                onClick={() => {
                  const next = !expanded
                  setExpanded(next)
                  localStorage.setItem('issue-panel-expanded', String(next))
                }}
                aria-label={expanded ? 'Collapse panel' : 'Expand panel'}
                className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                title={expanded ? 'Collapse' : 'Expand'}
              >
                {expanded ? <ChevronsLeft className="h-4 w-4" /> : <ChevronsRight className="h-4 w-4" />}
              </button>
              <button
                onClick={() => {
                  if (confirm('Are you sure you want to delete this issue? This cannot be undone.')) {
                    deleteMutation.mutate()
                  }
                }}
                aria-label="Delete issue"
                className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-red-500"
                title="Delete issue"
              >
                <Trash2 className="h-4 w-4" />
              </button>
              <button onClick={onClose} aria-label="Close" className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600">✕</button>
            </div>
          </div>
          {detail?.parent && (
            <p className="mt-1 text-xs text-gray-400">
              <button
                onClick={() => {
                  const parent = detail.parent!
                  issueApi.get(projectId, parent.id).then(
                    (fullIssue) => onNavigate(fullIssue),
                    (err) => useToastStore.getState().addToast(getErrorMessage(err, 'Failed to load issue')),
                  )
                }}
                className="hover:text-primary-600 hover:underline"
              >
                #{detail.parent.number} {detail.parent.title}
              </button>
              <span className="mx-1">&gt;</span>
              <span>#{d.number} {d.title}</span>
            </p>
          )}
          <h2 className="mt-1 text-xl font-bold text-gray-900">{d.title}</h2>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto">
          {/* Compact metadata (scrolls away) */}
          <div className="divide-y divide-gray-100 rounded-lg border border-gray-100 bg-gray-50/50 px-3 mx-6 mt-4">
            <InlineField
              label="Status"
              display={
                <span className="rounded bg-gray-200 px-1.5 py-0.5 text-xs font-medium">
                  {STATUS_LABELS[d.status] || d.status}
                </span>
              }
            >
              <select
                value={d.status}
                onChange={(e) => updateMutation.mutate({ status: e.target.value })}
                className="w-full rounded border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
                autoFocus
              >
                {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s] || s}</option>)}
              </select>
            </InlineField>

            <InlineField
              label="Priority"
              display={
                <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${PRIORITY_COLORS[d.priority] || ''}`}>
                  {d.priority}
                </span>
              }
            >
              <select
                value={d.priority}
                onChange={(e) => updateMutation.mutate({ priority: e.target.value })}
                className="w-full rounded border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
                autoFocus
              >
                {['HIGH', 'MEDIUM', 'LOW'].map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </InlineField>

            <InlineField
              label="Assignee"
              display={<span className={d.assignee ? 'text-gray-700' : 'text-gray-400 italic'}>{d.assignee?.name || 'Unassigned'}</span>}
            >
              <select
                value={d.assigneeId || ''}
                onChange={(e) => updateMutation.mutate({ assigneeId: e.target.value || null })}
                className="w-full rounded border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
                autoFocus
              >
                <option value="">Unassigned</option>
                {members?.map((m) => (
                  <option key={m.user.id} value={m.user.id}>{m.user.name}</option>
                ))}
              </select>
            </InlineField>

            <InlineField
              label="Due Date"
              display={
                d.dueDate
                  ? <span className="text-gray-700">{new Date(d.dueDate).toLocaleDateString()}</span>
                  : <span className="text-gray-400 italic">No due date</span>
              }
            >
              <div className="flex items-center gap-1">
                <input
                  type="date"
                  value={d.dueDate ? d.dueDate.slice(0, 10) : ''}
                  onChange={(e) => updateMutation.mutate({ dueDate: e.target.value ? `${e.target.value}T00:00:00.000Z` : null })}
                  className="rounded border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
                  autoFocus
                />
                {d.dueDate && (
                  <button
                    onClick={() => updateMutation.mutate({ dueDate: null })}
                    className="text-gray-400 hover:text-gray-600 text-sm px-1"
                  >
                    ✕
                  </button>
                )}
              </div>
            </InlineField>

            <div className="flex items-start gap-2 py-1.5">
              <span className="w-20 shrink-0 pt-0.5 text-xs font-medium text-gray-400">Labels</span>
              <div className="flex flex-1 flex-wrap gap-1">
                {(projectLabels || []).map((label) => {
                  const isSelected = labels.some((l) => l.label.id === label.id)
                  return (
                    <button
                      key={label.id}
                      onClick={() => {
                        const currentIds = labels.map((l) => l.label.id)
                        const nextIds = isSelected
                          ? currentIds.filter((id) => id !== label.id)
                          : [...currentIds, label.id]
                        updateMutation.mutate({ labelIds: nextIds })
                      }}
                      className={`rounded-full px-2 py-0.5 text-[10px] font-medium border transition-colors ${
                        isSelected ? 'ring-1 ring-offset-1' : 'opacity-30 hover:opacity-70'
                      }`}
                      style={{
                        backgroundColor: label.color + (isSelected ? '20' : '10'),
                        color: label.color,
                        borderColor: label.color + '40',
                      }}
                    >
                      {label.name}
                    </button>
                  )
                })}
                {(!projectLabels || projectLabels.length === 0) && (
                  <span className="text-xs text-gray-400 italic">No labels</span>
                )}
              </div>
            </div>

            {projectComponents && projectComponents.length > 0 && (
              <div className="flex items-start gap-2 py-1.5">
                <span className="w-20 shrink-0 pt-0.5 text-xs font-medium text-gray-400">Components</span>
                <div className="flex flex-1 flex-wrap gap-1">
                  {projectComponents.map((comp) => {
                    const isSelected = components.some((ic) => ic.component.id === comp.id)
                    return (
                      <button
                        key={comp.id}
                        onClick={() => {
                          const currentIds = components.map((ic) => ic.component.id)
                          const nextIds = isSelected
                            ? currentIds.filter((id) => id !== comp.id)
                            : [...currentIds, comp.id]
                          updateMutation.mutate({ componentIds: nextIds })
                        }}
                        className={`rounded-full px-2 py-0.5 text-[10px] font-medium border transition-colors ${
                          isSelected
                            ? 'bg-blue-100 text-blue-700 border-blue-400 ring-1 ring-blue-400 ring-offset-1'
                            : 'bg-gray-100 text-gray-500 border-transparent opacity-30 hover:opacity-70'
                        }`}
                      >
                        {comp.name}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Sticky Tabs */}
          <div className="sticky top-0 z-10 flex gap-4 border-b border-gray-200 bg-white px-6 pt-4">
            {(['details', 'activity'] as const).map((tab) => {
              let label: string = tab === 'details' ? `Details${linkCount > 0 ? ` · ${linkCount}` : ''}` : tab
              if (tab === 'activity' && detail) label = `Activity (${detail.activities.length})`
              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`pb-2 text-sm font-medium capitalize transition-colors ${
                    activeTab === tab
                      ? 'border-b-2 border-primary-600 text-primary-600'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {label}
                </button>
              )
            })}
          </div>

          {activeTab === 'details' && (
          <div className="space-y-5 p-6">
            {/* Description */}
            <div>
              <span className="block text-xs font-medium text-gray-500 mb-1">Description</span>
              {editingDescription ? (
                <div>
                  <TipTapEditor
                    content={draftDescription}
                    onChange={setDraftDescription}
                    placeholder="Add description..."
                    minHeight="150px"
                  />
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        updateMutation.mutate({ description: draftDescription })
                        setEditingDescription(false)
                      }}
                      className="rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-700"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingDescription(false)}
                      className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  onClick={() => {
                    setDraftDescription(d.description || '')
                    setEditingDescription(true)
                  }}
                  className="group cursor-pointer rounded-lg border border-transparent p-2 -m-2 hover:border-gray-200 hover:bg-gray-50"
                >
                  {d.description ? (
                    <MarkdownViewer content={d.description} />
                  ) : (
                    <p className="text-sm text-gray-400 italic">Add description...</p>
                  )}
                </div>
              )}
            </div>

            {/* Attachments */}
            <div>
              <span className="block text-xs font-medium text-gray-500 mb-1">
                Attachments {detail?.attachments?.length ? `(${detail.attachments.length})` : ''}
              </span>
              {detail?.attachments && detail.attachments.length > 0 && (
                <div className="space-y-1 mb-2">
                  {detail.attachments.map((att) => (
                    <AttachmentItem key={att.id} attachment={att} onDelete={(id) => deleteAttachmentMutation.mutate(id)} />
                  ))}
                </div>
              )}
              <label className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50">
                <input
                  type="file"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) uploadMutation.mutate(file)
                    e.target.value = ''
                  }}
                />
                {uploadMutation.isPending ? 'Uploading...' : '+ Add file'}
              </label>
            </div>

            {/* Sub-tasks */}
            <div>
              <span className="block text-xs font-medium text-gray-500 mb-1">
                Sub-tasks {detail && detail.children.length > 0 ? `(${detail.children.length})` : ''}
              </span>
              {detail && detail.children.length > 0 && (
                <div className="space-y-1 mb-2">
                  {detail.children.map((child) => (
                    <button
                      key={child.id}
                      onClick={() => {
                        issueApi.get(projectId, child.id).then(
                          (fullIssue) => onNavigate(fullIssue),
                          (err) => useToastStore.getState().addToast(getErrorMessage(err, 'Failed to load issue')),
                        )
                      }}
                      className="flex w-full items-center gap-2 rounded bg-gray-50 px-2 py-1.5 text-sm hover:bg-gray-100 transition-colors text-left"
                    >
                      <span className="font-mono text-xs text-gray-400">#{child.number}</span>
                      <span className="flex-1 truncate">{child.title}</span>
                      <span className="rounded bg-gray-200 px-1.5 py-0.5 text-[10px]">{child.status}</span>
                    </button>
                  ))}
                </div>
              )}
              {showSubtaskInput ? (
                <div className="flex gap-1.5">
                  <input
                    value={subtaskTitle}
                    onChange={(e) => setSubtaskTitle(e.target.value)}
                    placeholder="Sub-task title"
                    className="flex-1 rounded border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && subtaskTitle.trim()) {
                        createSubtaskMutation.mutate({ title: subtaskTitle, type: 'SUB_TASK', parentId: issue.id })
                      }
                      if (e.key === 'Escape') { setShowSubtaskInput(false); setSubtaskTitle('') }
                    }}
                  />
                  <button
                    onClick={() => createSubtaskMutation.mutate({ title: subtaskTitle, type: 'SUB_TASK', parentId: issue.id })}
                    disabled={!subtaskTitle.trim() || createSubtaskMutation.isPending}
                    className="rounded bg-primary-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-primary-700 disabled:opacity-50"
                  >
                    {createSubtaskMutation.isPending ? '...' : 'Add'}
                  </button>
                  <button
                    onClick={() => { setShowSubtaskInput(false); setSubtaskTitle('') }}
                    className="rounded border border-gray-300 px-2 py-1.5 text-xs text-gray-500 hover:bg-gray-50"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowSubtaskInput(true)}
                  className="text-xs text-gray-400 hover:text-primary-600"
                >
                  + Add sub-task
                </button>
              )}
            </div>

            {/* Links (merged from Links tab) */}
            {detail && (
              <div>
                <LinkedIssues
                  projectId={projectId}
                  issueId={issue.id}
                  sourceLinks={detail.sourceLinks}
                  targetLinks={detail.targetLinks}
                  specLinks={detail.specLinks}
                />
              </div>
            )}
          </div>
          )}

          {activeTab === 'activity' && (
          <ActivityTab projectId={projectId} issueId={issue.id} activities={detail?.activities || []} members={members || []} />
          )}
        </div>
      </div>
    </div>
  )
}
