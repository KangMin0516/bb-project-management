import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Copy, Check, AlertTriangle } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog'
import { useToastStore } from '@/shared/lib/toast'
import { getErrorMessage } from '@/shared/lib/error'
import { apiKeyApi, type ApiKeyWithSecret } from '@/features/api-key/api'

interface CreateApiKeyDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Two-stage flow: (1) ask for the key's name, (2) show the generated raw
 * secret once with a Copy button + warning that it can't be retrieved
 * later. Closing the dialog at stage 2 also invalidates the list query
 * so the new row appears in the table.
 */
export default function CreateApiKeyDialog({ open, onOpenChange }: CreateApiKeyDialogProps) {
  const [name, setName] = useState('')
  const [generated, setGenerated] = useState<ApiKeyWithSecret | null>(null)
  const [copied, setCopied] = useState(false)
  const queryClient = useQueryClient()

  const createMutation = useMutation({
    mutationFn: (n: string) => apiKeyApi.create(n),
    onSuccess: (result) => {
      setGenerated(result)
      queryClient.invalidateQueries({ queryKey: ['api-keys'] })
    },
    onError: (err: unknown) => {
      useToastStore.getState().addToast(getErrorMessage(err, 'Failed to create API key'), 'error')
    },
  })

  const close = () => {
    onOpenChange(false)
    // Defer state reset so the dialog's exit animation has time to play.
    setTimeout(() => {
      setName('')
      setGenerated(null)
      setCopied(false)
    }, 200)
  }

  const copyKey = async () => {
    if (!generated) return
    await navigator.clipboard.writeText(generated.key)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) close() }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{generated ? 'API key created' : 'Create API key'}</DialogTitle>
          <DialogDescription>
            {generated
              ? 'Copy the key now — it will NOT be shown again.'
              : 'Used by external tools like bbpm-internal-mcp. The key inherits your permissions.'}
          </DialogDescription>
        </DialogHeader>

        {!generated ? (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (name.trim()) createMutation.mutate(name.trim())
            }}
            className="space-y-3"
          >
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
                Name
              </span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. claude-desktop / bbpm-mcp / laptop"
                required
                autoFocus
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none"
              />
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={close}
                className="rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!name.trim() || createMutation.isPending}
                className="rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-700 disabled:opacity-50"
              >
                {createMutation.isPending ? 'Generating…' : 'Generate'}
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-3">
            <div className="flex items-start gap-2 rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/30 p-3 text-xs text-amber-700 dark:text-amber-300">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>
                This is the only time the full key will be shown. Store it in a password
                manager or paste it into your client config now.
              </span>
            </div>
            <div className="flex items-start gap-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 px-3 py-2 font-mono text-xs">
              <span
                className="flex-1 min-w-0 break-all select-all text-gray-900 dark:text-gray-100"
                onClick={(e) => {
                  // Triple-click selects whole key — flex layout sometimes
                  // breaks the default selection range, so help it along.
                  const range = document.createRange()
                  range.selectNodeContents(e.currentTarget)
                  const sel = window.getSelection()
                  sel?.removeAllRanges()
                  sel?.addRange(range)
                }}
              >
                {generated.key}
              </span>
              <button
                type="button"
                onClick={copyKey}
                className="shrink-0 flex items-center gap-1 rounded-md bg-primary-600 px-2 py-1 text-[10px] font-medium text-white hover:bg-primary-700"
              >
                {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={close}
                className="rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-700"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
