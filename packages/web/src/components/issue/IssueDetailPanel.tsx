import { useState, useEffect, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { issueApi, uploadApi, type Issue, type IssueDetail, type Attachment, type Activity, type Comment, type UpdateIssuePayload } from '@/api/issues'
import { projectApi, type ProjectMember } from '@/api/projects'
import { componentApi } from '@/api/components'
import { STATUSES } from '@/lib/constants'
import { useToastStore } from '@/stores/toast'
import { useAuthStore } from '@/stores/auth'
import { getErrorMessage } from '@/lib/error'
import { Trash2, Link2 } from 'lucide-react'
import { copyIssueLink, type ShareContext } from '@/components/issue/IssueActionMenu'
import MarkdownViewer from '@/components/markdown/MarkdownViewer'
import MarkdownEditor from '@/components/markdown/MarkdownEditor'
import CommentInput from '@/components/comment/CommentInput'
import CommentItem from '@/components/comment/CommentItem'
import ActivityTimeline from '@/components/activity/ActivityTimeline'
import LinkedIssues from '@/components/issue/LinkedIssues'

interface IssueDetailPanelProps {
  projectId: string
  projectKey: string
  issue: Issue
  context?: ShareContext
  onClose: () => void
  onNavigate: (issue: Issue) => void
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

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (editingDescription) {
          setEditingDescription(false)
        } else {
          onClose()
        }
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose, editingDescription])

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
  const updateMutation = useMutation({
    mutationFn: (data: UpdateIssuePayload) => issueApi.update(projectId, issue.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['board', projectId] })
      queryClient.invalidateQueries({ queryKey: ['issues', projectId] })
      queryClient.invalidateQueries({ queryKey: ['issue', projectId, issue.id] })
    },
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['issue', projectId, issue.id] })
    },
    onError: (err: unknown) => {
      useToastStore.getState().addToast(getErrorMessage(err, 'Failed to upload file'))
    },
  })

  const deleteAttachmentMutation = useMutation({
    mutationFn: (id: string) => uploadApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['issue', projectId, issue.id] })
    },
    onError: (err: unknown) => {
      useToastStore.getState().addToast(getErrorMessage(err, 'Failed to delete file'))
    },
  })

  const d: Issue | IssueDetail = detail || issue

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30" role="dialog" aria-modal="true" onClick={onClose}>
      <div
        className={`h-full w-full overflow-y-auto bg-white shadow-xl transition-[max-width] duration-200 ${expanded ? 'max-w-4xl' : 'max-w-lg'}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-gray-200 px-6 py-4">
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
                className="text-gray-400 hover:text-gray-600"
                title={expanded ? 'Collapse' : 'Expand'}
              >
                {expanded ? (
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="11 19 2 12 11 5" /><polyline points="22 19 13 12 22 5" /></svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="13 5 22 12 13 19" /><polyline points="2 5 11 12 2 19" /></svg>
                )}
              </button>
              <button
                onClick={() => {
                  if (confirm('Are you sure you want to delete this issue? This cannot be undone.')) {
                    deleteMutation.mutate()
                  }
                }}
                aria-label="Delete issue"
                className="text-gray-400 hover:text-red-500"
                title="Delete issue"
              >
                <Trash2 className="h-4 w-4" />
              </button>
              <button onClick={onClose} aria-label="Close" className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
          </div>
          {d.parent && (
            <p className="mt-1 text-xs text-gray-400">
              <button
                onClick={() => onNavigate({ id: d.parent!.id, number: d.parent!.number, title: d.parent!.title } as Issue)}
                className="hover:text-primary-600 hover:underline"
              >
                #{d.parent.number} {d.parent.title}
              </button>
              <span className="mx-1">&gt;</span>
              <span>#{d.number} {d.title}</span>
            </p>
          )}
          <h2 className="mt-1 text-xl font-bold text-gray-900">{d.title}</h2>
          <div className="mt-3 flex gap-4 border-b border-gray-200 -mb-4">
            {(['details', 'activity'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`pb-2 text-sm font-medium capitalize transition-colors ${
                  activeTab === tab
                    ? 'border-b-2 border-primary-600 text-primary-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab === 'activity' && detail ? `Activity (${detail.activities.length})` : tab}
              </button>
            ))}
          </div>
        </div>

        {activeTab === 'details' && (
        <div className="space-y-4 p-6">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="block text-xs font-medium text-gray-500 mb-1">Status</span>
              <select
                value={d.status}
                onChange={(e) => updateMutation.mutate({ status: e.target.value })}
                className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
              >
                {STATUSES.map(
                  (s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>,
                )}
              </select>
            </div>
            <div>
              <span className="block text-xs font-medium text-gray-500 mb-1">Priority</span>
              <select
                value={d.priority}
                onChange={(e) => updateMutation.mutate({ priority: e.target.value })}
                className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
              >
                {['HIGH', 'MEDIUM', 'LOW'].map(
                  (p) => <option key={p} value={p}>{p}</option>,
                )}
              </select>
            </div>
          </div>

          <div>
            <span className="block text-xs font-medium text-gray-500 mb-1">Description</span>
            {editingDescription ? (
              <div>
                <MarkdownEditor
                  value={draftDescription}
                  onChange={setDraftDescription}
                  placeholder="Add description..."
                  minRows={6}
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

          <div>
            <span className="block text-xs font-medium text-gray-500 mb-1">Assignee</span>
            <select
              value={d.assigneeId || ''}
              onChange={(e) => updateMutation.mutate({ assigneeId: e.target.value || null })}
              className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
            >
              <option value="">Unassigned</option>
              {members?.map((m) => (
                <option key={m.user.id} value={m.user.id}>{m.user.name}</option>
              ))}
            </select>
          </div>

          <div>
            <span className="block text-xs font-medium text-gray-500 mb-1">Creator</span>
            <span className="text-sm text-gray-700">{d.creator?.name}</span>
          </div>

          <div>
            <span className="block text-xs font-medium text-gray-500 mb-1">Due Date</span>
            <div className="flex items-center gap-1">
              <input
                type="date"
                value={d.dueDate ? d.dueDate.slice(0, 10) : ''}
                onChange={(e) => updateMutation.mutate({ dueDate: e.target.value || null })}
                className="rounded border border-gray-300 px-2 py-1.5 text-sm"
              />
              {d.dueDate && (
                <button
                  onClick={() => updateMutation.mutate({ dueDate: null })}
                  className="text-gray-400 hover:text-gray-600 text-sm px-1"
                  title="Clear due date"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          <div>
            <span className="block text-xs font-medium text-gray-500 mb-1">Labels</span>
            <div className="flex flex-wrap gap-1">
              {(projectLabels || []).map((label) => {
                const isSelected = d.labels.some((l) => l.label.id === label.id)
                return (
                  <button
                    key={label.id}
                    onClick={() => {
                      const currentIds = d.labels.map((l) => l.label.id)
                      const nextIds = isSelected
                        ? currentIds.filter((id) => id !== label.id)
                        : [...currentIds, label.id]
                      updateMutation.mutate({ labelIds: nextIds })
                    }}
                    className={`rounded-full px-2 py-0.5 text-xs font-medium border transition-colors ${
                      isSelected ? 'ring-1 ring-offset-1' : 'opacity-40 hover:opacity-70'
                    }`}
                    style={{
                      backgroundColor: label.color + (isSelected ? '20' : '10'),
                      color: label.color,
                      borderColor: label.color + '40',
                      ...(isSelected ? { ringColor: label.color } : {}),
                    }}
                  >
                    {label.name}
                  </button>
                )
              })}
              {(!projectLabels || projectLabels.length === 0) && (
                <span className="text-xs text-gray-400">No labels</span>
              )}
            </div>
          </div>

          {projectComponents && projectComponents.length > 0 && (
          <div>
            <span className="block text-xs font-medium text-gray-500 mb-1">Components</span>
            <div className="flex flex-wrap gap-1">
              {projectComponents.map((comp) => {
                const isSelected = d.components?.some((ic) => ic.component.id === comp.id)
                return (
                  <button
                    key={comp.id}
                    onClick={() => {
                      const currentIds = d.components?.map((ic) => ic.component.id) || []
                      const nextIds = isSelected
                        ? currentIds.filter((id) => id !== comp.id)
                        : [...currentIds, comp.id]
                      updateMutation.mutate({ componentIds: nextIds })
                    }}
                    className={`rounded-full px-2 py-0.5 text-xs font-medium border transition-colors ${
                      isSelected
                        ? 'bg-blue-100 text-blue-700 border-blue-400 ring-1 ring-blue-400 ring-offset-1'
                        : 'bg-gray-100 text-gray-500 border-transparent opacity-40 hover:opacity-70'
                    }`}
                  >
                    {comp.name}
                  </button>
                )
              })}
            </div>
          </div>
          )}

          {detail && detail.children.length > 0 && (
            <div>
              <span className="block text-xs font-medium text-gray-500 mb-1">
                Sub-tasks ({detail.children.length})
              </span>
              <div className="space-y-1">
                {detail.children.map((child) => (
                  <button
                    key={child.id}
                    onClick={() => onNavigate({ id: child.id, number: child.number, title: child.title } as Issue)}
                    className="flex w-full items-center gap-2 rounded bg-gray-50 px-2 py-1.5 text-sm hover:bg-gray-100 transition-colors text-left"
                  >
                    <span className="font-mono text-xs text-gray-400">#{child.number}</span>
                    <span className="flex-1 truncate">{child.title}</span>
                    <span className="rounded bg-gray-200 px-1.5 py-0.5 text-[10px]">{child.status}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Linked Issues */}
          {detail && (
            <LinkedIssues
              projectId={projectId}
              issueId={issue.id}
              sourceLinks={detail.sourceLinks}
              targetLinks={detail.targetLinks}
            />
          )}

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

        </div>
        )}

        {activeTab === 'activity' && (
        <ActivityTab projectId={projectId} issueId={issue.id} activities={detail?.activities || []} members={members || []} />
        )}
      </div>
    </div>
  )
}

// Unified timeline: comments + activities
type TimelineItem =
  | { type: 'comment'; data: Comment; createdAt: string }
  | { type: 'activity'; data: Activity; createdAt: string }

function ActivityTab({
  projectId,
  issueId,
  activities,
  members,
}: {
  projectId: string
  issueId: string
  activities: Activity[]
  members: ProjectMember[]
}) {
  const queryClient = useQueryClient()
  const currentUser = useAuthStore((s) => s.user)

  const { data: commentsData } = useQuery({
    queryKey: ['comments', projectId, issueId],
    queryFn: () => issueApi.comments(projectId, issueId),
  })

  const createCommentMutation = useMutation({
    mutationFn: (content: string) => issueApi.createComment(projectId, issueId, { content }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments', projectId, issueId] })
    },
    onError: (err: unknown) => {
      useToastStore.getState().addToast(getErrorMessage(err, 'Failed to post comment'))
    },
  })

  const updateCommentMutation = useMutation({
    mutationFn: ({ commentId, content }: { commentId: string; content: string }) =>
      issueApi.updateComment(projectId, issueId, commentId, { content }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments', projectId, issueId] })
    },
    onError: (err: unknown) => {
      useToastStore.getState().addToast(getErrorMessage(err, 'Failed to update comment'))
    },
  })

  const deleteCommentMutation = useMutation({
    mutationFn: (commentId: string) => issueApi.deleteComment(projectId, issueId, commentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments', projectId, issueId] })
    },
    onError: (err: unknown) => {
      useToastStore.getState().addToast(getErrorMessage(err, 'Failed to delete comment'))
    },
  })

  const timeline = useMemo<TimelineItem[]>(() => {
    const items: TimelineItem[] = []

    for (const a of activities) {
      items.push({ type: 'activity', data: a, createdAt: a.createdAt })
    }

    if (commentsData?.items) {
      for (const c of commentsData.items) {
        items.push({ type: 'comment', data: c, createdAt: c.createdAt })
      }
    }

    // Sort newest first
    items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    return items
  }, [activities, commentsData])

  return (
    <div className="p-6 space-y-6">
      <CommentInput
        members={members}
        onSubmit={(content) => createCommentMutation.mutate(content)}
        isSubmitting={createCommentMutation.isPending}
      />

      {timeline.length > 0 ? (
        <div className="space-y-4">
          {timeline.map((item) =>
            item.type === 'comment' ? (
              <CommentItem
                key={`c-${item.data.id}`}
                comment={item.data as Comment}
                currentUserId={currentUser?.id || ''}
                onUpdate={(commentId, content) => updateCommentMutation.mutate({ commentId, content })}
                onDelete={(commentId) => deleteCommentMutation.mutate(commentId)}
                isUpdating={updateCommentMutation.isPending}
              />
            ) : (
              <ActivityTimeline
                key={`a-${item.data.id}`}
                activities={[item.data as Activity]}
                members={members}
              />
            ),
          )}
        </div>
      ) : (
        <p className="text-sm text-gray-400 italic">No activity yet</p>
      )}
    </div>
  )
}

function AttachmentItem({ attachment, onDelete }: { attachment: Attachment; onDelete: (id: string) => void }) {
  const isImage = attachment.mimeType.startsWith('image/')
  const isVideo = attachment.mimeType.startsWith('video/')
  const sizeStr = attachment.fileSize > 1024 * 1024
    ? `${(attachment.fileSize / (1024 * 1024)).toFixed(1)} MB`
    : `${(attachment.fileSize / 1024).toFixed(0)} KB`

  return (
    <div className="flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2">
      {isImage && (
        <a href={attachment.url} target="_blank" rel="noopener noreferrer">
          <img src={attachment.url} alt={attachment.fileName} className="h-10 w-10 rounded object-cover" />
        </a>
      )}
      {isVideo && (
        <video src={attachment.url} className="h-10 w-10 rounded object-cover" muted />
      )}
      {!isImage && !isVideo && (
        <div className="flex h-10 w-10 items-center justify-center rounded bg-gray-200 text-xs text-gray-500">
          FILE
        </div>
      )}
      <div className="flex-1 min-w-0">
        <a href={attachment.url} target="_blank" rel="noopener noreferrer" className="block truncate text-sm font-medium text-gray-700 hover:text-primary-600">
          {attachment.fileName}
        </a>
        <span className="text-xs text-gray-400">{sizeStr}</span>
      </div>
      <button onClick={() => onDelete(attachment.id)} className="text-gray-400 hover:text-red-500">
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}
