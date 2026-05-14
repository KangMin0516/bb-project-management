import { useState, useRef, useCallback } from 'react'
import type { ProjectMember } from '@/features/project/api'
import TipTapEditor from '@/shared/ui/editor/TipTapEditor'

interface CommentInputProps {
  members: ProjectMember[]
  onSubmit: (content: string) => void
  isSubmitting?: boolean
}

/**
 * Extract plain text from HTML for mention detection.
 */
function htmlToPlainText(html: string): string {
  const div = document.createElement('div')
  div.innerHTML = html
  return div.textContent || ''
}

export default function CommentInput({ members, onSubmit, isSubmitting }: CommentInputProps) {
  const [content, setContent] = useState('')
  const [showMentions, setShowMentions] = useState(false)
  const [mentionQuery, setMentionQuery] = useState('')
  const [mentionIndex, setMentionIndex] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)

  const filteredMembers = members.filter((m) =>
    m.user.name.toLowerCase().includes(mentionQuery.toLowerCase()) ||
    m.user.email.toLowerCase().includes(mentionQuery.toLowerCase()),
  )

  const handleChange = useCallback((value: string) => {
    setContent(value)

    // Detect @mention trigger using plain text (not HTML)
    const plainText = htmlToPlainText(value)
    const lastAt = plainText.lastIndexOf('@')
    if (lastAt >= 0) {
      const afterAt = plainText.slice(lastAt + 1)
      if (!afterAt.includes(' ') && !afterAt.includes('\n')) {
        setMentionQuery(afterAt)
        setShowMentions(true)
        setMentionIndex(0)
        return
      }
    }
    setShowMentions(false)
  }, [])

  const insertMention = useCallback((_member: ProjectMember) => {
    // For now, just close the mention popup — the mention text stays in the editor
    // Full TipTap Mention extension integration can be added later
    setShowMentions(false)
  }, [])

  const handleSubmit = () => {
    const trimmed = content.trim()
    if (!trimmed) return
    onSubmit(trimmed)
    setContent('')
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (showMentions && filteredMembers.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setMentionIndex((i) => Math.min(i + 1, filteredMembers.length - 1))
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setMentionIndex((i) => Math.max(i - 1, 0))
        return
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        insertMention(filteredMembers[mentionIndex])
        return
      }
      if (e.key === 'Escape') {
        setShowMentions(false)
        return
      }
    }

    // Cmd/Ctrl+Enter to submit
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <div ref={containerRef} className="relative" onKeyDown={handleKeyDown}>
      <TipTapEditor
        content={content}
        onChange={handleChange}
        placeholder="Add a comment... (@ to mention)"
        minHeight="80px"
        onSubmit={handleSubmit}
      />

      {showMentions && filteredMembers.length > 0 && (
        <div className="absolute z-10 mt-1 w-64 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 py-1 shadow-lg dark:shadow-gray-900/50">
          {filteredMembers.slice(0, 5).map((m, i) => (
            <button
              key={m.user.id}
              type="button"
              onClick={() => insertMention(m)}
              className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm ${
                i === mentionIndex ? 'bg-primary-50 text-primary-700' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gray-200 dark:bg-gray-600 text-[10px] font-medium">
                {m.user.name.charAt(0).toUpperCase()}
              </div>
              <span className="truncate">{m.user.name}</span>
              <span className="ml-auto truncate text-xs text-gray-400 dark:text-gray-500">{m.user.email}</span>
            </button>
          ))}
        </div>
      )}

      <div className="mt-2 flex justify-end">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!content.trim() || isSubmitting}
          className="rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? 'Posting...' : 'Comment'}
        </button>
      </div>
    </div>
  )
}
