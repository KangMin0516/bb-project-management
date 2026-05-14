import { useState } from 'react'
import type { Label } from '@/features/project/api'
import SettingsSection from './SettingsSection'

interface LabelsSectionProps {
  labels: Label[] | undefined
  onCreate: (data: { name: string; color: string }) => void
  onSeed: () => void
}

export default function LabelsSection({ labels, onCreate, onSeed }: LabelsSectionProps) {
  const [name, setName] = useState('')
  const [color, setColor] = useState('#6366f1')

  const submit = () => {
    if (!name) return
    onCreate({ name, color })
    setName('')
  }

  return (
    <SettingsSection title="Labels">
      <div className="mb-3 flex flex-wrap gap-1.5">
        {labels?.map((l) => (
          <span
            key={l.id}
            className="rounded-full px-2.5 py-1 text-xs font-medium"
            style={{ backgroundColor: l.color + '20', color: l.color }}
          >
            {l.name}
          </span>
        ))}
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
