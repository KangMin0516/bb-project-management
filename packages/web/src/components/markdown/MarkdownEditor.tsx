import { useState, useRef, useCallback, useEffect } from 'react'
import MarkdownViewer from './MarkdownViewer'

interface MarkdownEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  minRows?: number
}

type TabMode = 'write' | 'preview'

interface ToolbarAction {
  label: string
  icon: string
  prefix: string
  suffix: string
  block?: boolean
}

const TOOLBAR_ACTIONS: ToolbarAction[] = [
  { label: 'Bold', icon: 'B', prefix: '**', suffix: '**' },
  { label: 'Italic', icon: 'I', prefix: '_', suffix: '_' },
  { label: 'Strikethrough', icon: 'S', prefix: '~~', suffix: '~~' },
  { label: 'Link', icon: '🔗', prefix: '[', suffix: '](url)' },
  { label: 'Code', icon: '`', prefix: '`', suffix: '`' },
  { label: 'Code Block', icon: '```', prefix: '```\n', suffix: '\n```', block: true },
  { label: 'List', icon: '•', prefix: '- ', suffix: '', block: true },
  { label: 'Heading', icon: 'H', prefix: '## ', suffix: '', block: true },
]

export default function MarkdownEditor({ value, onChange, placeholder, minRows = 6 }: MarkdownEditorProps) {
  const [tab, setTab] = useState<TabMode>('write')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const applyFormat = useCallback((action: ToolbarAction) => {
    const textarea = textareaRef.current
    if (!textarea) return

    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const selected = value.slice(start, end)

    let newValue: string
    let newCursorPos: number

    if (action.block && !selected) {
      const beforeCursor = value.slice(0, start)
      const needsNewline = beforeCursor.length > 0 && !beforeCursor.endsWith('\n')
      const prefix = (needsNewline ? '\n' : '') + action.prefix
      newValue = beforeCursor + prefix + action.suffix + value.slice(end)
      newCursorPos = start + prefix.length
    } else {
      newValue = value.slice(0, start) + action.prefix + selected + action.suffix + value.slice(end)
      newCursorPos = selected ? start + action.prefix.length + selected.length + action.suffix.length : start + action.prefix.length
    }

    onChange(newValue)
    requestAnimationFrame(() => {
      textarea.focus()
      textarea.selectionStart = selected ? newCursorPos : newCursorPos
      textarea.selectionEnd = selected ? newCursorPos : newCursorPos
    })
  }, [value, onChange])

  useEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
        e.preventDefault()
        applyFormat(TOOLBAR_ACTIONS[0])
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'i') {
        e.preventDefault()
        applyFormat(TOOLBAR_ACTIONS[1])
      }
    }

    textarea.addEventListener('keydown', handleKeyDown)
    return () => textarea.removeEventListener('keydown', handleKeyDown)
  }, [applyFormat])

  return (
    <div className="rounded-lg border border-gray-300 overflow-hidden">
      <div className="flex items-center border-b border-gray-200 bg-gray-50">
        <button
          type="button"
          onClick={() => setTab('write')}
          className={`px-3 py-1.5 text-xs font-medium transition ${
            tab === 'write'
              ? 'border-b-2 border-primary-600 text-primary-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Write
        </button>
        <button
          type="button"
          onClick={() => setTab('preview')}
          className={`px-3 py-1.5 text-xs font-medium transition ${
            tab === 'preview'
              ? 'border-b-2 border-primary-600 text-primary-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Preview
        </button>
      </div>

      {tab === 'write' && (
        <div className="flex flex-wrap gap-0.5 border-b border-gray-200 bg-gray-50 px-2 py-1">
          {TOOLBAR_ACTIONS.map((action) => (
            <button
              key={action.label}
              type="button"
              title={action.label}
              onClick={() => applyFormat(action)}
              className="rounded px-1.5 py-0.5 text-xs text-gray-600 hover:bg-gray-200 hover:text-gray-900"
            >
              {action.icon}
            </button>
          ))}
        </div>
      )}

      {tab === 'write' ? (
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={minRows}
          className="w-full resize-y px-3 py-2 text-sm focus:outline-none"
        />
      ) : (
        <div className="min-h-[150px] px-3 py-2">
          {value ? (
            <MarkdownViewer content={value} />
          ) : (
            <p className="text-sm text-gray-400 italic">Nothing to preview</p>
          )}
        </div>
      )}
    </div>
  )
}
