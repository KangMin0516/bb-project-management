import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { issueApi, type Issue } from '@/api/issues'
import { projectApi } from '@/api/projects'
import { cn } from '@/lib/utils'
import CreateIssueModal from '@/components/issue/CreateIssueModal'
import { Plus, Search } from 'lucide-react'

const statusColors: Record<string, string> = {
  BACKLOG: 'bg-gray-400',
  TODO: 'bg-blue-400',
  IN_PROGRESS: 'bg-yellow-400',
  REVIEW_QA: 'bg-purple-400',
  DONE: 'bg-green-400',
  CANCELED: 'bg-red-400',
  RECHECK: 'bg-orange-400',
}

const priorityColors: Record<string, string> = {
  HIGH: 'bg-red-100 text-red-700',
  MEDIUM: 'bg-yellow-100 text-yellow-700',
  LOW: 'bg-green-100 text-green-700',
}

export default function IssuesPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('')
  const [page, setPage] = useState(1)
  const [showCreate, setShowCreate] = useState(false)
  const queryClient = useQueryClient()

  const params: Record<string, string> = { page: String(page), limit: '30' }
  if (search) params.search = search
  if (statusFilter) params.status = statusFilter
  if (priorityFilter) params.priority = priorityFilter

  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectApi.get(projectId!),
    enabled: !!projectId,
  })

  const { data, isLoading } = useQuery({
    queryKey: ['issues', projectId, params],
    queryFn: () => issueApi.list(projectId!, params),
    enabled: !!projectId,
  })

  const deleteMutation = useMutation({
    mutationFn: (issueId: string) => issueApi.delete(projectId!, issueId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['issues', projectId] })
    },
  })

  if (!projectId) return null

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-3">
        <h1 className="text-lg font-bold text-gray-900">{project?.key} Issues</h1>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 rounded-lg bg-primary-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-700"
        >
          <Plus className="h-4 w-4" />
          New Issue
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 border-b border-gray-200 bg-white px-6 py-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            placeholder="Search issues..."
            className="w-full rounded-lg border border-gray-300 py-1.5 pl-9 pr-3 text-sm focus:border-primary-500 focus:outline-none"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
          className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:outline-none"
        >
          <option value="">All Status</option>
          {['BACKLOG', 'TODO', 'IN_PROGRESS', 'REVIEW_QA', 'DONE', 'CANCELED', 'RECHECK'].map((s) => (
            <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
          ))}
        </select>
        <select
          value={priorityFilter}
          onChange={(e) => { setPriorityFilter(e.target.value); setPage(1) }}
          className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:outline-none"
        >
          <option value="">All Priority</option>
          {['HIGH', 'MEDIUM', 'LOW'].map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="flex h-32 items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-4 border-primary-600 border-t-transparent" />
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-gray-50 text-left text-xs font-medium text-gray-500">
              <tr>
                <th className="px-6 py-2">ID</th>
                <th className="px-3 py-2">Title</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Priority</th>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Assignee</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data?.items.map((issue) => (
                <tr key={issue.id} className="hover:bg-gray-50">
                  <td className="px-6 py-2 font-mono text-xs text-gray-400">
                    {project?.key}-{issue.number}
                  </td>
                  <td className="max-w-xs truncate px-3 py-2 font-medium text-gray-900">
                    {issue.title}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1.5">
                      <div className={cn('h-2 w-2 rounded-full', statusColors[issue.status])} />
                      <span className="text-xs text-gray-600">{issue.status.replace(/_/g, ' ')}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-medium', priorityColors[issue.priority])}>
                      {issue.priority}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-500">{issue.type}</td>
                  <td className="px-3 py-2 text-xs text-gray-600">
                    {issue.assignee?.name || '-'}
                  </td>
                  <td className="px-3 py-2">
                    <button
                      onClick={() => {
                        if (confirm('Delete this issue?')) deleteMutation.mutate(issue.id)
                      }}
                      className="text-xs text-red-400 hover:text-red-600"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {data?.items.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-gray-400">
                    No issues found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-gray-200 bg-white px-6 py-2">
          <span className="text-xs text-gray-500">
            {data.total} issues, page {data.page}/{data.totalPages}
          </span>
          <div className="flex gap-1">
            <button
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
              className="rounded border border-gray-300 px-3 py-1 text-xs disabled:opacity-40"
            >
              Prev
            </button>
            <button
              disabled={page >= data.totalPages}
              onClick={() => setPage(page + 1)}
              className="rounded border border-gray-300 px-3 py-1 text-xs disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {showCreate && (
        <CreateIssueModal projectId={projectId} onClose={() => setShowCreate(false)} />
      )}
    </div>
  )
}
