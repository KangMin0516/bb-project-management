import { ChevronLeft } from 'lucide-react'
import type { ReactNode } from 'react'
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/shared/ui/dialog'
import { useDeferredClose } from '@/shared/lib/useDeferredClose'

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
 * Shared modal scaffold used by Link*-Modal components. Built on shadcn
 * Dialog so focus trap, scroll lock, escape-to-close, and animation are
 * handled by Radix; this component layers in the back-arrow affordance
 * and the project's header layout. `useDeferredClose` keeps the dialog
 * mounted long enough for Radix to play its exit animation before the
 * parent unmounts the component.
 */
export default function ModalShell({ title, subtitle, onBack, onClose, children }: ModalShellProps) {
  const { open, requestClose } = useDeferredClose(onClose)

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) requestClose() }}>
      <DialogContent
        className="z-[60] w-[calc(100vw-2rem)] max-w-md gap-0 overflow-hidden rounded-lg p-0"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="min-w-0 border-b border-gray-200 dark:border-gray-700 px-4 py-3 pr-10">
          <div className="flex min-w-0 items-center gap-2">
            {onBack && (
              <button
                onClick={onBack}
                className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
                aria-label="Back"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            )}
            <DialogTitle className="min-w-0 truncate text-sm font-semibold text-gray-900 dark:text-gray-100">
              {title}
            </DialogTitle>
          </div>
          <DialogDescription
            className={subtitle ? 'mt-1 truncate text-xs text-gray-500 dark:text-gray-400' : 'sr-only'}
          >
            {subtitle || title}
          </DialogDescription>
        </div>
        <div className="min-w-0 space-y-3 p-4">{children}</div>
      </DialogContent>
    </Dialog>
  )
}
