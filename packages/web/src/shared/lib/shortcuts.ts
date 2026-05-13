import { create } from 'zustand'

export interface ShortcutDefinition {
  id: string
  keys: string // e.g. 'mod+k', 'j', 'g b' (sequence)
  label: string
  category: 'Navigation' | 'Board' | 'Issues' | 'Issue Detail' | 'Global'
  scope: string
  handler: () => void
  when?: () => boolean
}

interface ShortcutsState {
  shortcuts: Map<string, ShortcutDefinition>
  activeScopes: string[]
  sequenceBuffer: string
  helpModalOpen: boolean
  register: (shortcut: ShortcutDefinition) => () => void
  pushScope: (scope: string) => void
  popScope: (scope: string) => void
  setHelpModalOpen: (open: boolean) => void
  setSequenceBuffer: (buffer: string) => void
}

export const useShortcutsStore = create<ShortcutsState>((set, get) => ({
  shortcuts: new Map(),
  activeScopes: ['global'],
  sequenceBuffer: '',
  helpModalOpen: false,

  register: (shortcut) => {
    set((state) => {
      const next = new Map(state.shortcuts)
      next.set(shortcut.id, shortcut)
      return { shortcuts: next }
    })
    return () => {
      set((state) => {
        const next = new Map(state.shortcuts)
        next.delete(shortcut.id)
        return { shortcuts: next }
      })
    }
  },

  pushScope: (scope) => {
    set((state) => {
      if (state.activeScopes.includes(scope)) return state
      return { activeScopes: [...state.activeScopes, scope] }
    })
  },

  popScope: (scope) => {
    set((state) => ({
      activeScopes: state.activeScopes.filter((s) => s !== scope),
    }))
  },

  setHelpModalOpen: (open) => set({ helpModalOpen: open }),
  setSequenceBuffer: (buffer) => set({ sequenceBuffer: buffer }),
}))
