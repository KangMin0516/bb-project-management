import { useToastStore } from '@/shared/lib/toast'

/**
 * Copies `text` and surfaces success/failure via toast. Tries the modern
 * Clipboard API first, falls back to a hidden <textarea> + execCommand for
 * non-secure contexts (http://, older Safari). Returns nothing — surface
 * feedback is the whole point of using this over `navigator.clipboard`.
 */
export function copyToClipboard(text: string, successMessage = `Copied: ${text}`) {
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text).then(
      () => useToastStore.getState().addToast(successMessage, 'success'),
      () => fallback(),
    )
    return
  }
  fallback()

  function fallback() {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    try {
      document.execCommand('copy')
      useToastStore.getState().addToast(successMessage, 'success')
    } catch {
      useToastStore.getState().addToast('Failed to copy', 'error')
    }
    document.body.removeChild(ta)
  }
}
