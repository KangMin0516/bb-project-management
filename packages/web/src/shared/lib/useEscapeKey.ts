import { useEffect, useRef } from 'react'

/**
 * Fires `onEscape` on global Escape keypress. Caller's handler is held in
 * a ref so stale closures don't matter — `onEscape` can read fresh state
 * without re-binding the listener on every render.
 */
export function useEscapeKey(onEscape: () => void) {
  const handlerRef = useRef(onEscape)
  useEffect(() => {
    handlerRef.current = onEscape
  })

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handlerRef.current()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])
}
