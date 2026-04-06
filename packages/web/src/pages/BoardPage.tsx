import { useState, useEffect, useCallback, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { DragDropContext, type DropResult } from '@hello-pangea/dnd'
import { issueApi, type Issue, type IssueDetail, type Activity, type Comment, type UpdateIssuePayload } from '@/api/issues'
import { projectApi, type ProjectMember } from '@/api/projects'
import BoardColumn from '@/components/board/BoardColumn'
import CreateIssueModal from '@/components/issue/CreateIssueModal'
import { STATUSES, ORDER_GAP } from '@/lib/constants'
import { useToastStore } from '@/stores/toast'
import { useAuthStore } from '@/stores/auth'
import { getErrorMessage } from '@/lib/error'
import { timeAgo } from '@/lib/time'
import MarkdownViewer from '@/components/markdown/MarkdownViewer'
import MarkdownEditor from '@/components/markdown/MarkdownEditor'
import CommentInput from '@/components/comment/CommentInput'
import CommentItem from '@/components/comment/CommentItem'

export default function BoardPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const [createModal, setCreateModal] = useState<string | null>(null)
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null)
  const [selectedAssignees, setSelectedAssignees] = useState<Set<string>>(new Set())
  const [selectedLabels, setSelectedLabels] = useState<Set<string>>(new Set())
  const [selectedEpicId, setSelectedEpicId] = useState<string | null>(null)
  const queryClient = useQueryClient()

  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectApi.get(projectId!),
    enabled: !!projectId,
  })

  const { data: board, isLoading: isBoardLoading } = useQuery({
    queryKey: ['board', projectId],
    queryFn: () => issueApi.board(projectId!),
    enabled: !!projectId,
  })

  const reorderMutation = useMutation({
    mutationFn: (args: { issueId: string; status: string; order: number }) =>
      issueApi.reorder(projectId!, args.issueId, { status: args.status, order: args.order }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['board', projectId] })
    },
    onError: (err: unknown) => {
      useToastStore.getState().addToast(getErrorMessage(err, 'Failed to reorder issue'))
    },
  })

  const handleAddClick = useCallback((status: string) => {
    setCreateModal(status)
  }, [])

  const handleDragEnd = (result: DropResult) => {
    const { destination, source, draggableId } = result
    if (!destination) return
    if (destination.droppableId === source.droppableId && destination.index === source.index) return

    const destStatus = destination.droppableId
    const rawIssues = board?.[destStatus] || []

    // If same column, remove the dragged item to get correct index calculation
    const destIssues = destination.droppableId === source.droppableId
      ? rawIssues.filter(issue => issue.id !== draggableId)
      : rawIssues

    // Calculate new order
    let newOrder: number
    if (destIssues.length === 0) {
      newOrder = ORDER_GAP
    } else if (destination.index === 0) {
      newOrder = (destIssues[0]?.order || ORDER_GAP) / 2
    } else if (destination.index >= destIssues.length) {
      newOrder = (destIssues[destIssues.length - 1]?.order || 0) + ORDER_GAP
    } else {
      const before = destIssues[destination.index - 1]?.order || 0
      const after = destIssues[destination.index]?.order || before + ORDER_GAP * 2
      newOrder = (before + after) / 2
    }

    reorderMutation.mutate({ issueId: draggableId, status: destStatus, order: newOrder })
  }

  const assignedMembers = useMemo(() => {
    const memberMap = new Map<string, { id: string; name: string; avatar: string | null }>()
    Object.values(board || {}).flat().forEach((issue) => {
      if (issue.assignee) memberMap.set(issue.assignee.id, issue.assignee)
    })
    return [...memberMap.values()]
  }, [board])

  const boardLabels = useMemo(() => {
    const labelMap = new Map<string, { id: string; name: string; color: string }>()
    Object.values(board || {}).flat().forEach((issue) => {
      issue.labels.forEach((il) => labelMap.set(il.label.id, il.label))
    })
    return [...labelMap.values()]
  }, [board])

  const boardEpics = useMemo(() => {
    const epics: Issue[] = []
    Object.values(board || {}).flat().forEach((issue) => {
      if (issue.type === 'EPIC') epics.push(issue)
    })
    return epics
  }, [board])

  const filteredBoard = useMemo(() => {
    if (selectedAssignees.size === 0 && selectedLabels.size === 0 && !selectedEpicId) return board
    const filtered: typeof board = {}
    for (const [status, issues] of Object.entries(board || {})) {
      const matching = issues.filter((issue) => {
        const matchAssignee = selectedAssignees.size === 0 || (issue.assigneeId && selectedAssignees.has(issue.assigneeId))
        const matchLabel = selectedLabels.size === 0 || issue.labels.some((il) => selectedLabels.has(il.label.id))
        const matchEpic = !selectedEpicId || issue.id === selectedEpicId || issue.parentId === selectedEpicId
        return matchAssignee && matchLabel && matchEpic
      })
      if (matching.length > 0) filtered[status] = matching
    }
    return filtered
  }, [board, selectedAssignees, selectedLabels, selectedEpicId])

  const toggleAssignee = useCallback((id: string) => {
    setSelectedAssignees((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const toggleLabel = useCallback((id: string) => {
    setSelectedLabels((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  if (!projectId) return null

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-3">
        <div>
          <h1 className="text-lg font-bold text-gray-900">
            {project?.key} Board
          </h1>
          <p className="text-sm text-gray-500">{project?.name}</p>
        </div>
        <div className="flex items-center gap-3">
          {assignedMembers.length > 0 && (
            <div className="flex items-center gap-1">
              {assignedMembers.map((member) => {
                const isSelected = selectedAssignees.has(member.id)
                return (
                  <button
                    key={member.id}
                    type="button"
                    onClick={() => toggleAssignee(member.id)}
                    title={member.name}
                    className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-medium transition-all ${
                      isSelected
                        ? 'ring-2 ring-primary-600 ring-offset-1 bg-primary-100 text-primary-700'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {member.name.charAt(0).toUpperCase()}
                  </button>
                )
              })}
            </div>
          )}
          {assignedMembers.length > 0 && boardLabels.length > 0 && (
            <div className="h-5 w-px bg-gray-200" />
          )}
          {boardLabels.length > 0 && (
            <div className="flex items-center gap-1">
              {boardLabels.map((label) => {
                const isSelected = selectedLabels.has(label.id)
                return (
                  <button
                    key={label.id}
                    type="button"
                    onClick={() => toggleLabel(label.id)}
                    title={label.name}
                    className={`rounded-full px-2.5 py-1 text-xs font-medium transition-all ${
                      isSelected
                        ? 'ring-2 ring-offset-1'
                        : 'opacity-70 hover:opacity-100'
                    }`}
                    style={{
                      backgroundColor: label.color + '20',
                      color: label.color,
                      ...(isSelected ? { ringColor: label.color } : {}),
                    }}
                  >
                    {label.name}
                  </button>
                )
              })}
            </div>
          )}
          {boardLabels.length > 0 && boardEpics.length > 0 && (
            <div className="h-5 w-px bg-gray-200" />
          )}
          {boardEpics.length > 0 && (
            <div className="flex items-center gap-1">
              {boardEpics.map((epic) => {
                const isSelected = selectedEpicId === epic.id
                return (
                  <button
                    key={epic.id}
                    type="button"
                    onClick={() => setSelectedEpicId(isSelected ? null : epic.id)}
                    title={epic.title}
                    className={`rounded-full px-2.5 py-1 text-xs font-medium transition-all ${
                      isSelected
                        ? 'bg-purple-100 text-purple-700 ring-2 ring-purple-500 ring-offset-1'
                        : 'bg-purple-50 text-purple-600 opacity-70 hover:opacity-100'
                    }`}
                  >
                    ⚡ {epic.title}
                  </button>
                )
              })}
            </div>
          )}
          {(selectedAssignees.size > 0 || selectedLabels.size > 0 || selectedEpicId) && (
            <button
              type="button"
              onClick={() => { setSelectedAssignees(new Set()); setSelectedLabels(new Set()); setSelectedEpicId(null) }}
              className="rounded px-2 py-1 text-xs text-gray-400 hover:text-gray-600 hover:bg-gray-100"
              title="Clear all filters"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-x-auto p-4">
        {isBoardLoading ? (
          <div className="flex h-full items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-600 border-t-transparent" />
          </div>
        ) : (
        <DragDropContext onDragEnd={handleDragEnd}>
          <div className="flex gap-4">
            {STATUSES.map((status) => (
              <BoardColumn
                key={status}
                status={status}
                issues={filteredBoard?.[status] || []}
                projectKey={project?.key || ''}
                onIssueClick={setSelectedIssue}
                onAddClick={handleAddClick}
              />
            ))}
          </div>
        </DragDropContext>
        )}
      </div>

      {createModal && (
        <CreateIssueModal
          projectId={projectId}
          defaultStatus={createModal}
          onClose={() => setCreateModal(null)}
        />
      )}

      {selectedIssue && (
        <IssueDetailPanel
          projectId={projectId}
          issue={selectedIssue}
          onClose={() => setSelectedIssue(null)}
          onNavigate={setSelectedIssue}
        />
      )}
    </div>
  )
}

// Inline issue detail slide-over panel
function IssueDetailPanel({
  projectId,
  issue,
  onClose,
  onNavigate,
}: {
  projectId: string
  issue: Issue
  onClose: () => void
  onNavigate: (issue: Issue) => void
}) {
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

  const queryClient = useQueryClient()
  const updateMutation = useMutation({
    mutationFn: (data: UpdateIssuePayload) => issueApi.update(projectId, issue.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['board', projectId] })
      queryClient.invalidateQueries({ queryKey: ['issue', projectId, issue.id] })
    },
    onError: (err: unknown) => {
      useToastStore.getState().addToast(getErrorMessage(err, 'Failed to update issue'))
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
              <div key={`a-${item.data.id}`} className="flex gap-3 text-xs">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-100 text-[10px] font-medium text-gray-600">
                  {(item.data as Activity).user?.name?.charAt(0)?.toUpperCase() || '?'}
                </div>
                <div className="min-w-0 pt-1">
                  <span className="font-medium text-gray-700">{(item.data as Activity).user?.name}</span>{' '}
                  changed <span className="font-medium">{(item.data as Activity).field}</span>{' '}
                  {(item.data as Activity).oldValue && (
                    <><span className="line-through text-gray-400">{(item.data as Activity).oldValue}</span> &rarr; </>
                  )}
                  <span className="font-medium text-gray-700">{(item.data as Activity).newValue}</span>
                  <div className="mt-0.5 text-gray-400">{timeAgo(item.createdAt)}</div>
                </div>
              </div>
            ),
          )}
        </div>
      ) : (
        <p className="text-sm text-gray-400 italic">No activity yet</p>
      )}
    </div>
  )
}
