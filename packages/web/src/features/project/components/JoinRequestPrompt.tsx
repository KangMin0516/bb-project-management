import { useState } from 'react'
import { Send, UserPlus, Clock } from 'lucide-react'

interface JoinRequestPromptProps {
  hasPending: boolean
  isSending: boolean
  onSend: (message?: string) => void
}

/**
 * Tri-state CTA inside a non-member's project card:
 * 1. Pending → status pill
 * 2. Composing → inline message form
 * 3. Idle → "Request to Join" button
 */
export default function JoinRequestPrompt({ hasPending, isSending, onSend }: JoinRequestPromptProps) {
  const [composing, setComposing] = useState(false)
  const [message, setMessage] = useState('')

  if (hasPending) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
        <Clock className="h-3.5 w-3.5" />
        Pending request
      </div>
    )
  }

  if (!composing) {
    return (
      <button
        onClick={(e) => { e.stopPropagation(); setComposing(true) }}
        className="flex items-center gap-1.5 rounded-lg border border-primary-300 dark:border-primary-700 px-3 py-1.5 text-xs font-medium text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20"
      >
        <UserPlus className="h-3.5 w-3.5" />
        Request to Join
      </button>
    )
  }

  const submit = () => onSend(message || undefined)

  return (
    <div className="space-y-2">
      <input
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Message (optional)"
        className="w-full rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-sm focus:border-primary-500 focus:outline-none"
        onKeyDown={(e) => e.key === 'Enter' && submit()}
        autoFocus
      />
      <div className="flex gap-2">
        <button
          onClick={submit}
          disabled={isSending}
          className="flex items-center gap-1 rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-700 disabled:opacity-50"
        >
          <Send className="h-3 w-3" />
          Send
        </button>
        <button
          onClick={() => { setComposing(false); setMessage('') }}
          className="rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
