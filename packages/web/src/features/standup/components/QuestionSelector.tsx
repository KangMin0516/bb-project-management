import type { StandupQuestion } from '@/features/standup/api'

interface QuestionSelectorProps {
  questions: StandupQuestion[]
  selectedIds: string[]
  onChange: (ids: string[]) => void
}

export default function QuestionSelector({ questions, selectedIds, onChange }: QuestionSelectorProps) {
  const toggle = (id: string, checked: boolean) => {
    onChange(checked ? [...selectedIds, id] : selectedIds.filter((x) => x !== id))
  }

  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 dark:text-gray-500 mb-1">Questions</label>
      <div className="space-y-1">
        {questions.map((q) => (
          <label key={q.id} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={selectedIds.includes(q.id)}
              onChange={(e) => toggle(q.id, e.target.checked)}
              className="h-3.5 w-3.5 rounded border-gray-300 dark:border-gray-600 text-primary-600"
            />
            {q.text}
          </label>
        ))}
      </div>
    </div>
  )
}
