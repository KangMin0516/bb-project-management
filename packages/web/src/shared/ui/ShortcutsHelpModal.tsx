import { useShortcutsStore } from '@/shared/lib/shortcuts'
import { useMemo } from 'react'
import { X } from 'lucide-react'

const CATEGORY_ORDER = ['Global', 'Navigation', 'Board', 'Issues', 'Issue Detail'] as const

function KbdKey({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex min-w-[24px] items-center justify-center rounded-md border border-gray-300 bg-gray-50 px-1.5 py-0.5 text-xs font-medium text-gray-600 shadow-sm">
      {children}
    </kbd>
  )
}

function formatKeys(keys: string): React.ReactNode {
  const isMac = navigator.platform.toUpperCase().includes('MAC')

  return keys.split(' ').map((part, i, arr) => {
    const combo = part.split('+').map((k) => {
      if (k === 'mod') return isMac ? '\u2318' : 'Ctrl'
      if (k === 'shift') return '\u21E7'
      if (k === 'alt') return isMac ? '\u2325' : 'Alt'
      if (k === 'escape') return 'Esc'
      if (k === 'enter') return '\u21B5'
      return k.toUpperCase()
    })

    return (
      <span key={i} className="inline-flex items-center gap-0.5">
        {combo.map((c, j) => (
          <KbdKey key={j}>{c}</KbdKey>
        ))}
        {i < arr.length - 1 && <span className="mx-1 text-xs text-gray-400">then</span>}
      </span>
    )
  })
}

export default function ShortcutsHelpModal() {
  const { helpModalOpen, setHelpModalOpen, shortcuts } = useShortcutsStore()

  const grouped = useMemo(() => {
    const groups = new Map<string, { keys: string; label: string }[]>()
    for (const s of shortcuts.values()) {
      const list = groups.get(s.category) || []
      // Avoid duplicates by label
      if (!list.some((item) => item.label === s.label)) {
        list.push({ keys: s.keys, label: s.label })
      }
      groups.set(s.category, list)
    }
    return groups
  }, [shortcuts])

  if (!helpModalOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={() => setHelpModalOpen(false)}
    >
      <div className="fixed inset-0 bg-black/40" />
      <div
        className="relative w-full max-w-2xl rounded-xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-bold text-gray-900">Keyboard Shortcuts</h2>
          <button
            onClick={() => setHelpModalOpen(false)}
            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto px-6 py-4">
          <div className="grid grid-cols-2 gap-6">
            {CATEGORY_ORDER.map((category) => {
              const items = grouped.get(category)
              if (!items || items.length === 0) return null
              return (
                <div key={category}>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
                    {category}
                  </h3>
                  <div className="space-y-1.5">
                    {items.map((item) => (
                      <div
                        key={item.label}
                        className="flex items-center justify-between rounded-lg px-2 py-1.5"
                      >
                        <span className="text-sm text-gray-700">{item.label}</span>
                        <div className="flex items-center gap-1">{formatKeys(item.keys)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="border-t border-gray-200 px-6 py-3">
          <p className="text-xs text-gray-400">
            Press <KbdKey>?</KbdKey> to toggle this dialog
          </p>
        </div>
      </div>
    </div>
  )
}
