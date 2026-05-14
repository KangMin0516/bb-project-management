import { useState, useRef, useCallback, useEffect } from 'react'
import type { Issue } from '@/features/issue/api'
import type { ShareContext } from '@/shared/types'
import { useDeferredClose } from '@/shared/lib/useDeferredClose'
import { useIssueDetailData } from '@/features/issue/hooks/useIssueDetailData'
import { useIssueMutations } from '@/features/issue/hooks/useIssueMutations'
import { useAssignmentWithUndo } from '@/features/issue/hooks/useAssignmentWithUndo'
import { useIssueDetailShortcuts } from '@/features/issue/hooks/useIssueDetailShortcuts'
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
} from '@/shared/ui/sheet'
import IssueDetailHeader from '@/features/issue/components/detail/IssueDetailHeader'
import IssueMetadata from '@/features/issue/components/detail/IssueMetadata'
import IssueDetailTabs, { type IssueDetailTab } from '@/features/issue/components/detail/IssueDetailTabs'
import IssueDescription from '@/features/issue/components/detail/IssueDescription'
import IssueAttachments from '@/features/issue/components/detail/IssueAttachments'
import IssueSubtasks from '@/features/issue/components/detail/IssueSubtasks'
import ActivityTab from '@/features/issue/components/ActivityTab'
import LinkedIssues from '@/features/issue/components/LinkedIssues'
import LinkedPullRequests from '@/features/issue/components/LinkedPullRequests'

interface IssueDetailPanelProps {
  projectId: string
  projectKey: string
  issue: Issue
  context?: ShareContext
  onClose: () => void
  onNavigate: (issue: Issue) => void
}

/**
 * Composition root for the slide-over issue editor. Delegates data fetching,
 * mutations, and undo-toast assignment flow to hooks; layout to a handful
 * of sub-components in `./detail/`. No business logic lives here directly.
 */
/** Must match the Sheet exit-animation duration (sheetVariants → duration-300). */
const SHEET_EXIT_MS = 300

export default function IssueDetailPanel({ projectId, projectKey, issue, context, onClose, onNavigate }: IssueDetailPanelProps) {
  const [expanded, setExpanded] = useState(() => localStorage.getItem('issue-panel-expanded') === 'true')
  const [activeTab, setActiveTab] = useState<IssueDetailTab>('details')
  const [descriptionEditing, setDescriptionEditing] = useState(false)

  const panelRef = useRef<HTMLDivElement>(null)
  const { open, requestClose, reopen } = useDeferredClose(onClose, SHEET_EXIT_MS)

  // If the parent swaps in a different issue while we're mid-close, snap
  // back to open instead of waiting for the pending unmount.
  useEffect(() => { reopen() }, [issue.id, reopen])

  const { detail, members, projectLabels, projectComponents, epics } = useIssueDetailData(
    projectId,
    issue.id,
    issue.type === 'EPIC',
  )

  const { update, deleteIssue, uploadAttachment, deleteAttachment, createSubtask, invalidateAll } = useIssueMutations(
    projectId,
    issue.id,
    requestClose,
  )

  const changeAssignment = useAssignmentWithUndo({
    projectId,
    issueId: issue.id,
    members,
    onSuccess: invalidateAll,
  })

  const d = detail ?? issue
  const linkCount = (detail?.sourceLinks?.length ?? 0) + (detail?.specLinks?.length ?? 0)

  useIssueDetailShortcuts({ panelRef, disabled: descriptionEditing })

  const togglePanelExpand = useCallback(() => {
    setExpanded((curr) => {
      const next = !curr
      localStorage.setItem('issue-panel-expanded', String(next))
      return next
    })
  }, [])

  const handleAssigneeChange = useCallback(
    (id: string) => changeAssignment({ field: 'assigneeId', label: 'Assignee', newId: id, currentId: d.assigneeId }),
    [changeAssignment, d.assigneeId],
  )

  const handleReviewerChange = useCallback(
    (id: string) => changeAssignment({ field: 'reviewerAssigneeId', label: 'Reviewer', newId: id, currentId: d.reviewerAssigneeId }),
    [changeAssignment, d.reviewerAssigneeId],
  )

  return (
    <Sheet open={open} onOpenChange={(next) => { if (!next) requestClose() }}>
      <SheetContent
        side="right"
        ref={panelRef}
        className={`flex h-full w-full flex-col gap-0 bg-white dark:bg-gray-800 p-0 transition-[max-width] duration-200 ${expanded ? 'max-w-4xl sm:max-w-4xl' : 'max-w-lg sm:max-w-lg'}`}
        onEscapeKeyDown={(e) => {
          // Description handles its own Escape (cancels edit) when in edit mode.
          if (descriptionEditing) e.preventDefault()
        }}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <SheetTitle className="sr-only">{`#${d.number} ${d.title}`}</SheetTitle>
        <SheetDescription className="sr-only">Issue detail panel</SheetDescription>
        <IssueDetailHeader
          projectId={projectId}
          projectKey={projectKey}
          issue={d}
          detail={detail}
          context={context}
          expanded={expanded}
          onToggleExpand={togglePanelExpand}
          onClose={requestClose}
          onDelete={() => deleteIssue.mutate()}
          onNavigate={onNavigate}
          onTitleChange={(title) => update.mutate({ title })}
        />

        <div className="flex-1 overflow-y-auto">
          <IssueMetadata
            issue={d}
            members={members ?? []}
            projectLabels={projectLabels}
            projectComponents={projectComponents}
            epics={epics}
            onUpdate={(data) => update.mutate(data)}
            onAssigneeChange={handleAssigneeChange}
            onReviewerChange={handleReviewerChange}
          />

          <IssueDetailTabs
            active={activeTab}
            onChange={setActiveTab}
            detailsBadge={linkCount}
            activityCount={detail?.activities?.length}
          />

          {activeTab === 'details' && (
            <div className="space-y-5 p-6">
              <IssueDescription
                description={d.description}
                onSave={(description) => update.mutate({ description })}
                onEditingChange={setDescriptionEditing}
              />

              <IssueAttachments
                attachments={detail?.attachments}
                uploading={uploadAttachment.isPending}
                onUpload={(file) => uploadAttachment.mutate(file)}
                onDelete={(id) => deleteAttachment.mutate(id)}
              />

              {issue.type !== 'SUB_TASK' && (
                <IssueSubtasks
                  projectId={projectId}
                  parentId={issue.id}
                  parentStatus={d.status}
                  children={detail?.children}
                  isCreating={createSubtask.isPending}
                  onCreate={(data) => createSubtask.mutate(data)}
                  onNavigate={onNavigate}
                />
              )}

              {detail && (
                <LinkedIssues
                  projectId={projectId}
                  issueId={issue.id}
                  sourceLinks={detail.sourceLinks}
                  targetLinks={detail.targetLinks}
                  specLinks={detail.specLinks}
                />
              )}

              <LinkedPullRequests
                projectId={projectId}
                issueId={issue.id}
                prLinks={detail?.githubPrLinks}
              />
            </div>
          )}

          {activeTab === 'activity' && (
            <ActivityTab
              projectId={projectId}
              issueId={issue.id}
              activities={detail?.activities || []}
              members={members || []}
            />
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
