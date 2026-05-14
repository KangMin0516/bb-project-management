interface ComponentItem {
  id: string
  name: string
}

interface IssueComponentsPickerProps {
  components: { component: { id: string; name: string } }[]
  projectComponents: ComponentItem[]
  onChange: (componentIds: string[]) => void
}

/**
 * Toggleable pill row for project components. Visually de-emphasises
 * unselected items so the attached ones stand out at a glance.
 */
export default function IssueComponentsPicker({ components, projectComponents, onChange }: IssueComponentsPickerProps) {
  const selectedIds = new Set(components.map((ic) => ic.component.id))

  const toggle = (id: string) => {
    const current = [...selectedIds]
    const next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id]
    onChange(next)
  }

  return (
    <div className="flex items-start gap-2 py-1.5">
      <span className="w-20 shrink-0 pt-0.5 text-xs font-medium text-gray-400">Components</span>
      <div className="flex flex-1 flex-wrap gap-1">
        {projectComponents.map((comp) => {
          const isSelected = selectedIds.has(comp.id)
          return (
            <button
              key={comp.id}
              onClick={() => toggle(comp.id)}
              className={`rounded-full px-2 py-0.5 text-[10px] font-medium border transition-colors ${
                isSelected
                  ? 'bg-blue-100 text-blue-700 border-blue-400 ring-1 ring-blue-400 ring-offset-1'
                  : 'bg-gray-100 text-gray-500 border-transparent opacity-30 hover:opacity-70'
              }`}
            >
              {comp.name}
            </button>
          )
        })}
      </div>
    </div>
  )
}
