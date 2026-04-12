import { useState, useEffect, useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { issueApi, type CreateIssuePayload } from '@/api/issues'
import { templateApi } from '@/api/templates'
import { projectApi } from '@/api/projects'
import { componentApi } from '@/api/components'
import { X } from 'lucide-react'
import TipTapEditor from '@/components/editor/TipTapEditor'
import { useToastStore } from '@/stores/toast'
import { getErrorMessage } from '@/lib/error'

interface Props {
  projectId: string
  defaultStatus?: string
  onClose: () => void
  onCreated?: (issueId: string) => void
}

export default function CreateIssueModal({ projectId, defaultStatus, onClose, onCreated }: Props) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState('MEDIUM')
  const [type, setType] = useState('TASK')
  const [assigneeId, setAssigneeId] = useState('')
  const [labelIds, setLabelIds] = useState<string[]>([])
  const [componentIds, setComponentIds] = useState<string[]>([])
  const [parentId, setParentId] = useState('')
  const queryClient = useQueryClient()

  const { data: members } = useQuery({
    queryKey: ['members', projectId],
    queryFn: () => projectApi.listMembers(projectId),
  })

  const { data: labels } = useQuery({
    queryKey: ['labels', projectId],
    queryFn: () => projectApi.listLabels(projectId),
  })

  const { data: components } = useQuery({
    queryKey: ['components', projectId],
    queryFn: () => componentApi.list(projectId),
  })

  const { data: issuesData } = useQuery({
    queryKey: ['issues', projectId, 'parent-options'],
    queryFn: () => issueApi.list(projectId, { limit: '200' }),
  })

  const { data: templates } = useQuery({
    queryKey: ['templates'],
    queryFn: templateApi.list,
  })

  // Auto-fill description from template when type changes
  const [descriptionTouched, setDescriptionTouched] = useState(false)
  useEffect(() => {
    if (descriptionTouched) return
    const match = templates?.find((t) => t.type === type)
    if (match?.description) {
      setDescription(match.description)
    } else {
      setDescription('')
    }
  }, [type, templates, descriptionTouched])

  const parentOptions = useMemo(() => {
    if (!issuesData?.items) return []
    if (type === 'SUB_TASK') {
      // Sub-task can pick any non-SUB_TASK as parent
      return issuesData.items.filter((i) => i.type !== 'SUB_TASK')
    }
    // TASK/BUG can only pick EPIC as parent
    return issuesData.items.filter((i) => i.type === 'EPIC')
  }, [issuesData, type])

  const mutation = useMutation({
    mutationFn: (data: CreateIssuePayload) => issueApi.create(projectId, data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['board', projectId] })
      queryClient.invalidateQueries({ queryKey: ['issues', projectId] })
      onCreated?.(data.id)
      onClose()
    },
    onError: (err: unknown) => {
      useToastStore.getState().addToast(getErrorMessage(err, 'Failed to create issue'))
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
      parentId: parentId || undefined,
      labelIds: labelIds.length ? labelIds : undefined,
      componentIds: componentIds.length ? componentIds : undefined,
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" role="dialog" aria-modal="true" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Create Issue</h2>
          <button onClick={onClose} aria-label="Close" className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Issue title"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none"
            autoFocus
            required
          />

          <TipTapEditor
            content={description}
            onChange={(v) => { setDescription(v); setDescriptionTouched(true) }}
            placeholder="Description (optional)"
            minHeight="100px"
          />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">Type</label>
              <select
                value={type}
                onChange={(e) => { setType(e.target.value); setParentId(''); setDescriptionTouched(false) }}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none"
              >
                <option value="TASK">Task</option>
                <option value="BUG">Bug</option>
                <option value="EPIC">Epic</option>
                <option value="SUB_TASK">Sub-task</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none"
              >
                <option value="HIGH">High</option>
                <option value="MEDIUM">Medium</option>
                <option value="LOW">Low</option>
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">Assignee</label>
            <select
              value={assigneeId}
              onChange={(e) => setAssigneeId(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none"
            >
              <option value="">Unassigned</option>
              {members?.map((m) => (
                <option key={m.user.id} value={m.user.id}>
                  {m.user.name}
                </option>
              ))}
            </select>
          </div>

          {type !== 'EPIC' && (
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">
                Parent Issue{type === 'SUB_TASK' ? ' *' : ''}
              </label>
              <select
                value={parentId}
                onChange={(e) => setParentId(e.target.value)}
                required={type === 'SUB_TASK'}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none"
              >
                <option value="">None</option>
                {parentOptions.map((issue) => (
                  <option key={issue.id} value={issue.id}>
                    #{issue.number} {issue.title}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">Labels</label>
            <div className="flex flex-wrap gap-1.5">
              {labels?.map((label) => (
                <button
                  key={label.id}
                  type="button"
                  onClick={() =>
                    setLabelIds((ids) =>
                      ids.includes(label.id) ? ids.filter((id) => id !== label.id) : [...ids, label.id],
                    )
                  }
                  className="rounded-full px-2.5 py-1 text-xs font-medium transition"
                  style={{
                    backgroundColor: labelIds.includes(label.id) ? label.color + '30' : '#f3f4f6',
                    color: labelIds.includes(label.id) ? label.color : '#6b7280',
                    border: labelIds.includes(label.id) ? `1px solid ${label.color}` : '1px solid transparent',
                  }}
                >
                  {label.name}
                </button>
              ))}
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
                        ? 'bg-blue-100 text-blue-700 border border-blue-400'
                        : 'bg-gray-100 text-gray-500 border border-transparent'
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
              onClick={onClose}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
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
      </div>
    </div>
  )
}
