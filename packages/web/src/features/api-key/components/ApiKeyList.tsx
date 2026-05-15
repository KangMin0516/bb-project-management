import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { KeyRound, Plus, Trash2 } from 'lucide-react'
import { apiKeyApi } from '@/features/api-key/api'
import { confirmDialog } from '@/shared/ui/confirm-dialog'
import { useToastStore } from '@/shared/lib/toast'
import { getErrorMessage } from '@/shared/lib/error'
import CreateApiKeyDialog from './CreateApiKeyDialog'

/**
 * Profile section: lists this user's API keys, lets them generate new
 * ones, and revoke existing ones. The raw secret is shown once at
 * creation (see CreateApiKeyDialog) and never again — `findAll` doesn't
 * return it.
 */
export default function ApiKeyList() {
  const [showCreate, setShowCreate] = useState(false)
  const queryClient = useQueryClient()

  const { data: keys, isLoading } = useQuery({
    queryKey: ['api-keys'],
    queryFn: apiKeyApi.list,
  })

  const removeMutation = useMutation({
    mutationFn: apiKeyApi.remove,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api-keys'] })
    },
    onError: (err: unknown) => {
      useToastStore.getState().addToast(getErrorMessage(err, 'Failed to revoke API key'), 'error')
    },
  })

  const handleRevoke = async (id: string, name: string) => {
    if (
      await confirmDialog({
        title: `Revoke "${name}"?`,
        description:
          'Tools using this key will stop working immediately. This action cannot be undone.',
        confirmLabel: 'Revoke',
        destructive: true,
      })
    ) {
      removeMutation.mutate(id)
    }
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold text-gray-900 dark:text-gray-100">
            <KeyRound className="h-4 w-4" />
            API Keys
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            For external clients like the BBPM MCP server. Keys inherit your permissions.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-700"
        >
          <Plus className="h-3.5 w-3.5" />
          New Key
        </button>
      </div>

      {isLoading ? (
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 px-4 py-6 text-center text-xs text-gray-400 dark:text-gray-500">
          Loading…
        </div>
      ) : !keys || keys.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 dark:border-gray-600 px-4 py-6 text-center text-xs text-gray-500 dark:text-gray-400">
          No API keys yet. Click <span className="font-medium">New Key</span> to generate one.
        </div>
      ) : (
        <ul className="divide-y divide-gray-100 dark:divide-gray-700 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          {keys.map((k) => (
            <li key={k.id} className="flex items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">
                  {k.name}
                </div>
                <div className="mt-0.5 text-[11px] text-gray-500 dark:text-gray-400">
                  Created {formatDate(k.createdAt)}
                  {' · '}
                  {k.lastUsed ? `last used ${formatRelative(k.lastUsed)}` : 'never used'}
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleRevoke(k.id, k.name)}
                disabled={removeMutation.isPending}
                className="flex items-center gap-1 rounded-md bg-red-100 dark:bg-red-900/40 px-2.5 py-1 text-xs font-medium text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-900/60 disabled:opacity-50"
                title="Revoke this key"
              >
                <Trash2 className="h-3 w-3" />
                Revoke
              </button>
            </li>
          ))}
        </ul>
      )}

      <CreateApiKeyDialog open={showCreate} onOpenChange={setShowCreate} />
    </section>
  )
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString()
}

function formatRelative(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const minutes = Math.floor(diffMs / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  return new Date(iso).toLocaleDateString()
}
