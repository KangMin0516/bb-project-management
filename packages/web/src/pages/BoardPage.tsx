import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { DragDropContext, type DropResult } from '@hello-pangea/dnd'
import { issueApi, type Issue, type IssueDetail, type UpdateIssuePayload } from '@/api/issues'
import { projectApi, type ProjectMember } from '@/api/projects'
import BoardColumn from '@/components/board/BoardColumn'
import CreateIssueModal from '@/components/issue/CreateIssueModal'
import { STATUSES, ORDER_GAP } from '@/lib/constants'
import { useToastStore } from '@/stores/toast'
import { getErrorMessage } from '@/lib/error'
import MarkdownViewer from '@/components/markdown/MarkdownViewer'
import MarkdownEditor from '@/components/markdown/MarkdownEditor'

export default function BoardPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const [createModal, setCreateModal] = useState<string | null>(null)
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null)
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
                issues={board?.[status] || []}
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
}: {
  projectId: string
  issue: Issue
  onClose: () => void
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

          {d.labels.length > 0 && (
            <div>
              <span className="block text-xs font-medium text-gray-500 mb-1">Labels</span>
              <div className="flex flex-wrap gap-1">
                {d.labels.map((l) => (
                  <span
                    key={l.label.id}
                    className="rounded-full px-2 py-0.5 text-xs font-medium"
                    style={{ backgroundColor: l.label.color + '20', color: l.label.color }}
                  >
                    {l.label.name}
                  </span>
                ))}
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
                  <div key={child.id} className="flex items-center gap-2 rounded bg-gray-50 px-2 py-1.5 text-sm">
                    <span className="font-mono text-xs text-gray-400">#{child.number}</span>
                    <span className="flex-1 truncate">{child.title}</span>
                    <span className="rounded bg-gray-200 px-1.5 py-0.5 text-[10px]">{child.status}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
        )}

        {activeTab === 'activity' && (
        <div className="p-6">
          {detail && detail.activities.length > 0 ? (
            <div className="space-y-3">
              {detail.activities.map((a) => (
                <div key={a.id} className="flex gap-3 text-xs">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-100 text-[10px] font-medium text-gray-600">
                    {a.user.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <span className="font-medium text-gray-700">{a.user.name}</span>{' '}
                    changed <span className="font-medium">{a.field}</span>{' '}
                    {a.oldValue && <><span className="line-through text-gray-400">{a.oldValue}</span> → </>}
                    <span className="font-medium text-gray-700">{a.newValue}</span>
                    <div className="mt-0.5 text-gray-400">
                      {new Date(a.createdAt).toLocaleString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400 italic">No activity yet</p>
          )}
        </div>
        )}
      </div>
    </div>
  )
}
