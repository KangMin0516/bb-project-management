import { useState, useCallback } from 'react'
import type { ProjectMember } from '@/features/project/api'
import MentionableEditor from '@/shared/ui/editor/MentionableEditor'

interface CommentInputProps {
  members: ProjectMember[]
  onSubmit: (content: string, mentionedUserIds: string[]) => void
  isSubmitting?: boolean
}

export default function CommentInput({ members, onSubmit, isSubmitting }: CommentInputProps) {
  const [content, setContent] = useState('')
  const [mentionedUserIds, setMentionedUserIds] = useState<string[]>([])

  const handleSubmit = useCallback(() => {
    const trimmed = content.trim()
    if (!trimmed) return
    onSubmit(trimmed, mentionedUserIds)
    setContent('')
    setMentionedUserIds([])
  }, [content, mentionedUserIds, onSubmit])

  return (
    <div>
      <MentionableEditor
        content={content}
        onChange={setContent}
        members={members}
        placeholder="Add a comment... (@ to mention)"
        minHeight="80px"
        onSubmit={handleSubmit}
        onMentionsChange={setMentionedUserIds}
      />
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
