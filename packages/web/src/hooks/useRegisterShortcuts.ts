import { useEffect, useRef } from 'react'
import { useShortcutsStore, type ShortcutDefinition } from '@/stores/shortcuts'

export function useRegisterShortcuts(
  scope: string,
  shortcuts: Omit<ShortcutDefinition, 'scope'>[],
) {
  const shortcutsRef = useRef(shortcuts)
  shortcutsRef.current = shortcuts

  useEffect(() => {
    const store = useShortcutsStore.getState()

    // Push scope
    store.pushScope(scope)

    // Register all shortcuts
    const unregisters = shortcutsRef.current.map((s) =>
      store.register({ ...s, scope }),
    )

    return () => {
      // Unregister all
      unregisters.forEach((unregister) => unregister())
      // Pop scope
      useShortcutsStore.getState().popScope(scope)
    }
  }, [scope])
}
