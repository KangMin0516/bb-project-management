import { useState } from 'react'
import { X } from 'lucide-react'
import type { Label } from '@/features/project/api'
import { confirmDialog } from '@/shared/ui/confirm-dialog'
import { useToastStore } from '@/shared/lib/toast'
import SettingsSection from './SettingsSection'

interface LabelsSectionProps {
  labels: Label[] | undefined
  onCreate: (data: { name: string; color: string }) => void
  onRemove: (labelId: string) => void
  onSeed: () => void
}

export default function LabelsSection({ labels, onCreate, onRemove, onSeed }: LabelsSectionProps) {
  const [name, setName] = useState('')
  const [color, setColor] = useState('#6366f1')

  const submit = () => {
    if (!name) return
    onCreate({ name, color })
    setName('')
  }

  const handleDelete = async (l: Label) => {
    const usage = l._count?.issues ?? 0
    if (usage > 0) {
      // Block instead of offering a force-delete: cascading would silently
      // strip the label from every issue and leave audit logs orphaned.
      useToastStore.getState().addToast(
        `"${l.name}" is used by ${usage} issue(s). Remove it from those issues first.`,
        'error',
      )
      return
    }
    const ok = await confirmDialog({
      title: `Delete label "${l.name}"?`,
      description: 'This cannot be undone.',
      confirmLabel: 'Delete',
      destructive: true,
    })
    if (ok) onRemove(l.id)
  }

  return (
    <SettingsSection title="Labels">
      <div className="mb-3 flex flex-wrap gap-1.5">
        {labels?.map((l) => {
          const usage = l._count?.issues ?? 0
          return (
            <span
              key={l.id}
              className="group inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium"
              style={{ backgroundColor: l.color + '20', color: l.color }}
              title={usage > 0 ? `In use by ${usage} issue(s)` : 'Unused — safe to delete'}
            >
              {l.name}
              <button
                type="button"
                onClick={() => void handleDelete(l)}
                aria-label={`Delete ${l.name}`}
                className="ml-0.5 rounded-full p-0.5 opacity-50 transition hover:bg-black/10 hover:opacity-100 dark:hover:bg-white/10"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          )
        })}
        {!labels?.length && (
          <span className="text-sm text-gray-400 dark:text-gray-500">No labels yet</span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={color}
          onChange={(e) => setColor(e.target.value)}
          className="h-8 w-8 cursor-pointer rounded border-0"
        />
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Label name"
          className="flex-1 rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-sm focus:outline-none"
        />
        <button
          onClick={submit}
          disabled={!name}
          className="rounded-lg bg-primary-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
        >
          Add
        </button>
        <button
          onClick={onSeed}
          className="rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-sm font-medium text-gray-600 dark:text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700"
        >
          Seed Defaults
        </button>
      </div>
    </SettingsSection>
  )
}
