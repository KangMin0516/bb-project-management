import { create } from 'zustand'
import { TOAST_DURATION } from '@/lib/constants'

export type ToastType = 'error' | 'success' | 'info'

export interface ToastAction {
  label: string
  /** Called when the user clicks the action. Toast is dismissed automatically afterwards. */
  onAction: () => void
}

export interface Toast {
  id: number
  message: string
  type: ToastType
  action?: ToastAction
  /** Total ms before auto-dismiss. Used to render a countdown. */
  durationMs: number
  /** Wall-clock ms when this toast was opened (for countdown). */
  startedAt: number
  /** Called when the toast auto-dismisses (NOT when user clicks action). */
  onExpire?: () => void
}

interface ShowActionToastInput {
  /**
   * External de-dup key. If a toast with this key is already open, it's
   * replaced (its expire callback IS fired before being replaced, so any
   * pending work it represents is finalised).
   */
  key: string
  message: string
  action: ToastAction
  /** Defaults to TOAST_DURATION. */
  durationMs?: number
  onExpire?: () => void
  type?: ToastType
}

interface ToastState {
  toasts: Toast[]
  /** Internal map of toast.id → de-dup key + timer + onExpire, for replacement. */
  addToast: (message: string, type?: 'error' | 'success') => void
  /**
   * Show a toast with an action button (e.g. "Undo") and an explicit duration.
   * If another toast with the same `key` is currently visible, it is replaced.
   */
  showActionToast: (input: ShowActionToastInput) => void
  removeToast: (id: number) => void
}

let nextId = 0

// Track timers + de-dup keys outside zustand state — they're imperative bookkeeping.
const timers = new Map<number, ReturnType<typeof setTimeout>>()
const keyToId = new Map<string, number>()
const onExpireById = new Map<number, () => void>()

function clearTimer(id: number) {
  const t = timers.get(id)
  if (t) {
    clearTimeout(t)
    timers.delete(id)
  }
}

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],
  addToast: (message, type = 'error') => {
    const id = nextId++
    const startedAt = Date.now()
    set((state) => ({
      toasts: [
        ...state.toasts,
        { id, message, type, durationMs: TOAST_DURATION, startedAt },
      ],
    }))
    const t = setTimeout(() => {
      timers.delete(id)
      set((state) => ({ toasts: state.toasts.filter((x) => x.id !== id) }))
    }, TOAST_DURATION)
    timers.set(id, t)
  },
  showActionToast: ({ key, message, action, durationMs = TOAST_DURATION, onExpire, type = 'info' }) => {
    // Replace an existing toast with the same key (e.g. user reassigned the
    // same issue within the undo window). Fire its onExpire so any deferred
    // work it represents is finalised before we overwrite.
    const existingId = keyToId.get(key)
    if (existingId !== undefined) {
      clearTimer(existingId)
      const onExp = onExpireById.get(existingId)
      onExpireById.delete(existingId)
      onExp?.()
      set((state) => ({ toasts: state.toasts.filter((x) => x.id !== existingId) }))
    }

    const id = nextId++
    keyToId.set(key, id)
    if (onExpire) onExpireById.set(id, onExpire)
    const startedAt = Date.now()
    set((state) => ({
      toasts: [
        ...state.toasts,
        { id, message, type, action: {
          label: action.label,
          onAction: () => {
            // Run the action, then dismiss without firing onExpire (Undo ≠ expire).
            clearTimer(id)
            keyToId.delete(key)
            onExpireById.delete(id)
            action.onAction()
            set((state) => ({ toasts: state.toasts.filter((x) => x.id !== id) }))
          },
        }, durationMs, startedAt, onExpire },
      ],
    }))
    const t = setTimeout(() => {
      timers.delete(id)
      keyToId.delete(key)
      const onExp = onExpireById.get(id)
      onExpireById.delete(id)
      set((state) => ({ toasts: state.toasts.filter((x) => x.id !== id) }))
      onExp?.()
    }, durationMs)
    timers.set(id, t)
    // Touch get() so the linter doesn't complain about unused
    void get
  },
  removeToast: (id) => {
    clearTimer(id)
    // If this toast had a key, free it.
    for (const [k, v] of keyToId) if (v === id) keyToId.delete(k)
    onExpireById.delete(id)
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }))
  },
}))
