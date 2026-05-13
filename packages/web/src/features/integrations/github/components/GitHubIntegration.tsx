import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { githubApi, type GitHubStatus } from '@/features/integrations/github/api'
import { STATUSES, STATUS_LABELS } from '@/shared/config/constants'
import { useToastStore } from '@/stores/toast'
import { getErrorMessage } from '@/shared/lib/error'
import { GitFork, Unplug, Copy, Eye, EyeOff, Info } from 'lucide-react'

export default function GitHubIntegration({ projectId }: { projectId: string }) {
  const queryClient = useQueryClient()
  const [pat, setPat] = useState('')
  const [showSecret, setShowSecret] = useState(false)

  const { data: status, isLoading } = useQuery({
    queryKey: ['github-status', projectId],
    queryFn: () => githubApi.getStatus(projectId),
  })

  const connectMutation = useMutation({
    mutationFn: () => githubApi.connect(projectId, { accessToken: pat }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['github-status', projectId] })
      useToastStore.getState().addToast('GitHub connected')
      setPat('')
    },
    onError: (err) => {
      useToastStore.getState().addToast(getErrorMessage(err, 'Failed to connect GitHub'))
    },
  })

  const disconnectMutation = useMutation({
    mutationFn: () => githubApi.disconnect(projectId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['github-status', projectId] })
      useToastStore.getState().addToast('GitHub disconnected')
    },
    onError: (err) => {
      useToastStore.getState().addToast(getErrorMessage(err, 'Failed to disconnect'))
    },
  })

  const updateConfigMutation = useMutation({
    mutationFn: (data: Partial<Pick<GitHubStatus, 'onPrOpenStatus' | 'onPrMergeStatus' | 'autoLinkEnabled'>>) =>
      githubApi.updateConfig(projectId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['github-status', projectId] })
    },
    onError: (err) => {
      useToastStore.getState().addToast(getErrorMessage(err, 'Failed to update config'))
    },
  })

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    useToastStore.getState().addToast('Copied to clipboard')
  }

  if (isLoading) {
    return (
      <div className="animate-pulse rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6">
        <div className="h-5 w-40 rounded bg-gray-200 dark:bg-gray-600" />
        <div className="mt-3 h-4 w-64 rounded bg-gray-100 dark:bg-gray-700" />
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-700">
            <GitFork className="h-5 w-5 text-gray-700 dark:text-gray-300" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">GitHub Integration</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {status?.connected
                ? `Connected as ${status.ownerLogin}`
                : 'Connect to link Pull Requests to issues'}
            </p>
          </div>
        </div>

        {status?.connected && (
          <button
            onClick={() => disconnectMutation.mutate()}
            disabled={disconnectMutation.isPending}
            className="flex items-center gap-1.5 rounded-lg border border-red-200 dark:border-red-800 px-3 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50"
          >
            <Unplug className="h-3.5 w-3.5" />
            {disconnectMutation.isPending ? 'Disconnecting...' : 'Disconnect'}
          </button>
        )}
      </div>

      {status?.connected ? (
        <div className="mt-5 space-y-4">
          {/* Webhook URL */}
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Webhook URL</label>
            <div className="flex items-center gap-2">
              <input
                readOnly
                value={status.webhookUrl || ''}
                className="flex-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 font-mono text-xs"
              />
              <button
                onClick={() => copyToClipboard(status.webhookUrl || '')}
                className="rounded-lg border border-gray-300 dark:border-gray-600 p-2 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700"
                title="Copy"
              >
                <Copy className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Webhook Secret */}
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Webhook Secret</label>
            <div className="flex items-center gap-2">
              <input
                readOnly
                type={showSecret ? 'text' : 'password'}
                value={status.webhookSecret || ''}
                className="flex-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 font-mono text-xs"
              />
              <button
                onClick={() => setShowSecret(!showSecret)}
                className="rounded-lg border border-gray-300 dark:border-gray-600 p-2 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700"
                title={showSecret ? 'Hide' : 'Reveal'}
              >
                {showSecret ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
              <button
                onClick={() => copyToClipboard(status.webhookSecret || '')}
                className="rounded-lg border border-gray-300 dark:border-gray-600 p-2 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700"
                title="Copy"
              >
                <Copy className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Setup Instructions */}
          <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 p-3">
            <div className="flex items-start gap-2">
              <Info className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
              <div className="text-xs text-blue-700 dark:text-blue-300 space-y-1">
                <p className="font-medium">GitHub Webhook Setup</p>
                <ol className="list-decimal list-inside space-y-0.5 text-blue-600 dark:text-blue-400">
                  <li>Go to your GitHub repo &rarr; Settings &rarr; Webhooks</li>
                  <li>Payload URL: paste the Webhook URL above</li>
                  <li>Content type: <code className="rounded bg-blue-100 dark:bg-blue-800 px-1">application/json</code></li>
                  <li>Secret: paste the Webhook Secret above</li>
                  <li>Events: select <strong>Pull requests</strong></li>
                </ol>
              </div>
            </div>
          </div>

          {/* Auto-link */}
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Auto-link</span>
              <p className="text-xs text-gray-500 dark:text-gray-400">PR title/branch에서 issue key 자동 감지</p>
            </div>
            <button
              onClick={() => updateConfigMutation.mutate({ autoLinkEnabled: !status.autoLinkEnabled })}
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors ${
                status.autoLinkEnabled ? 'bg-primary-600' : 'bg-gray-300 dark:bg-gray-600'
              }`}
            >
              <span
                className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${
                  status.autoLinkEnabled ? 'translate-x-4.5' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>

          {/* Status Mapping */}
          <div>
            <span className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Status Mapping</span>
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <span className="w-28 text-xs text-gray-500 dark:text-gray-400">PR Opened &rarr;</span>
                <select
                  value={status.onPrOpenStatus || ''}
                  onChange={(e) => updateConfigMutation.mutate({ onPrOpenStatus: e.target.value || undefined })}
                  className="flex-1 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
                >
                  <option value="">No change</option>
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-3">
                <span className="w-28 text-xs text-gray-500 dark:text-gray-400">PR Merged &rarr;</span>
                <select
                  value={status.onPrMergeStatus || ''}
                  onChange={(e) => updateConfigMutation.mutate({ onPrMergeStatus: e.target.value || undefined })}
                  className="flex-1 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
                >
                  <option value="">No change</option>
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-5 space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
              Personal Access Token
            </label>
            <input
              type="password"
              value={pat}
              onChange={(e) => setPat(e.target.value)}
              placeholder="ghp_xxxxxxxxxxxx"
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
            <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
              Required scope: <code className="rounded bg-gray-100 dark:bg-gray-700 px-1">repo</code>
            </p>
          </div>
          <button
            onClick={() => pat && connectMutation.mutate()}
            disabled={!pat || connectMutation.isPending}
            className="flex items-center gap-1.5 rounded-lg bg-gray-800 dark:bg-gray-100 px-4 py-2 text-sm font-medium text-white dark:text-gray-900 hover:bg-gray-900 dark:hover:bg-gray-200 disabled:opacity-50"
          >
            <GitFork className="h-4 w-4" />
            {connectMutation.isPending ? 'Connecting...' : 'Connect GitHub'}
          </button>
        </div>
      )}
    </div>
  )
}
