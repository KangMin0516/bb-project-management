import { useEffect, useState } from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/shared/ui/alert-dialog'
import { buttonVariants } from '@/shared/ui/button'
import { cn } from '@/shared/lib/utils'

export interface ConfirmDialogOptions {
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  /** Apply destructive styling to the confirm button. Default false. */
  destructive?: boolean
}

interface PendingConfirm extends ConfirmDialogOptions {
  resolve: (ok: boolean) => void
}

/**
 * Tiny pub/sub between the imperative `confirmDialog()` API and the
 * `<ConfirmDialogHost />` mounted at app root. Kept local to this module
 * so consumers only see the imperative function.
 */
let listener: ((pending: PendingConfirm) => void) | null = null

/**
 * Replacement for `window.confirm` that renders a themed shadcn
 * AlertDialog. Returns a promise that resolves to `true` if the user
 * confirms, `false` if they cancel/dismiss.
 *
 * Requires `<ConfirmDialogHost />` to be mounted once at app root.
 *
 * @example
 *   if (await confirmDialog({ title: 'Delete?', destructive: true })) {
 *     mutation.mutate(id)
 *   }
 */
// eslint-disable-next-line react-refresh/only-export-components
export function confirmDialog(options: ConfirmDialogOptions): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    if (!listener) {
      console.error('confirmDialog called before <ConfirmDialogHost /> mounted')
      resolve(false)
      return
    }
    listener({ ...options, resolve })
  })
}

/**
 * Single instance host that listens for `confirmDialog()` calls and
 * renders the actual AlertDialog. Mount once near the root of the app.
 */
export function ConfirmDialogHost() {
  const [pending, setPending] = useState<PendingConfirm | null>(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    listener = (next) => {
      setPending(next)
      setOpen(true)
    }
    return () => { listener = null }
  }, [])

  const resolveAndClose = (ok: boolean) => {
    pending?.resolve(ok)
    setOpen(false)
  }

  if (!pending) return null

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        // Treat any close (Esc, click-outside) as cancel.
        if (!next) resolveAndClose(false)
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{pending.title}</AlertDialogTitle>
          {pending.description ? (
            <AlertDialogDescription>{pending.description}</AlertDialogDescription>
          ) : (
            <AlertDialogDescription className="sr-only">{pending.title}</AlertDialogDescription>
          )}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => resolveAndClose(false)}>
            {pending.cancelLabel ?? 'Cancel'}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={() => resolveAndClose(true)}
            className={cn(
              pending.destructive && buttonVariants({ variant: 'destructive' })
            )}
          >
            {pending.confirmLabel ?? 'Confirm'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
