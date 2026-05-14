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
      const target = e.target as Element | null
      // Clicks inside a Radix popper portal (Select / Popover / Dropdown
      // content) originate outside `ref` because the content lives in a
      // body-level portal. Treat them as inside so the consumer doesn't
      // close before the Radix component can commit its value.
      if (target?.closest?.('[data-radix-popper-content-wrapper]')) return
      if (ref.current && !ref.current.contains(target as Node)) {
        onOutside()
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [ref, enabled, onOutside])
}
