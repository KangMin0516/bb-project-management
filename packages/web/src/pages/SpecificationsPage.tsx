import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { FileText, PanelLeftOpen } from 'lucide-react'
import { specApi } from '@/features/specification/api'
import { projectApi } from '@/features/project/api'
import { issueApi } from '@/features/issue/api'
import { useToastStore } from '@/shared/lib/toast'
import { getErrorMessage } from '@/shared/lib/error'
import { useSpecifications } from '@/features/specification/hooks/useSpecifications'
import { useSpecReorder } from '@/features/specification/hooks/useSpecReorder'
import SpecSidebar from '@/features/specification/components/SpecSidebar'
import SpecHeader from '@/features/specification/components/SpecHeader'
import CreateSpecModal from '@/features/specification/components/CreateSpecModal'
import SpecContent, { type SpecContentHandle } from '@/features/specification/components/SpecContent'
import SpecCommentPanel from '@/features/specification/components/SpecCommentPanel'
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
  const [createIssueForSection, setCreateIssueForSection] = useState<string | null>(null)

  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectApi.get(projectId!),
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
    issueApi.createSpecLink(projectId, issueId, {
      specId: selectedId,
      sectionSlug: createIssueForSection || undefined,
    })
      .then(() => {
        queryClient.invalidateQueries({ queryKey: ['specification', projectId, selectedId] })
        useToastStore.getState().addToast('Issue created and linked to spec section', 'success')
      })
      .catch((err: unknown) => useToastStore.getState().addToast(getErrorMessage(err, 'Issue created but failed to link to spec')))
  }, [selectedId, projectId, createIssueForSection, queryClient])

  const handleDownloadAll = useCallback(() => {
    if (!projectId) return
    specApi.downloadAll(projectId).then((items) => {
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
    specApi.downloadOne(projectId, specs.detail.id).then((blob) => {
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
      {showSidebar ? (
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
      ) : (
        <div className="flex shrink-0 flex-col items-center border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 py-3 px-1.5">
          <button
            onClick={() => setShowSidebar(true)}
            className="rounded p-1.5 text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-600 dark:hover:text-gray-300"
            title="Open sidebar"
          >
            <PanelLeftOpen className="h-4 w-4" />
          </button>
        </div>
      )}

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

              {showComments && (
                <div className="w-80 shrink-0 border-l border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
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

      {createIssueForSection !== null && (
        <CreateIssueModal
          projectId={projectId}
          onClose={() => setCreateIssueForSection(null)}
          onCreated={handleIssueCreated}
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
