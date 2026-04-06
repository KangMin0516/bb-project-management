import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { DragDropContext, type DropResult } from '@hello-pangea/dnd'
import { issueApi, type Issue, type IssueDetail } from '@/api/issues'
import { projectApi } from '@/api/projects'
import BoardColumn from '@/components/board/BoardColumn'
import CreateIssueModal from '@/components/issue/CreateIssueModal'

const STATUSES = ['BACKLOG', 'TODO', 'IN_PROGRESS', 'REVIEW_QA', 'DONE', 'CANCELED', 'RECHECK']
const ORDER_GAP = 1000

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

  const { data: board } = useQuery({
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
  })

  const handleDragEnd = (result: DropResult) => {
    const { destination, source, draggableId } = result
    if (!destination) return
    if (destination.droppableId === source.droppableId && destination.index === source.index) return

    const destStatus = destination.droppableId
    const destIssues = board?.[destStatus] || []

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
        <DragDropContext onDragEnd={handleDragEnd}>
          <div className="flex gap-4">
            {STATUSES.map((status) => (
              <BoardColumn
                key={status}
                status={status}
                issues={board?.[status] || []}
                projectKey={project?.key || ''}
                onIssueClick={setSelectedIssue}
                onAddClick={() => setCreateModal(status)}
              />
            ))}
          </div>
        </DragDropContext>
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
  const { data: detail } = useQuery({
    queryKey: ['issue', projectId, issue.id],
    queryFn: () => issueApi.get(projectId, issue.id),
  })

  const queryClient = useQueryClient()
  const updateMutation = useMutation({
    mutationFn: (data: Record<string, any>) => issueApi.update(projectId, issue.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['board', projectId] })
      queryClient.invalidateQueries({ queryKey: ['issue', projectId, issue.id] })
    },
  })

  const d: Issue | IssueDetail = detail || issue

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={onClose}>
      <div
        className="h-full w-full max-w-lg overflow-y-auto bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <span className="font-mono text-sm text-gray-400">
              {issue.number ? `#${issue.number}` : ''}
            </span>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
          </div>
          <h2 className="mt-1 text-xl font-bold text-gray-900">{d.title}</h2>
        </div>

        <div className="space-y-4 p-6">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="block text-xs font-medium text-gray-500 mb-1">Status</span>
              <select
                value={d.status}
                onChange={(e) => updateMutation.mutate({ status: e.target.value })}
                className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
              >
                {['BACKLOG', 'TODO', 'IN_PROGRESS', 'REVIEW_QA', 'DONE', 'CANCELED', 'RECHECK'].map(
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

          {d.description && (
            <div>
              <span className="block text-xs font-medium text-gray-500 mb-1">Description</span>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{d.description}</p>
            </div>
          )}

          <div>
            <span className="block text-xs font-medium text-gray-500 mb-1">Assignee</span>
            <span className="text-sm text-gray-700">
              {d.assignee?.name || 'Unassigned'}
            </span>
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

          {detail && detail.activities.length > 0 && (
            <div>
              <span className="block text-xs font-medium text-gray-500 mb-2">Activity</span>
              <div className="space-y-2">
                {detail.activities.map((a) => (
                  <div key={a.id} className="text-xs text-gray-500">
                    <span className="font-medium text-gray-700">{a.user.name}</span>{' '}
                    changed <span className="font-medium">{a.field}</span>{' '}
                    {a.oldValue && <><span className="line-through">{a.oldValue}</span> → </>}
                    <span className="font-medium text-gray-700">{a.newValue}</span>
                    <span className="ml-2 text-gray-400">
                      {new Date(a.createdAt).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
