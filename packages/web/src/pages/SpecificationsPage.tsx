import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { specApi, type SpecStatus, type SpecListItem } from '@/features/specification/api'
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd'
import { projectApi } from '@/features/project/api'
import SpecContent, { type SpecContentHandle } from '@/features/specification/components/SpecContent'
import SpecCommentPanel from '@/features/specification/components/SpecCommentPanel'
import MarkdownEditor from '@/shared/ui/markdown/MarkdownEditor'
import { useToastStore } from '@/shared/lib/toast'
import { getErrorMessage } from '@/shared/lib/error'
import { Plus, FileText, X, PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen, ChevronRight, Download } from 'lucide-react'
import { cn } from '@/shared/lib/utils'
import { SPEC_STATUS_COLORS } from '@/shared/config/constants'
import { issueApi } from '@/features/issue/api'
import CreateIssueModal from '@/features/issue/components/CreateIssueModal'

export default function SpecificationsPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const specContentRef = useRef<SpecContentHandle>(null)
  const [selectedId, setSelectedId] = useState<string | null>(searchParams.get('specId'))
  const [filterSection, setFilterSection] = useState<string | null>(null)
  const [pendingScrollSection, setPendingScrollSection] = useState<string | null>(searchParams.get('section'))
  const [showCreate, setShowCreate] = useState(false)
  const [createTitle, setCreateTitle] = useState('')
  const [createContent, setCreateContent] = useState('')
  const [createCategory, setCreateCategory] = useState('')
  const [editingContent, setEditingContent] = useState(false)
  const [draftContent, setDraftContent] = useState('')
  const [showSidebar, setShowSidebar] = useState(true)
  const [showComments, setShowComments] = useState(true)
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set())
  const [createIssueForSection, setCreateIssueForSection] = useState<string | null>(null)

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

  const handleDragEnd = useCallback((result: DropResult) => {
    if (!projectId) return
    const { source, destination } = result
    if (!destination) return
    if (source.droppableId !== destination.droppableId) return
    if (source.index === destination.index) return

    const category = source.droppableId
    const current = specs ?? []
    const sameCat = current.filter((s) => (s.category || 'Uncategorized') === category)
    const reordered = [...sameCat]
    const [moved] = reordered.splice(source.index, 1)
    reordered.splice(destination.index, 0, moved)

    // Optimistic cache update — reinsert reordered items at the first matching slot
    queryClient.setQueryData<SpecListItem[]>(['specifications', projectId], (old) => {
      if (!old) return old
      const newByOrder = reordered.map((s, i) => ({ ...s, order: i }))
      const newIds = new Set(newByOrder.map((s) => s.id))
      const result: SpecListItem[] = []
      let inserted = false
      for (const s of old) {
        const cat = s.category || 'Uncategorized'
        if (cat === category) {
          if (!inserted) {
            result.push(...newByOrder)
            inserted = true
          }
          continue
        }
        if (!newIds.has(s.id)) result.push(s)
      }
      if (!inserted) result.push(...newByOrder)
      return result
    })

    // Persist new order (PATCH only items whose order changed)
    Promise.all(
      reordered.map((spec, idx) =>
        spec.order === idx ? null : specApi.update(projectId, spec.id, { order: idx }),
      ),
    )
      .catch((err: unknown) => {
        useToastStore.getState().addToast(getErrorMessage(err, 'Failed to reorder'))
      })
      .finally(() => {
        queryClient.invalidateQueries({ queryKey: ['specifications', projectId] })
      })
  }, [projectId, specs, queryClient])

  // Scroll to section after detail loads (from URL params or navigation)
  useEffect(() => {
    if (pendingScrollSection && detail) {
      requestAnimationFrame(() => {
        specContentRef.current?.scrollToSection(pendingScrollSection)
        setFilterSection(pendingScrollSection)
        setPendingScrollSection(null)
        setSearchParams((prev) => {
          prev.delete('specId')
          prev.delete('section')
          return prev
        }, { replace: true })
      })
    }
  }, [pendingScrollSection, detail, setSearchParams])

  const handleSectionClick = useCallback((sectionId: string) => {
    setFilterSection((prev) => (prev === sectionId ? null : sectionId))
    setShowComments(true)
  }, [])

  const handleScrollToSection = useCallback((sectionId: string) => {
    specContentRef.current?.scrollToSection(sectionId)
  }, [])

  const handleClearFilter = useCallback(() => {
    setFilterSection(null)
  }, [])

  const handleIssueClick = useCallback((issueId: string) => {
    navigate(`/projects/${projectId}/lists?issue=${issueId}`)
  }, [navigate, projectId])

  const handleCreateIssue = useCallback((sectionSlug: string) => {
    setCreateIssueForSection(sectionSlug)
  }, [])

  const handleIssueCreated = useCallback((issueId: string) => {
    if (!selectedId || !projectId) return
    issueApi.createSpecLink(projectId, issueId, {
      specId: selectedId,
      sectionSlug: createIssueForSection || undefined,
    }).then(() => {
      queryClient.invalidateQueries({ queryKey: ['specification', projectId, selectedId] })
      useToastStore.getState().addToast('Issue created and linked to spec section', 'success')
    }).catch((err: unknown) => {
      useToastStore.getState().addToast(getErrorMessage(err, 'Issue created but failed to link to spec'))
    })
  }, [selectedId, projectId, createIssueForSection, queryClient])

  // Group specs by category
  const grouped = useMemo(() => {
    const map = new Map<string, typeof specs>()
    for (const spec of specs || []) {
      const cat = spec.category || 'Uncategorized'
      if (!map.has(cat)) map.set(cat, [])
      map.get(cat)!.push(spec)
    }
    return map
  }, [specs])

  if (!projectId) return null

  return (
    <div className="flex h-full">
      {/* Left sidebar — spec list */}
      {showSidebar ? (
        <div className="flex w-64 shrink-0 flex-col border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 px-4 py-3">
            <h1 className="text-sm font-bold text-gray-900 dark:text-gray-100">{project?.key} Specs</h1>
            <div className="flex items-center gap-0.5">
              <button
                onClick={() => setShowCreate(true)}
                className="rounded p-1 text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-600 dark:text-gray-500"
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
                className="rounded p-1 text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-600 dark:text-gray-500"
                title="Download all as Markdown"
              >
                <Download className="h-4 w-4" />
              </button>
              <button
                onClick={() => setShowSidebar(false)}
                className="rounded p-1 text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-600 dark:text-gray-500"
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
              <DragDropContext onDragEnd={handleDragEnd}>
                {[...grouped.entries()].map(([category, items]) => {
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
                        className="flex w-full items-center gap-1 rounded px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 hover:bg-gray-50 dark:bg-gray-900 hover:text-gray-600 dark:text-gray-500"
                      >
                        <ChevronRight className={cn('h-3 w-3 transition-transform', !isCollapsed && 'rotate-90')} />
                        <span className="flex-1 text-left">{category}</span>
                        <span className="text-[9px] font-normal normal-case tracking-normal">{items!.length}</span>
                      </button>
                      {!isCollapsed && (
                        <Droppable droppableId={category}>
                          {(dropProvided, dropSnapshot) => (
                            <div
                              ref={dropProvided.innerRef}
                              {...dropProvided.droppableProps}
                              className={cn(
                                'rounded transition-colors',
                                dropSnapshot.isDraggingOver && 'bg-primary-50/40 dark:bg-primary-900/20',
                              )}
                            >
                              {items!.map((spec, idx) => (
                                <Draggable key={spec.id} draggableId={spec.id} index={idx}>
                                  {(dragProvided, dragSnapshot) => (
                                    <div
                                      ref={dragProvided.innerRef}
                                      {...dragProvided.draggableProps}
                                      {...dragProvided.dragHandleProps}
                                      onClick={() => { setSelectedId(spec.id); setFilterSection(null); setEditingContent(false) }}
                                      className={cn(
                                        'flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition cursor-pointer',
                                        selectedId === spec.id
                                          ? 'bg-primary-50 text-primary-700'
                                          : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:bg-gray-900',
                                        dragSnapshot.isDragging && 'shadow-lg ring-1 ring-primary-300 bg-white dark:bg-gray-800',
                                      )}
                                    >
                                      <FileText className="h-3.5 w-3.5 shrink-0 text-gray-400 dark:text-gray-500" />
                                      <span className="flex-1 truncate">{spec.title}</span>
                                      {spec._count.comments > 0 && (
                                        <span className="shrink-0 rounded-full bg-amber-100 px-1.5 text-[9px] font-medium text-amber-600">
                                          {spec._count.comments}
                                        </span>
                                      )}
                                    </div>
                                  )}
                                </Draggable>
                              ))}
                              {dropProvided.placeholder}
                            </div>
                          )}
                        </Droppable>
                      )}
                    </div>
                  )
                })}
              </DragDropContext>
            )}
            {!isLoading && (!specs || specs.length === 0) && (
              <p className="py-8 text-center text-sm text-gray-400 dark:text-gray-500">No specifications yet</p>
            )}
          </div>
        </div>
      ) : (
        <div className="flex shrink-0 flex-col items-center border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 py-3 px-1.5">
          <button
            onClick={() => setShowSidebar(true)}
            className="rounded p-1.5 text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-600 dark:text-gray-500"
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
            <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-6 py-3">
              <div className="flex items-center gap-3 flex-wrap">
                <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">{detail.title}</h2>
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
                  className="rounded border border-gray-300 dark:border-gray-600 px-2 py-1 text-xs"
                >
                  {(['DRAFT', 'REVIEW', 'APPROVED', 'DEPRECATED'] as SpecStatus[]).map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                {!editingContent ? (
                  <button
                    onClick={() => { setDraftContent(detail.content); setEditingContent(true) }}
                    className="rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-1 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:bg-gray-900"
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
                      className="rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-1 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:bg-gray-900"
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
                  className="rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-1 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:bg-gray-900"
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
                  className="rounded p-1 text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-600 dark:text-gray-500"
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
                    ref={specContentRef}
                    content={detail.content}
                    sections={detail.sections}
                    comments={detail.comments}
                    issueLinks={detail.issueLinks}
                    onSectionClick={handleSectionClick}
                    onIssueClick={handleIssueClick}
                    onCreateIssue={handleCreateIssue}
                  />
                )}
              </div>

              {/* Comment panel */}
              {showComments && (
                <div className="w-80 shrink-0 border-l border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
                  <SpecCommentPanel
                    projectId={projectId}
                    specId={detail.id}
                    comments={detail.comments}
                    filterSection={filterSection}
                    filterSectionTitle={filterSection ? detail.sections.find((s) => s.sectionId === filterSection)?.title : null}
                    onSectionClick={handleSectionClick}
                    onClearFilter={handleClearFilter}
                    onScrollToSection={handleScrollToSection}
                  />
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center">
            <div className="text-center">
              <FileText className="mx-auto h-12 w-12 text-gray-300" />
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Select a specification or create a new one</p>
            </div>
          </div>
        )}
      </div>

      {/* Create issue modal (from section heading) */}
      {createIssueForSection !== null && (
        <CreateIssueModal
          projectId={projectId}
          onClose={() => setCreateIssueForSection(null)}
          onCreated={handleIssueCreated}
        />
      )}

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setShowCreate(false)}>
          <div className="w-full max-w-2xl rounded-xl bg-white dark:bg-gray-800 p-6 shadow-xl dark:shadow-gray-900/50" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">New Specification</h3>
              <button onClick={() => setShowCreate(false)} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:text-gray-500">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-3">
              <div className="flex gap-3">
                <input
                  value={createTitle}
                  onChange={(e) => setCreateTitle(e.target.value)}
                  placeholder="Title"
                  className="flex-1 rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
                <input
                  value={createCategory}
                  onChange={(e) => setCreateCategory(e.target.value)}
                  placeholder="Category (optional)"
                  className="w-40 rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
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
                  className="rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:bg-gray-900"
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
