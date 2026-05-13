import { useEffect, type RefObject } from 'react'

/**
 * Calls `onOutside` when a mousedown lands outside `ref`. No-op while
 * `enabled` is false so callers don't pay for an event listener they
 * don't need.
 */
export function useOutsideClick(
  ref: RefObject<HTMLElement | null>,
  enabled: boolean,
  onOutside: () => void,
) {
  useEffect(() => {
    if (!enabled) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onOutside()
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [ref, enabled, onOutside])
}
