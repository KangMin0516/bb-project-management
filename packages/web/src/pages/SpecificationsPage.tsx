import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { FileText, ListChecks, PanelLeftOpen, Sparkles } from 'lucide-react'
import { cn } from '@/shared/lib/utils'
import { specRepository } from '@/features/specification/repository'
import { projectRepository } from '@/features/project/repository'
import { issueRepository } from '@/features/issue/repository'
import { useToastStore } from '@/shared/lib/toast'
import { getErrorMessage } from '@/shared/lib/error'
import { useSpecifications } from '@/features/specification/hooks/useSpecifications'
import { useSpecReorder } from '@/features/specification/hooks/useSpecReorder'
import SpecSidebar from '@/features/specification/components/SpecSidebar'
import SpecHeader from '@/features/specification/components/SpecHeader'
import CreateSpecModal from '@/features/specification/components/CreateSpecModal'
import SpecContent, { type SpecContentHandle } from '@/features/specification/components/SpecContent'
import SpecCommentPanel from '@/features/specification/components/SpecCommentPanel'
import SpecItemPanel from '@/features/specification/components/SpecItemPanel'
import SpecProgressBar from '@/features/specification/components/SpecProgressBar'
import LinkIssueToItemModal from '@/features/specification/components/LinkIssueToItemModal'
import SpecAiSuggestModal from '@/features/specification/components/SpecAiSuggestModal'
import { summariseProgress } from '@/features/specification/lib/itemStatus'
import type { SpecItem } from '@/features/specification/api'
import type { SpecItemRollupStatus } from '@/features/specification/lib/itemStatus'
import MarkdownEditor from '@/shared/ui/markdown/MarkdownEditor'
import CreateIssueModal from '@/features/issue/components/CreateIssueModal'

