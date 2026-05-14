import type { StandupQuestion } from '@/features/standup/api'
import { Checkbox } from '@/shared/ui/checkbox'

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
            <Checkbox
              checked={selectedIds.includes(q.id)}
              onCheckedChange={(checked) => toggle(q.id, checked === true)}
            />
            {q.text}
          </label>
        ))}
      </div>
    </div>
  )
}
