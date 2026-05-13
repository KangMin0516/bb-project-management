import { useState, useEffect, useRef } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { quickIssueApi, type ParsedIssue } from '@/api/quick-issue'
import { useToastStore } from '@/stores/toast'
import { getErrorMessage } from '@/lib/error'
import { X, Zap, Loader2, ChevronRight, Check, ArrowLeft } from 'lucide-react'

interface QuickIssueModalProps {
  onClose: () => void
}

type Step = 'input' | 'project-select' | 'preview'

const TYPE_LABELS: Record<string, string> = {
  TASK: 'Task',
  BUG: 'Bug',
  EPIC: 'Epic',
  SUB_TASK: 'Sub-task',
}

const PRIORITY_COLORS: Record<string, string> = {
  HIGH: 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30',
  MEDIUM: 'text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/30',
  LOW: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30',
}

export default function QuickIssueModal({ onClose }: QuickIssueModalProps) {
  const [step, setStep] = useState<Step>('input')
  const [text, setText] = useState('')
  const [parsed, setParsed] = useState<ParsedIssue | null>(null)
  const [candidates, setCandidates] = useState<{ id: string; key: string; name: string }[]>([])
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const queryClient = useQueryClient()

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  useEffect(() => {
    if (step === 'input') inputRef.current?.focus()
  }, [step])

  const parseMutation = useMutation({
    mutationFn: (params: { text: string; projectId?: string }) =>
      quickIssueApi.parse(params.text, params.projectId),
    onSuccess: (result) => {
      if (result.needsProjectSelection && result.projectCandidates) {
        setCandidates(result.projectCandidates)
        setStep('project-select')
      } else if (result.parsed) {
        setParsed(result.parsed)
        setStep('preview')
      }
    },
    onError: (err: unknown) => {
      useToastStore.getState().addToast(getErrorMessage(err, 'Failed to parse'))
    },
  })

  const createMutation = useMutation({
    mutationFn: () => {
      if (!parsed) throw new Error('No parsed data')
      return quickIssueApi.create({
        projectId: parsed.projectId,
        title: parsed.title,
        description: parsed.description || undefined,
        type: parsed.type,
        priority: parsed.priority,
        status: parsed.status,
        assigneeId: parsed.assigneeId,
      })
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['issues'] })
      queryClient.invalidateQueries({ queryKey: ['board'] })
      useToastStore.getState().addToast(`Issue ${result.issueKey} created`)
      onClose()
    },
    onError: (err: unknown) => {
      useToastStore.getState().addToast(getErrorMessage(err, 'Failed to create issue'))
    },
  })

  const handleSubmitText = (e: React.FormEvent) => {
    e.preventDefault()
    if (!text.trim()) return
    parseMutation.mutate({ text: text.trim() })
  }

  const handleSelectProject = (projectId: string) => {
    parseMutation.mutate({ text: text.trim(), projectId })
  }

  const isParsing = parseMutation.isPending
  const isCreating = createMutation.isPending

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] bg-black/40" role="dialog" aria-modal="true" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-xl bg-white dark:bg-gray-800 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-2 border-b border-gray-200 dark:border-gray-700 px-4 py-3">
          {step !== 'input' && (
            <button
              onClick={() => { setStep('input'); setParsed(null) }}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
          )}
          <Zap className="h-4 w-4 text-amber-500" />
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Quick Issue</h2>
          <kbd className="ml-auto rounded bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 text-[10px] font-medium text-gray-500 dark:text-gray-400">
            {navigator.platform.includes('Mac') ? '⌘' : 'Ctrl'}+N
          </kbd>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Input Step */}
        {step === 'input' && (
          <form onSubmit={handleSubmitText}>
            <div className="p-4">
              <textarea
                ref={inputRef}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Describe the issue in natural language...&#10;e.g. &quot;BBPM login page bug - high priority&quot;"
                rows={3}
                maxLength={1000}
                className="w-full resize-none rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none placeholder:text-gray-400 dark:placeholder:text-gray-500"
              />
              <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                Project key, type, priority, @assignee will be auto-detected
              </p>
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-gray-200 dark:border-gray-700 px-4 py-3">
              <button
                type="submit"
                disabled={!text.trim() || isParsing}
                className="flex items-center gap-1.5 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
              >
                {isParsing ? (
                  <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Parsing...</>
                ) : (
                  <><ChevronRight className="h-3.5 w-3.5" /> Parse & Preview</>
                )}
              </button>
            </div>
          </form>
        )}

        {/* Project Selection Step */}
        {step === 'project-select' && (
          <div className="p-4">
            <p className="mb-3 text-sm text-gray-600 dark:text-gray-400">
              Multiple projects found. Select one:
            </p>
            <div className="space-y-1.5">
              {candidates.map((p) => (
                <button
                  key={p.id}
                  onClick={() => handleSelectProject(p.id)}
                  disabled={isParsing}
                  className="flex w-full items-center gap-3 rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2.5 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
                >
                  <span className="rounded bg-gray-100 dark:bg-gray-600 px-1.5 py-0.5 font-mono text-xs text-gray-500 dark:text-gray-400">
                    {p.key}
                  </span>
                  <span className="text-gray-900 dark:text-gray-100">{p.name}</span>
                  {isParsing && <Loader2 className="ml-auto h-3.5 w-3.5 animate-spin text-gray-400" />}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Preview Step */}
        {step === 'preview' && parsed && (
          <div>
            <div className="space-y-3 p-4">
              {/* Project */}
              <div className="flex items-center gap-2">
                <span className="rounded bg-gray-100 dark:bg-gray-600 px-1.5 py-0.5 font-mono text-xs text-gray-500 dark:text-gray-400">
                  {parsed.projectKey}
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400">{parsed.projectName}</span>
              </div>

              {/* Title */}
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Title</label>
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{parsed.title}</p>
              </div>

              {/* Description */}
              {parsed.description && (
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Description</label>
                  <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{parsed.description}</p>
                </div>
              )}

              {/* Fields */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Type</label>
                  <span className="text-sm text-gray-900 dark:text-gray-100">
                    {TYPE_LABELS[parsed.type] || parsed.type}
                  </span>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Priority</label>
                  <span className={`inline-block rounded px-1.5 py-0.5 text-xs font-medium ${PRIORITY_COLORS[parsed.priority] || ''}`}>
                    {parsed.priority}
                  </span>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Status</label>
                  <span className="text-sm text-gray-900 dark:text-gray-100">{parsed.status}</span>
                </div>
              </div>

              {/* Assignee */}
              {parsed.assigneeName && (
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Assignee</label>
                  <span className="text-sm text-gray-900 dark:text-gray-100">{parsed.assigneeName}</span>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 border-t border-gray-200 dark:border-gray-700 px-4 py-3">
              <button
                onClick={() => { setStep('input'); setParsed(null) }}
                className="rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Edit
              </button>
              <button
                onClick={() => createMutation.mutate()}
                disabled={isCreating}
                className="flex items-center gap-1.5 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
              >
                {isCreating ? (
                  <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Creating...</>
                ) : (
                  <><Check className="h-3.5 w-3.5" /> Create Issue</>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