/**
 * Three-pane spec editor: left sidebar (list), centre (content), right
 * (comments). Data fetching + mutations + drag-drop reorder live in
 * dedicated hooks; the page just orchestrates layout + URL params.
 */
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
  const [editingContent, setEditingContent] = useState(false)
  const [draftContent, setDraftContent] = useState('')
  const [showSidebar, setShowSidebar] = useState(true)
  const [showComments, setShowComments] = useState(true)
  const [showItems, setShowItems] = useState(false)
  const [itemFilter, setItemFilter] = useState<SpecItemRollupStatus | 'ALL'>('ALL')
  const [linkingItem, setLinkingItem] = useState<SpecItem | null>(null)
  const [showAiSuggest, setShowAiSuggest] = useState(false)
  const [createIssueForSection, setCreateIssueForSection] = useState<string | null>(null)
  const [createIssueForItem, setCreateIssueForItem] = useState<SpecItem | null>(null)

  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectRepository.findOne(projectId!),
    enabled: !!projectId,
  })

  const specs = useSpecifications(projectId ?? '', selectedId)
  const reorder = useSpecReorder(projectId ?? '', specs.list)

  // Honour ?specId=...&section=... deep links once the detail loads.
  useEffect(() => {
    if (pendingScrollSection && specs.detail) {
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
  }, [pendingScrollSection, specs.detail, setSearchParams])

  const handleSectionClick = useCallback((sectionId: string) => {
    setFilterSection((prev) => (prev === sectionId ? null : sectionId))
    setShowComments(true)
  }, [])

  const handleIssueCreated = useCallback((issueId: string) => {
    if (!selectedId || !projectId) return
    // Two distinct create flows: from a section heading (legacy IssueSpecLink)
    // vs from a SpecItem checkbox (new SpecItemIssueLink).
    if (createIssueForItem) {
      specRepository
        .linkIssueToItem(projectId, selectedId, createIssueForItem.id, issueId)
        .then(() => {
          queryClient.invalidateQueries({ queryKey: ['specification', projectId, selectedId] })
          useToastStore.getState().addToast('Issue created and linked to item', 'success')
        })
        .catch((err: unknown) =>
          useToastStore.getState().addToast(
            getErrorMessage(err, 'Issue created but failed to link to item'),
            'error',
          ),
        )
      return
    }
    issueRepository.createSpecLink(projectId, issueId, {
      specId: selectedId,
      sectionSlug: createIssueForSection || undefined,
    })
      .then(() => {
        queryClient.invalidateQueries({ queryKey: ['specification', projectId, selectedId] })
        useToastStore.getState().addToast('Issue created and linked to spec section', 'success')
      })
      .catch((err: unknown) => useToastStore.getState().addToast(getErrorMessage(err, 'Issue created but failed to link to spec'), 'error'))
  }, [selectedId, projectId, createIssueForSection, createIssueForItem, queryClient])

  const itemSummary = useMemo(
    () => summariseProgress(specs.detail?.items ?? []),
    [specs.detail],
  )

  const handleDownloadAll = useCallback(() => {
    if (!projectId) return
    specRepository.downloadAll(projectId).then((items) => {
      for (const spec of items) {
        const blob = new Blob([spec.content], { type: 'text/markdown' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${spec.filename}.md`
        a.click()
        URL.revokeObjectURL(url)
      }
    })
  }, [projectId])

  const handleDownloadOne = useCallback(() => {
    if (!projectId || !specs.detail) return
    specRepository.downloadOne(projectId, specs.detail.id).then((blob) => {
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${specs.detail!.title.replace(/[^a-zA-Z0-9가-힣\s_-]/g, '').replace(/\s+/g, '_')}.md`
      a.click()
      URL.revokeObjectURL(url)
    })
  }, [projectId, specs.detail])

  if (!projectId) return null

  return (
    <div className="flex h-full">
      {/* Sidebar open state — width animates 0 ↔ 256, content keeps its
          intrinsic w-64 inside and gets clipped during transition. */}
      <div
        className={cn(
          'shrink-0 overflow-hidden transition-[width] duration-200 ease-in-out',
          showSidebar ? 'w-64' : 'w-0',
        )}
      >
        <SpecSidebar
          projectKey={project?.key ?? ''}
          specs={specs.list}
          selectedId={selectedId}
          isLoading={specs.isLoading}
          onSelect={(id) => { setSelectedId(id); setFilterSection(null); setEditingContent(false) }}
          onCreate={() => setShowCreate(true)}
          onDownloadAll={handleDownloadAll}
          onClose={() => setShowSidebar(false)}
          onReorder={reorder}
        />
      </div>
      {/* Collapsed rail — complementary width so the two animate in lockstep
          (closing the sidebar opens the rail and vice versa). */}
      <div
        className={cn(
          'shrink-0 overflow-hidden transition-[width] duration-200 ease-in-out',
          showSidebar ? 'w-0' : 'w-12',
        )}
      >
        <div className="flex h-full w-12 flex-col items-center border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 py-3 px-1.5">
          <button
            onClick={() => setShowSidebar(true)}
            className="rounded p-1.5 text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-600 dark:hover:text-gray-300"
            title="Open sidebar"
          >
            <PanelLeftOpen className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="flex flex-1 flex-col overflow-hidden">
        {specs.detail ? (
          <>
            <SpecHeader
              spec={specs.detail}
              editing={editingContent}
              isUpdating={specs.update.isPending}
              showComments={showComments}
              onStatusChange={(status) => specs.update.mutate({ status })}
              onEdit={() => { setDraftContent(specs.detail!.content); setEditingContent(true) }}
              onCancel={() => setEditingContent(false)}
              onSave={() => specs.update.mutate({ content: draftContent }, { onSuccess: () => setEditingContent(false) })}
              onDownload={handleDownloadOne}
              onDelete={() => specs.remove.mutate(undefined, { onSuccess: () => setSelectedId(null) })}
              onToggleComments={() => setShowComments((v) => !v)}
            />

            {/* Progress strip — always rendered so the "Suggest items" /
                "Items" controls are reachable even before the first
                checkbox is added. When there are no items yet,
                SpecProgressBar shows a hint instead of an empty bar. */}
            <div className="flex items-center gap-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2">
              <div className="flex-1">
                <SpecProgressBar summary={itemSummary} variant="detailed" />
              </div>
              <button
                type="button"
                onClick={() => setShowAiSuggest(true)}
                className="inline-flex items-center gap-1 rounded-md border border-amber-200 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/30 px-2 py-1 text-xs font-medium text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/50"
                title="Use AI to extract trackable items from this spec's content"
              >
                <Sparkles className="h-3.5 w-3.5" />
                Suggest items
              </button>
              <button
                type="button"
                onClick={() => setShowItems((v) => !v)}
                disabled={itemSummary.total === 0}
                className={cn(
                  'inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium transition disabled:opacity-50',
                  showItems
                    ? 'border-gray-300 bg-gray-100 text-gray-800 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100'
                    : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700',
                )}
                title={showItems ? 'Hide item panel' : 'Show item panel'}
              >
                <ListChecks className="h-3.5 w-3.5" />
                Items
              </button>
            </div>

            <div className="flex flex-1 overflow-hidden">
              <div className="flex-1 overflow-y-auto p-6">
                {editingContent ? (
                  <MarkdownEditor value={draftContent} onChange={setDraftContent} minRows={20} />
                ) : (
                  <SpecContent
                    ref={specContentRef}
                    content={specs.detail.content}
                    sections={specs.detail.sections}
                    comments={specs.detail.comments}
                    issueLinks={specs.detail.issueLinks}
                    onSectionClick={handleSectionClick}
                    onIssueClick={(issueId) => navigate(`/projects/${projectId}/lists?issue=${issueId}`)}
                    onCreateIssue={setCreateIssueForSection}
                  />
                )}
              </div>

              {/* Items panel — gated by progress strip toggle. Sits to the
                  left of the comments panel so the comments column keeps
                  its existing position. */}
              {showItems && specs.detail.items && (
                <SpecItemPanel
                  projectId={projectId}
                  specId={specs.detail.id}
                  items={specs.detail.items}
                  filter={itemFilter}
                  onFilterChange={setItemFilter}
                  onLinkExistingIssue={(item) => setLinkingItem(item)}
                  onCreateIssueFromItem={(item) => setCreateIssueForItem(item)}
                  onIssueClick={(issueId) => navigate(`/projects/${projectId}/lists?issue=${issueId}`)}
                />
              )}

              {/* Right comments panel — width animates 0 ↔ 320; the inner
                  div keeps its w-80 so content doesn't reflow during the
                  transition. Panel stays mounted so scroll position +
                  composing-comment drafts survive a hide/show round-trip. */}
              <div
                className={cn(
                  'shrink-0 overflow-hidden transition-[width] duration-200 ease-in-out',
                  showComments ? 'w-80' : 'w-0',
                )}
              >
                <div className="h-full w-80 border-l border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
                  <SpecCommentPanel
                    projectId={projectId}
                    specId={specs.detail.id}
                    comments={specs.detail.comments}
                    filterSection={filterSection}
                    filterSectionTitle={filterSection ? specs.detail.sections.find((s) => s.sectionId === filterSection)?.title : null}
                    onSectionClick={handleSectionClick}
                    onClearFilter={() => setFilterSection(null)}
                    onScrollToSection={(id) => specContentRef.current?.scrollToSection(id)}
                  />
                </div>
              </div>
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

      {(createIssueForSection !== null || createIssueForItem !== null) && (
        <CreateIssueModal
          projectId={projectId}
          onClose={() => {
            setCreateIssueForSection(null)
            setCreateIssueForItem(null)
          }}
          onCreated={(issueId) => {
            handleIssueCreated(issueId)
            setCreateIssueForSection(null)
            setCreateIssueForItem(null)
          }}
        />
      )}

      {linkingItem && specs.detail && (
        <LinkIssueToItemModal
          projectId={projectId}
          projectKey={project?.key}
          specId={specs.detail.id}
          item={linkingItem}
          onClose={() => setLinkingItem(null)}
        />
      )}

      {showAiSuggest && specs.detail && (
        <SpecAiSuggestModal
          projectId={projectId}
          specId={specs.detail.id}
          specContent={specs.detail.content}
          onClose={() => setShowAiSuggest(false)}
          onApply={(newContent) => {
            setShowAiSuggest(false)
            specs.update.mutate({ content: newContent })
          }}
        />
      )}

      {showCreate && (
        <CreateSpecModal
          isPending={specs.create.isPending}
          onCreate={(data) => specs.create.mutate(data, {
            onSuccess: (created) => { setSelectedId(created.id); setShowCreate(false) },
          })}
          onClose={() => setShowCreate(false)}
        />
      )}
    </div>
  )
}
