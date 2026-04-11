import { useState, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { specApi, type SpecStatus } from '@/api/specifications'
import { projectApi } from '@/api/projects'
import SpecContent from '@/components/spec/SpecContent'
import SpecCommentPanel from '@/components/spec/SpecCommentPanel'
import MarkdownEditor from '@/components/markdown/MarkdownEditor'
import { useToastStore } from '@/stores/toast'
import { getErrorMessage } from '@/lib/error'
import { Plus, FileText, X, PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen, ChevronRight, Download } from 'lucide-react'
import { cn } from '@/lib/utils'
import { SPEC_STATUS_COLORS } from '@/lib/constants'

export default function SpecificationsPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const queryClient = useQueryClient()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [filterSection, setFilterSection] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [createTitle, setCreateTitle] = useState('')
  const [createContent, setCreateContent] = useState('')
  const [createCategory, setCreateCategory] = useState('')
  const [editingContent, setEditingContent] = useState(false)
  const [draftContent, setDraftContent] = useState('')
  const [showSidebar, setShowSidebar] = useState(true)
  const [showComments, setShowComments] = useState(true)
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set())

  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectApi.get(projectId!),
    enabled: !!projectId,
  })

  const { data: specs, isLoading } = useQuery({
    queryKey: ['specifications', projectId],
    queryFn: () => specApi.list(projectId!),
    enabled: !!projectId,
  })

  const { data: detail } = useQuery({
    queryKey: ['specification', projectId, selectedId],
    queryFn: () => specApi.get(projectId!, selectedId!),
    enabled: !!projectId && !!selectedId,
  })

  const createMutation = useMutation({
    mutationFn: () => specApi.create(projectId!, { title: createTitle, content: createContent, category: createCategory || undefined }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['specifications', projectId] })
      setSelectedId(data.id)
      setShowCreate(false)
      setCreateTitle('')
      setCreateContent('')
      setCreateCategory('')
    },
    onError: (err: unknown) => useToastStore.getState().addToast(getErrorMessage(err, 'Failed to create specification')),
  })

  const updateMutation = useMutation({
    mutationFn: (data: { content?: string; status?: SpecStatus }) => specApi.update(projectId!, selectedId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['specification', projectId, selectedId] })
      queryClient.invalidateQueries({ queryKey: ['specifications', projectId] })
      setEditingContent(false)
    },
    onError: (err: unknown) => useToastStore.getState().addToast(getErrorMessage(err, 'Failed to update specification')),
  })

  const deleteMutation = useMutation({
    mutationFn: () => specApi.delete(projectId!, selectedId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['specifications', projectId] })
      setSelectedId(null)
    },
    onError: (err: unknown) => useToastStore.getState().addToast(getErrorMessage(err, 'Failed to delete specification')),
  })

  const handleSectionClick = useCallback((sectionId: string) => {
    setFilterSection((prev) => (prev === sectionId ? null : sectionId))
  }, [])

  if (!projectId) return null

  // Group specs by category
  const grouped = new Map<string, typeof specs>()
  for (const spec of specs || []) {
    const cat = spec.category || 'Uncategorized'
    if (!grouped.has(cat)) grouped.set(cat, [])
    grouped.get(cat)!.push(spec)
  }

  return (
    <div className="flex h-full">
      {/* Left sidebar — spec list */}
      {showSidebar ? (
        <div className="flex w-64 shrink-0 flex-col border-r border-gray-200 bg-white">
          <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
            <h1 className="text-sm font-bold text-gray-900">{project?.key} Specs</h1>
            <div className="flex items-center gap-0.5">
              <button
                onClick={() => setShowCreate(true)}
                className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                title="New specification"
              >
                <Plus className="h-4 w-4" />
              </button>
              <button
                onClick={() => {
                  specApi.downloadAll(projectId).then((specs) => {
                    for (const spec of specs) {
                      const blob = new Blob([spec.content], { type: 'text/markdown' })
                      const url = URL.createObjectURL(blob)
                      const a = document.createElement('a')
                      a.href = url
                      a.download = `${spec.filename}.md`
                      a.click()
                      URL.revokeObjectURL(url)
                    }
                  })
                }}
                className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                title="Download all as Markdown"
              >
                <Download className="h-4 w-4" />
              </button>
              <button
                onClick={() => setShowSidebar(false)}
                className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                title="Close sidebar"
              >
                <PanelLeftClose className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2">
            {isLoading ? (
              <div className="flex h-20 items-center justify-center">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary-600 border-t-transparent" />
              </div>
            ) : (
              [...grouped.entries()].map(([category, items]) => {
                const isCollapsed = collapsedCategories.has(category)
                return (
                  <div key={category} className="mb-1">
                    <button
                      onClick={() => setCollapsedCategories((prev) => {
                        const next = new Set(prev)
                        if (next.has(category)) next.delete(category)
                        else next.add(category)
                        return next
                      })}
                      className="flex w-full items-center gap-1 rounded px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400 hover:bg-gray-50 hover:text-gray-600"
                    >
                      <ChevronRight className={cn('h-3 w-3 transition-transform', !isCollapsed && 'rotate-90')} />
                      <span className="flex-1 text-left">{category}</span>
                      <span className="text-[9px] font-normal normal-case tracking-normal">{items!.length}</span>
                    </button>
                    {!isCollapsed && items!.map((spec) => (
                      <button
                        key={spec.id}
                        onClick={() => { setSelectedId(spec.id); setFilterSection(null); setEditingContent(false) }}
                        className={cn(
                          'flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition',
                          selectedId === spec.id
                            ? 'bg-primary-50 text-primary-700'
                            : 'text-gray-700 hover:bg-gray-50',
                        )}
                      >
                        <FileText className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                        <span className="flex-1 truncate">{spec.title}</span>
                        {spec._count.comments > 0 && (
                          <span className="shrink-0 rounded-full bg-amber-100 px-1.5 text-[9px] font-medium text-amber-600">
                            {spec._count.comments}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )
              })
            )}
            {!isLoading && (!specs || specs.length === 0) && (
              <p className="py-8 text-center text-sm text-gray-400">No specifications yet</p>
            )}
          </div>
        </div>
      ) : (
        <div className="flex shrink-0 flex-col items-center border-r border-gray-200 bg-white py-3 px-1.5">
          <button
            onClick={() => setShowSidebar(true)}
            className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            title="Open sidebar"
          >
            <PanelLeftOpen className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {detail ? (
          <>
            {/* Header */}
            <div className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-3">
              <div className="flex items-center gap-3 flex-wrap">
                <h2 className="text-lg font-bold text-gray-900">{detail.title}</h2>
                <span className={cn('rounded px-2 py-0.5 text-[10px] font-medium', SPEC_STATUS_COLORS[detail.status])}>
                  {detail.status}
                </span>
                {detail.issueLinks && detail.issueLinks.length > 0 && (
                  <div className="flex items-center gap-1">
                    {detail.issueLinks.map((link) => (
                      <span
                        key={link.id}
                        className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700"
                        title={`#${link.issue.number} ${link.issue.title} (${link.issue.status})`}
                      >
                        #{link.issue.number}
                        <span className="text-blue-400">{link.issue.status.replace(/_/g, ' ')}</span>
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={detail.status}
                  onChange={(e) => updateMutation.mutate({ status: e.target.value as SpecStatus })}
                  className="rounded border border-gray-300 px-2 py-1 text-xs"
                >
                  {(['DRAFT', 'REVIEW', 'APPROVED', 'DEPRECATED'] as SpecStatus[]).map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                {!editingContent ? (
                  <button
                    onClick={() => { setDraftContent(detail.content); setEditingContent(true) }}
                    className="rounded-lg border border-gray-300 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Edit
                  </button>
                ) : (
                  <div className="flex gap-1">
                    <button
                      onClick={() => updateMutation.mutate({ content: draftContent })}
                      className="rounded-lg bg-primary-600 px-3 py-1 text-xs font-medium text-white hover:bg-primary-700"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setEditingContent(false)}
                      className="rounded-lg border border-gray-300 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                  </div>
                )}
                <button
                  onClick={() => {
                    specApi.downloadOne(projectId, detail.id).then((blob) => {
                      const url = URL.createObjectURL(blob)
                      const a = document.createElement('a')
                      a.href = url
                      a.download = `${detail.title.replace(/[^a-zA-Z0-9가-힣\s_-]/g, '').replace(/\s+/g, '_')}.md`
                      a.click()
                      URL.revokeObjectURL(url)
                    })
                  }}
                  className="rounded-lg border border-gray-300 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                  title="Download as Markdown"
                >
                  <Download className="inline h-3.5 w-3.5 -mt-0.5 mr-1" />
                  .md
                </button>
                <button
                  onClick={() => { if (confirm('Delete this specification?')) deleteMutation.mutate() }}
                  className="rounded-lg border border-red-200 px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                >
                  Delete
                </button>
                <button
                  onClick={() => setShowComments((v) => !v)}
                  className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                  title={showComments ? 'Hide comments' : 'Show comments'}
                >
                  {showComments ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="flex flex-1 overflow-hidden">
              <div className="flex-1 overflow-y-auto p-6">
                {editingContent ? (
                  <MarkdownEditor value={draftContent} onChange={setDraftContent} minRows={20} />
                ) : (
                  <SpecContent
                    content={detail.content}
                    sections={detail.sections}
                    comments={detail.comments}
                    onSectionClick={handleSectionClick}
                  />
                )}
              </div>

              {/* Comment panel */}
              {showComments && (
                <div className="w-80 shrink-0 border-l border-gray-200 bg-white">
                  <SpecCommentPanel
                    projectId={projectId}
                    specId={detail.id}
                    comments={detail.comments}
                    filterSection={filterSection}
                    onSectionClick={handleSectionClick}
                  />
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center">
            <div className="text-center">
              <FileText className="mx-auto h-12 w-12 text-gray-300" />
              <p className="mt-2 text-sm text-gray-500">Select a specification or create a new one</p>
            </div>
          </div>
        )}
      </div>

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setShowCreate(false)}>
          <div className="w-full max-w-2xl rounded-xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">New Specification</h3>
              <button onClick={() => setShowCreate(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-3">
              <div className="flex gap-3">
                <input
                  value={createTitle}
                  onChange={(e) => setCreateTitle(e.target.value)}
                  placeholder="Title"
                  className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
                <input
                  value={createCategory}
                  onChange={(e) => setCreateCategory(e.target.value)}
                  placeholder="Category (optional)"
                  className="w-40 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
              </div>
              <MarkdownEditor
                value={createContent}
                onChange={setCreateContent}
                placeholder="Write your specification in Markdown..."
                minRows={12}
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setShowCreate(false)}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => createMutation.mutate()}
                  disabled={!createTitle.trim() || !createContent.trim() || createMutation.isPending}
                  className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
                >
                  {createMutation.isPending ? 'Creating...' : 'Create'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
