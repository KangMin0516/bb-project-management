import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import type { StandupQuestion } from '@/features/standup/api'

interface QuestionsSectionProps {
  questions: StandupQuestion[]
  onCreate: (text: string, order: number) => void
  onRemove: (id: string) => void
}

export default function QuestionsSection({ questions, onCreate, onRemove }: QuestionsSectionProps) {
  const [newText, setNewText] = useState('')

  const submit = () => {
    if (!newText) return
    onCreate(newText, questions.length)
    setNewText('')
  }

  return (
    <section className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
      <h2 className="mb-4 text-sm font-semibold text-gray-700 dark:text-gray-300">Questions</h2>
      <div className="space-y-2">
        {questions.map((q, i) => (
          <div key={q.id} className="flex items-center gap-3 rounded-lg bg-gray-50 dark:bg-gray-900 px-3 py-2">
            <span className="text-xs font-mono text-gray-400 dark:text-gray-500 w-5">{i + 1}</span>
            <span className="flex-1 text-sm text-gray-900 dark:text-gray-100">{q.text}</span>
            <span className="text-xs text-gray-400 dark:text-gray-500">ignore: {q.ignoreText}</span>
            <button onClick={() => onRemove(q.id)} className="text-gray-400 dark:text-gray-500 hover:text-red-500" aria-label={`Delete ${q.text}`}>
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-2">
        <input
          value={newText}
          onChange={(e) => setNewText(e.target.value)}
          placeholder="New question text..."
          className="flex-1 rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
          onKeyDown={(e) => e.key === 'Enter' && submit()}
        />
        <button
          onClick={submit}
          disabled={!newText}
          className="flex items-center gap-1 rounded-lg bg-primary-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />
          Add
        </button>
      </div>
    </section>
  )
}
