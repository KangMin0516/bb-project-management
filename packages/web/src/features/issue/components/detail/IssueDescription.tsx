import { useState } from 'react'
import MarkdownViewer from '@/shared/ui/markdown/MarkdownViewer'
import TipTapEditor from '@/shared/ui/editor/TipTapEditor'
import MentionableEditor from '@/shared/ui/editor/MentionableEditor'
import type { ProjectMember } from '@/features/project/api'
import { useImagePreviewStore } from '@/shared/lib/imagePreview'

interface IssueDescriptionProps {
  description: string | null
  /**
   * Notified once the user clicks Save with the new markdown. Receives the
   * user IDs picked from the @-picker during this edit so the parent can
   * send them to the API for MENTIONED notification dispatch.
   */
  onSave: (next: string, mentionedUserIds: string[]) => void
  /** Tells parent to react to edit mode (e.g., disable Escape close). */
  onEditingChange?: (editing: boolean) => void
  /** When provided, the editor offers @-mentions for these members. */
  members?: ProjectMember[]
}

/**
 * Click-to-edit description. Reading mode renders Markdown and lets images
 * open the global lightbox; editing mode mounts a full TipTap editor with
 * explicit Save/Cancel — Esc cancels without saving.
 */
export default function IssueDescription({ description, onSave, onEditingChange, members }: IssueDescriptionProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [mentionedUserIds, setMentionedUserIds] = useState<string[]>([])

  const enterEdit = () => {
    setDraft(description ?? '')
    setMentionedUserIds([])
    setEditing(true)
    onEditingChange?.(true)
  }

  const exitEdit = () => {
    setEditing(false)
    onEditingChange?.(false)
  }

  const handleClickRead = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).tagName === 'IMG') {
      const img = e.target as HTMLImageElement
      if (img.src) useImagePreviewStore.getState().open(img.src, img.alt || '')
      return
    }
    enterEdit()
  }

  return (
    <div>
      <span className="block text-xs font-medium text-gray-500 mb-1">Description</span>
      {editing ? (
        <div>
          {members && members.length > 0 ? (
            <MentionableEditor
              content={draft}
              onChange={setDraft}
              members={members}
              placeholder="Add description... (@ to mention)"
              minHeight="150px"
              onMentionsChange={setMentionedUserIds}
            />
          ) : (
            <TipTapEditor content={draft} onChange={setDraft} placeholder="Add description..." minHeight="150px" />
          )}
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() => { onSave(draft, mentionedUserIds); exitEdit() }}
              className="rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-700"
            >
              Save
            </button>
            <button
              type="button"
              onClick={exitEdit}
              className="rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div
          onClick={handleClickRead}
          className="group cursor-pointer rounded-lg border border-transparent p-2 -m-2 hover:border-gray-200 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700"
        >
          {description ? <MarkdownViewer content={description} /> : <p className="text-sm text-gray-400 italic">Add description...</p>}
        </div>
      )}
    </div>
  )
}
