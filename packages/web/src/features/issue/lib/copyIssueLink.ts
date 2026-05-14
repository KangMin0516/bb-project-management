import { useToastStore } from '@/shared/lib/toast'
import type { ShareContext } from '@/shared/types'

/**
 * Copies a shareable deep-link to an issue and surfaces success/failure
 * via toast. Lives in `lib/` (not in the menu component) so it can be
 * imported from non-component code without warnings about React Refresh
 * mixed exports.
 *
 * The `?from=<context>` query is preserved on share so the receiving
 * tab opens the issue in the originating view (board vs list).
 */
export function copyIssueLink(projectKey: string, issueNumber: number, context?: ShareContext) {
  const base = `${window.location.origin}/share/${projectKey}-${issueNumber}`
  const url = context ? `${base}?from=${context}` : base
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(url).then(
      () => useToastStore.getState().addToast('Link copied!', 'success'),
      () => fallbackCopy(url),
    )
  } else {
    fallbackCopy(url)
  }
}

function fallbackCopy(text: string) {
  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.style.position = 'fixed'
  textarea.style.opacity = '0'
  document.body.appendChild(textarea)
  textarea.select()
  try {
    document.execCommand('copy')
    useToastStore.getState().addToast('Link copied!', 'success')
  } catch {
    useToastStore.getState().addToast('Failed to copy link', 'error')
  }
  document.body.removeChild(textarea)
}
