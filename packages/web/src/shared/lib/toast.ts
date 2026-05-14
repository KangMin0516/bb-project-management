import { toast as sonner } from 'sonner'
import { TOAST_DURATION } from '@/shared/config/constants'

export type ToastType = 'error' | 'success' | 'info'

export interface ToastAction {
  label: string
  onAction: () => void
}

interface ShowActionToastInput {
  key: string
  message: string
  action: ToastAction
  durationMs?: number
  onExpire?: () => void
  type?: ToastType
}

// Tracks onExpire callbacks indexed by de-dup key so replacement toasts
// can fire the previous toast's callback before overwriting it.
const keyToOnExpire = new Map<string, () => void>()

function addToast(message: string, type: ToastType = 'info') {
  if (type === 'error') sonner.error(message, { duration: TOAST_DURATION })
  else if (type === 'success') sonner.success(message, { duration: TOAST_DURATION })
  else sonner(message, { duration: TOAST_DURATION })
}

function showActionToast({
  key,
  message,
  action,
  durationMs = TOAST_DURATION,
  onExpire,
  type = 'info',
}: ShowActionToastInput) {
  // When replacing an existing toast (same key), fire its onExpire so any
  // deferred work it represents is finalised before we overwrite.
  const existing = keyToOnExpire.get(key)
  if (existing) {
    keyToOnExpire.delete(key)
    existing()
  }

  if (onExpire) keyToOnExpire.set(key, onExpire)

  const toastFn = type === 'error' ? sonner.error : type === 'success' ? sonner.success : sonner

  toastFn(message, {
    id: key,
    duration: durationMs,
    action: {
      label: action.label,
      onClick: () => {
        // User clicked action (Undo) — discard onExpire, don't fire it.
        keyToOnExpire.delete(key)
        action.onAction()
      },
    },
    onAutoClose: () => {
      const cb = keyToOnExpire.get(key)
      if (cb) {
        keyToOnExpire.delete(key)
        cb()
      }
    },
  })
}

// Expose a .getState() shim so all call sites (useToastStore.getState().addToast)
// continue to work without modification.
export const useToastStore = {
  getState: () => ({ addToast, showActionToast }),
}
