import { useEffect, useRef } from 'react'
import { useShortcutsStore, type ShortcutDefinition } from '@/shared/lib/shortcuts'

export function useRegisterShortcuts(
  scope: string,
  shortcuts: Omit<ShortcutDefinition, 'scope'>[],
) {
  const shortcutsRef = useRef(shortcuts)
  shortcutsRef.current = shortcuts

  // Scope lifecycle — push/pop once
  useEffect(() => {
    const store = useShortcutsStore.getState()
    store.pushScope(scope)
    return () => {
      useShortcutsStore.getState().popScope(scope)
    }
  }, [scope])

  // Re-register shortcuts when handlers/keys change
  useEffect(() => {
    const store = useShortcutsStore.getState()

    const unregisters = shortcutsRef.current.map((s) =>
      store.register({ ...s, scope }),
    )

    return () => {
      unregisters.forEach((unregister) => unregister())
    }
  }, [scope, shortcuts])
}
