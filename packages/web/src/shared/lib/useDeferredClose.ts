import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Defers the parent-side unmount of a Radix overlay (Dialog/Sheet/Popover)
 * until its exit animation has played.
 *
 * Radix overlays only render their exit animation while `open` is
 * transitioning from `true` → `false` AND the component remains mounted.
 * Most callers in this codebase render overlays as
 * `{state && <Overlay onClose={() => setState(false)} />}`, so unmount
 * happens synchronously with `onClose` — Radix never gets a frame to
 * play the exit animation.
 *
 * This hook keeps an internal `open` flag, flips it to `false` on
 * `requestClose`, then calls the parent's `onClose` (which will unmount
 * the component) once `exitMs` has elapsed.
 *
 * `reopen` cancels any pending timer and flips `open` back to `true` —
 * useful when the same overlay instance swaps to new content mid-close
 * (e.g. issue panel navigating to a sibling issue).
 *
 * @param onClose  Fired after the exit animation finishes.
 * @param exitMs   Must match the overlay's exit-animation duration.
 *                 Defaults to 200ms (shadcn Dialog default).
 */
export function useDeferredClose(onClose: () => void, exitMs = 200) {
  const [open, setOpen] = useState(true)
  const timerRef = useRef<number | null>(null)

  const clearTimer = () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }

  useEffect(() => () => clearTimer(), [])

  const requestClose = useCallback(() => {
    if (timerRef.current !== null) return // already closing
    setOpen(false)
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null
      onClose()
    }, exitMs)
  }, [onClose, exitMs])

  const reopen = useCallback(() => {
    clearTimer()
    setOpen(true)
  }, [])

  return { open, requestClose, reopen }
}
