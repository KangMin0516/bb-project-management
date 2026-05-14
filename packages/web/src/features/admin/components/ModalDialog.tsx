import type { ReactNode } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog'
import { useDeferredClose } from '@/shared/lib/useDeferredClose'

interface ModalDialogProps {
  title: string
  onClose: () => void
  children: ReactNode
}

/**
 * Backdrop-clickable modal scaffold for the admin page's edit/reset modals.
 * Wraps shadcn Dialog so focus trap, scroll lock, escape-to-close, and
 * animation are handled by Radix. The public API (title/onClose/children)
 * is preserved so all admin callers keep working unchanged.
 */
export default function ModalDialog({ title, onClose, children }: ModalDialogProps) {
  const { open, requestClose } = useDeferredClose(onClose)

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) requestClose() }}>
      <DialogContent className="max-w-md rounded-xl">
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            {title}
          </DialogTitle>
          <DialogDescription className="sr-only">{title}</DialogDescription>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  )
}
