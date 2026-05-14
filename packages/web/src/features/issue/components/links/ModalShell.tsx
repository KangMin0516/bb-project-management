import { X, ChevronLeft } from 'lucide-react'
import type { ReactNode } from 'react'

interface ModalShellProps {
  title: string
  /** Optional subline shown beneath the title. */
  subtitle?: string
  /** When provided, renders a back-arrow button beside the title. */
  onBack?: () => void
  onClose: () => void
  children: ReactNode
}

/**
 * Shared modal scaffold used by Link*-Modal components: backdrop click to
 * close, header with X, and a content area. Centralised so each modal
 * doesn't reimplement the layout / z-index / dark-mode classes.
 */
export default function ModalShell({ title, subtitle, onBack, onClose, children }: ModalShellProps) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="w-full max-w-md rounded-lg bg-white dark:bg-gray-800 shadow-xl dark:shadow-gray-900/50" onClick={(e) => e.stopPropagation()}>
        <div className="border-b border-gray-200 dark:border-gray-700 px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {onBack && (
                <button onClick={onBack} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300" aria-label="Back">
                  <ChevronLeft className="h-4 w-4" />
                </button>
              )}
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
            </div>
            <button onClick={onClose} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300" aria-label="Close">
              <X className="h-4 w-4" />
            </button>
          </div>
          {subtitle && <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 truncate">{subtitle}</p>}
        </div>
        <div className="p-4 space-y-3">{children}</div>
      </div>
    </div>
  )
}
