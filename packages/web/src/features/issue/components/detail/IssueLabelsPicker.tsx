import { useRef, useState } from 'react'
import { Checkbox } from '@/shared/ui/checkbox'
import type { Label } from '@/features/project/api'
import { useOutsideClick } from '@/shared/lib/useOutsideClick'

interface IssueLabelsPickerProps {
  labels: { label: { id: string; name: string; color: string } }[]
  projectLabels: Label[] | undefined
  onChange: (labelIds: string[]) => void
}

/**
 * Row showing attached labels as removable pills plus an "+ Add" picker.
 * The picker stays mounted only while open and closes on outside click.
 */
export default function IssueLabelsPicker({ labels, projectLabels, onChange }: IssueLabelsPickerProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useOutsideClick(ref, open, () => setOpen(false))

  const currentIds = labels.map((l) => l.label.id)
  const toggle = (id: string) => {
    onChange(currentIds.includes(id) ? currentIds.filter((x) => x !== id) : [...currentIds, id])
  }

  return (
    <div className="flex items-start gap-2 py-1.5">
      <span className="w-20 shrink-0 pt-0.5 text-xs font-medium text-gray-400">Labels</span>
      <div className="flex flex-1 flex-wrap items-center gap-1.5" ref={ref}>
        {labels.map(({ label }) => (
          <LabelPill key={label.id} label={label} onRemove={() => toggle(label.id)} />
        ))}
        {!projectLabels || projectLabels.length === 0 ? (
          <span className="text-xs text-gray-400 italic">No labels in project yet</span>
        ) : (
          <div className="relative">
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="inline-flex items-center gap-1 rounded-full border border-dashed border-gray-300 dark:border-gray-600 px-2 py-0.5 text-[11px] font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-700 dark:hover:text-gray-200"
            >
              + {labels.length === 0 ? 'Add label' : 'Add'}
            </button>
            {open && (
              <div className="absolute left-0 top-full z-40 mt-1 max-h-64 w-56 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 py-1 shadow-lg dark:shadow-gray-900/50">
                {projectLabels.map((label) => (
                  <LabelOption
                    key={label.id}
                    label={label}
                    selected={currentIds.includes(label.id)}
                    onToggle={() => toggle(label.id)}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function LabelPill({ label, onRemove }: { label: { id: string; name: string; color: string }; onRemove: () => void }) {
  return (
    <span
      className="group inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium"
      style={{ backgroundColor: label.color + '22', color: label.color, borderColor: label.color + '55' }}
    >
      {label.name}
      <button type="button" onClick={onRemove} aria-label={`Remove ${label.name}`} className="opacity-60 hover:opacity-100">
        ×
      </button>
    </span>
  )
}

function LabelOption({ label, selected, onToggle }: { label: Label; selected: boolean; onToggle: () => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 px-3 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-700">
      <Checkbox checked={selected} onCheckedChange={onToggle} />
      <span className="h-3 w-3 rounded-full" style={{ backgroundColor: label.color }} />
      <span className="truncate text-xs text-gray-700 dark:text-gray-200">{label.name}</span>
    </label>
  )
}
