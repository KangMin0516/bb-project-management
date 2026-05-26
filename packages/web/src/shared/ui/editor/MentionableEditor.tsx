import { useState, useRef, useCallback } from 'react'
import type { Editor } from '@tiptap/react'
import type { ProjectMember } from '@/features/project/api'
import TipTapEditor from '@/shared/ui/editor/TipTapEditor'
import UserAvatar from '@/entities/user/UserAvatar'

interface MentionableEditorProps {
  content: string
  onChange: (html: string) => void
  members: ProjectMember[]
  placeholder?: string
  minHeight?: string
  onSubmit?: () => void
  /** Called whenever the picked-mention set changes. */
  onMentionsChange?: (userIds: string[]) => void
  issueId?: string
}

function htmlToPlainText(html: string): string {
  const div = document.createElement('div')
  div.innerHTML = html
  return div.textContent || ''
}

/**
 * TipTap editor + @-mention popover. Shared between the comment input
 * and the description editor so mention insertion behaves the same in
 * both places — typed `@partial` is replaced by a styled mention node
 * with the picked user's id.
 */
export default function MentionableEditor({
  content,
  onChange,
  members,
  placeholder,
  minHeight,
  onSubmit,
  onMentionsChange,
  issueId,
}: MentionableEditorProps) {
  const [showMentions, setShowMentions] = useState(false)
  const [mentionQuery, setMentionQuery] = useState('')
  const [mentionIndex, setMentionIndex] = useState(0)
  const [mentionedUserIds, setMentionedUserIds] = useState<Set<string>>(new Set())
  const editorRef = useRef<Editor | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const filteredMembers = members.filter((m) =>
    m.user.name.toLowerCase().includes(mentionQuery.toLowerCase()) ||
    m.user.email.toLowerCase().includes(mentionQuery.toLowerCase()),
  )

  const handleChange = useCallback((value: string) => {
    onChange(value)
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
  }, [onChange])

  const insertMention = useCallback((member: ProjectMember) => {
    const editor = editorRef.current
    if (editor) {
      const { state } = editor
      const cursor = state.selection.from
      let atPos = -1
      for (let pos = cursor - 1; pos >= 1; pos--) {
        const ch = state.doc.textBetween(pos, pos + 1, '\n', '\n')
        if (ch === '@') { atPos = pos; break }
        if (ch === ' ' || ch === '\n') break
      }
      const mentionNode = {
        type: 'mention',
        attrs: { id: member.user.id, label: member.user.name },
      }
      const chain = editor.chain().focus()
      if (atPos >= 0) {
        chain.deleteRange({ from: atPos, to: cursor }).insertContent([mentionNode, { type: 'text', text: ' ' }]).run()
      } else {
        chain.insertContent([mentionNode, { type: 'text', text: ' ' }]).run()
      }
    }
    setMentionedUserIds((prev) => {
      if (prev.has(member.user.id)) return prev
      const next = new Set(prev)
      next.add(member.user.id)
      onMentionsChange?.([...next])
      return next
    })
    setShowMentions(false)
  }, [onMentionsChange])

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
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && onSubmit) {
      e.preventDefault()
      onSubmit()
    }
  }

  return (
    <div ref={containerRef} className="relative" onKeyDown={handleKeyDown}>
      <TipTapEditor
        content={content}
        onChange={handleChange}
        placeholder={placeholder}
        minHeight={minHeight}
        onSubmit={onSubmit}
        onReady={(editor) => { editorRef.current = editor }}
        issueId={issueId}
      />
      {showMentions && filteredMembers.length > 0 && (
        <div className="absolute z-10 mt-1 w-72 overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 py-1 shadow-lg dark:shadow-gray-900/50">
          {filteredMembers.slice(0, 5).map((m, i) => {
            const picked = mentionedUserIds.has(m.user.id)
            return (
              <button
                key={m.user.id}
                type="button"
                onClick={() => insertMention(m)}
                className={`flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition-colors ${
                  i === mentionIndex
                    ? 'bg-primary-50 dark:bg-primary-900/40'
                    : 'hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                <UserAvatar user={m.user} size="md" />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">
                    {m.user.name}
                  </span>
                  <span className="truncate text-xs text-gray-500 dark:text-gray-400">
                    {m.user.email}
                  </span>
                </span>
                {picked && (
                  <span className="shrink-0 text-[10px] font-semibold text-primary-600 dark:text-primary-400">
                    ✓
                  </span>
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

