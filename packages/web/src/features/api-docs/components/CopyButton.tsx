import { useState } from 'react'
import { Copy, Check } from 'lucide-react'

/**
 * Local copy button that shows a transient check icon. Kept simple — uses
 * navigator.clipboard directly with no fallback because this is dev-tool
 * UI and a missing clipboard API just means no copy.
 */
export default function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  return (
    <button onClick={handleCopy} className="rounded p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" title="Copy">
      {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
    </button>
  )
}
