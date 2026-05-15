import { useEffect, useRef } from 'react'

/**
 * Click-and-drag horizontal scroll, à la Jira/Trello board. Returns a ref to
 * attach to the scroll container; drags initiated on the container's empty
 * area (column headers, gaps between columns) translate cursor delta into
 * `scrollLeft`. Drags initiated on a `@hello-pangea/dnd` draggable card,
 * button, link, or form control are ignored — those keep their own
 * interaction model.
 *
 * A 5px movement threshold prevents accidental hijack of short clicks, and
 * the click that follows an active drag is suppressed via a one-shot
 * capture-phase listener so releasing over a card doesn't open it.
 */
export function useDragScroll<T extends HTMLElement>() {
  const ref = useRef<T | null>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    type DragState = { startX: number; startScroll: number; active: boolean }
    let state: DragState | null = null

    const isInteractive = (target: EventTarget | null): boolean => {
      if (!(target instanceof HTMLElement)) return false
      return !!target.closest(
        '[data-rfd-draggable-id], button, a, input, textarea, select, [role="button"]',
      )
    }

    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return
      if (isInteractive(e.target)) return
      state = {
        startX: e.clientX,
        startScroll: el.scrollLeft,
        active: false,
      }
    }

    const onMouseMove = (e: MouseEvent) => {
      if (!state) return
      const delta = e.clientX - state.startX
      if (!state.active) {
        if (Math.abs(delta) < 5) return
        state.active = true
        el.style.cursor = 'grabbing'
        document.body.style.userSelect = 'none'
      }
      el.scrollLeft = state.startScroll - delta
    }

    const onMouseUp = () => {
      if (!state) return
      const wasActive = state.active
      state = null
      el.style.cursor = ''
      document.body.style.userSelect = ''
      if (wasActive) {
        const suppress = (ev: Event) => {
          ev.stopPropagation()
          ev.preventDefault()
        }
        window.addEventListener('click', suppress, { capture: true, once: true })
      }
    }

    el.addEventListener('mousedown', onMouseDown)
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)

    return () => {
      el.removeEventListener('mousedown', onMouseDown)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [])

  return ref
}
