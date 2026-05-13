import { useEffect, useRef } from 'react'
import { useShortcutsStore } from '@/stores/shortcuts'

function isEditableTarget(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) return false
  const tag = target.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
  if (target.isContentEditable) return true
  // TipTap editor
  if (target.closest('.tiptap, .ProseMirror, [contenteditable="true"]')) return true
  return false
}

function normalizeKey(e: KeyboardEvent): string {
  const parts: string[] = []
  if (e.metaKey || e.ctrlKey) parts.push('mod')
  if (e.altKey) parts.push('alt')
  if (e.shiftKey) parts.push('shift')

  let key = e.key.toLowerCase()
  // Normalize special keys
  if (key === ' ') key = 'space'
  if (key === 'escape') key = 'escape'

  // Don't add modifier keys themselves as the key part
  if (!['control', 'meta', 'alt', 'shift'].includes(key)) {
    parts.push(key)
  }

  return parts.join('+')
}

export function useKeyboardShortcuts() {
  const sequenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const store = useShortcutsStore.getState()
      const { shortcuts, activeScopes, sequenceBuffer } = store
      const normalizedKey = normalizeKey(e)

      // Skip if only modifier key pressed
      if (['mod', 'alt', 'shift', ''].includes(normalizedKey)) return

      const hasModifier = e.metaKey || e.ctrlKey || e.altKey
      const editable = isEditableTarget(e.target)

      // If editing, only allow modifier combos and Escape
      if (editable && !hasModifier && normalizedKey !== 'escape') return

      // Check for sequence matches first (e.g., "g b")
      if (sequenceBuffer) {
        const seqKey = `${sequenceBuffer} ${normalizedKey}`

        // Clear the sequence buffer
        if (sequenceTimerRef.current) {
          clearTimeout(sequenceTimerRef.current)
          sequenceTimerRef.current = null
        }
        store.setSequenceBuffer('')

        // Find matching sequence shortcut
        for (const shortcut of shortcuts.values()) {
          if (shortcut.keys !== seqKey) continue
          if (!activeScopes.includes(shortcut.scope)) continue
          if (shortcut.when && !shortcut.when()) continue
          e.preventDefault()
          shortcut.handler()
          return
        }
        // No match — fall through to check as single key
      }

      // Check if this key starts a sequence
      let isSequenceStart = false
      for (const shortcut of shortcuts.values()) {
        if (!shortcut.keys.includes(' ')) continue
        const prefix = shortcut.keys.split(' ')[0]
        if (prefix === normalizedKey && activeScopes.includes(shortcut.scope)) {
          isSequenceStart = true
          break
        }
      }

      if (isSequenceStart && !hasModifier && !editable) {
        e.preventDefault()
        store.setSequenceBuffer(normalizedKey)
        sequenceTimerRef.current = setTimeout(() => {
          store.setSequenceBuffer('')
        }, 1000)
        return
      }

      // Direct match
      for (const shortcut of shortcuts.values()) {
        if (shortcut.keys !== normalizedKey) continue
        if (!activeScopes.includes(shortcut.scope)) continue
        if (shortcut.when && !shortcut.when()) continue
        e.preventDefault()
        shortcut.handler()
        return
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      if (sequenceTimerRef.current) clearTimeout(sequenceTimerRef.current)
    }
  }, [])
}
