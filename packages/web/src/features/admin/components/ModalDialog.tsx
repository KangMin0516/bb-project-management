import type { ReactNode } from 'react'

interface ModalDialogProps {
  title: string
  onClose: () => void
  children: ReactNode
}

/** Backdrop-clickable modal scaffold for the admin page's edit/reset modals. */
export default function ModalDialog({ title, onClose, children }: ModalDialogProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-xl bg-white dark:bg-gray-800 p-6 shadow-xl dark:shadow-gray-900/50"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-4 text-sm font-semibold text-gray-700 dark:text-gray-300">{title}</h2>
        {children}
      </div>
    </div>
  )
}
