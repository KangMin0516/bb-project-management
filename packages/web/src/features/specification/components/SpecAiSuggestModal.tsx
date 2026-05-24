import { useEffect, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Sparkles, X, Loader2 } from 'lucide-react'
import { specRepository } from '@/features/specification/repository'
import { useToastStore } from '@/shared/lib/toast'
import { getErrorMessage } from '@/shared/lib/error'
import { cn } from '@/shared/lib/utils'

interface SpecAiSuggestModalProps {
  projectId: string
  specId: string
  specContent: string
  onClose: () => void
  /** Called with the spec content rewritten to include the user-approved
   *  items appended as `- [ ]` lines (under their section if specified). */
  onApply: (newContent: string) => void
}

interface SuggestedItem {
  text: string
  sectionTitle?: string
}

/**
 * Two-stage UX: (1) one-shot LLM extract → list with per-item checkbox
 * → (2) PM ticks the keepers → "Insert into content" appends them to
 * the markdown. The modal never mutates the spec directly; it produces
 * a rewritten string and hands it back to the page via `onApply`.
 */
export default function SpecAiSuggestModal({
  projectId,
  specId,
  specContent,
  onClose,
  onApply,
}: SpecAiSuggestModalProps) {
  const [suggestions, setSuggestions] = useState<SuggestedItem[] | null>(null)
  const [selected, setSelected] = useState<Set<number>>(new Set())

  const suggestMutation = useMutation({
    mutationFn: () => specRepository.suggestItems(projectId, specId),
    onSuccess: (data) => {
      setSuggestions(data)
      // Default-select every suggestion so PM unticks rejects rather than ticks keepers.
      setSelected(new Set(data.map((_, i) => i)))
    },
    onError: (err: unknown) => {
      useToastStore.getState().addToast(getErrorMessage(err, 'AI suggestion failed'), 'error')
    },
  })

  useEffect(() => {
    // Fire as soon as the modal mounts — no extra button click needed.
    suggestMutation.mutate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  function toggle(idx: number) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(idx)) next.delete(idx)
      else next.add(idx)
      return next
    })
  }

  function handleApply() {
    if (!suggestions) return
    const picked = suggestions.filter((_, i) => selected.has(i))
    if (picked.length === 0) {
      onClose()
      return
    }
    const newContent = appendItemsToContent(specContent, picked)
    onApply(newContent)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-20">
      <div className="flex w-[640px] max-w-[90vw] flex-col rounded-lg bg-white dark:bg-gray-800 shadow-xl">
        <header className="flex items-start justify-between gap-2 border-b border-gray-200 dark:border-gray-700 p-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-amber-500" />
            <div>
              <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                Suggest items from content
              </p>
              <p className="text-[11px] text-gray-500 dark:text-gray-400">
                AI extracts trackable requirements. Tick the ones to add as
                checkbox lines.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="max-h-[60vh] flex-1 overflow-y-auto p-3">
          {suggestMutation.isPending ? (
            <div className="flex items-center justify-center py-12 text-sm text-gray-500 dark:text-gray-400">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Extracting items…
            </div>
          ) : !suggestions ? (
            <p className="py-10 text-center text-sm text-gray-400">
              No suggestions yet.
            </p>
          ) : suggestions.length === 0 ? (
            <p className="py-10 text-center text-sm text-gray-400">
              AI didn&apos;t find any trackable items — the spec may be too
              short or too abstract.
            </p>
          ) : (
            <ul className="space-y-1">
              {suggestions.map((s, idx) => {
                const isChecked = selected.has(idx)
                return (
                  <li key={idx}>
                    <label
                      className={cn(
                        'flex cursor-pointer items-start gap-2 rounded-md border p-2 text-sm transition',
                        isChecked
                          ? 'border-amber-200 bg-amber-50/50 dark:border-amber-700 dark:bg-amber-900/20'
                          : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700',
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggle(idx)}
                        className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-amber-500"
                      />
                      <div className="min-w-0 flex-1">
                        {s.sectionTitle && (
                          <p className="text-[10px] uppercase tracking-wide text-gray-400 dark:text-gray-500">
                            {s.sectionTitle}
                          </p>
                        )}
                        <p className="text-gray-800 dark:text-gray-100">{s.text}</p>
                      </div>
                    </label>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <footer className="flex items-center justify-between gap-2 border-t border-gray-200 dark:border-gray-700 p-3">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {suggestions ? `${selected.size} / ${suggestions.length} selected` : ''}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApply}
              disabled={!suggestions || selected.size === 0}
              className="rounded-md bg-amber-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-600 disabled:opacity-50"
            >
              Insert into content
            </button>
          </div>
        </footer>
      </div>
    </div>
  )
}

/**
 * Append picked items to the spec markdown. Items with a `sectionTitle`
 * are placed right after the matching `## ...` heading (or its last line
 * before the next heading); items without one go to the end of the doc.
 * Each item becomes a `- [ ]` line; the parser will rewrite it with a
 * marker on the next save.
 */
function appendItemsToContent(content: string, items: SuggestedItem[]): string {
  const lines = content.split('\n')
  const itemsBySection = new Map<string, string[]>()
  const noSection: string[] = []
  for (const it of items) {
    if (it.sectionTitle) {
      const list = itemsBySection.get(it.sectionTitle) ?? []
      list.push(it.text)
      itemsBySection.set(it.sectionTitle, list)
    } else {
      noSection.push(it.text)
    }
  }

  // Locate the end-line index of each section by matching the heading
  // verbatim and walking until the next heading or EOF.
  for (const [sectionTitle, texts] of itemsBySection) {
    let headingIdx = -1
    for (let i = 0; i < lines.length; i++) {
      const m = lines[i].match(/^(#{1,6})\s+(.+)/)
      if (m && m[2].trim() === sectionTitle.trim()) {
        headingIdx = i
        break
      }
    }
    if (headingIdx === -1) {
      // Section heading not found in current content — fall through to no-section bucket.
      noSection.push(...texts)
      continue
    }
    let endIdx = lines.length
    for (let i = headingIdx + 1; i < lines.length; i++) {
      if (/^#{1,6}\s+/.test(lines[i])) {
        endIdx = i
        break
      }
    }
    const inserted = texts.map((t) => `- [ ] ${t}`)
    lines.splice(endIdx, 0, '', ...inserted)
  }

  if (noSection.length > 0) {
    if (lines[lines.length - 1] !== '') lines.push('')
    lines.push(...noSection.map((t) => `- [ ] ${t}`))
  }

  return lines.join('\n')
}
