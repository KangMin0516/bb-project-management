import { useState, useRef, type ReactNode } from 'react'
import { useOutsideClick } from '@/shared/lib/useOutsideClick'

interface InlineFieldProps {
  label: string
  /** Read-mode content. */
  display: ReactNode
  /**
   * Edit-mode content. Either static JSX, or a render function that gets a
   * `close` callback so the field can dismiss itself after an inner control
   * commits a value.
   */
  children: ReactNode | ((close: () => void) => ReactNode)
  /**
   * Used by parent shortcut handlers (e.g. press 'a' to focus assignee).
   * The trigger button gets `data-field-trigger={fieldId}` so a shortcut
   * can find and click it without lifting state up.
   */
  fieldId?: string
}

/**
 * Click-to-edit row: shows `display` until clicked, then swaps in `children`
 * (the editor). Auto-dismisses on outside click. Used heavily in the issue
 * detail metadata panel.
 */
export default function InlineField({ label, display, children, fieldId }: InlineFieldProps) {
  const [editing, setEditing] = useState(false)
  const fieldRef = useRef<HTMLDivElement>(null)

  useOutsideClick(fieldRef, editing, () => setEditing(false))

  return (
    <div className="flex items-center gap-2 py-1.5" ref={fieldRef}>
      <span className="w-20 shrink-0 text-xs font-medium text-gray-400 dark:text-gray-500">{label}</span>
      {editing ? (
        <div className="flex-1">
          {typeof children === 'function' ? children(() => setEditing(false)) : children}
        </div>
      ) : (
        <button
          data-field-trigger={fieldId}
          onClick={() => setEditing(true)}
          className="flex-1 rounded px-1.5 py-0.5 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition -mx-1.5"
        >
          {display}
        </button>
      )}
    </div>
  )
}
