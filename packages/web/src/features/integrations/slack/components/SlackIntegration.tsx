import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { slackApi } from '@/features/integrations/slack/api'
import { useToastStore } from '@/stores/toast'
import { getErrorMessage } from '@/lib/error'
import { MessageSquare, ExternalLink, Unplug } from 'lucide-react'

export default function SlackIntegration() {
  const queryClient = useQueryClient()
  const { data: status, isLoading } = useQuery({
    queryKey: ['slack-status'],
    queryFn: slackApi.getStatus,
  })

  const disconnectMutation = useMutation({
    mutationFn: () => slackApi.disconnect(status!.integrationId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['slack-status'] })
      useToastStore.getState().addToast('Slack disconnected')
    },
    onError: (err) => {
      useToastStore.getState().addToast(getErrorMessage(err, 'Failed to disconnect'))
    },
  })

  const handleConnect = async () => {
    try {
      const { url } = await slackApi.getInstallUrl()
      window.location.href = url
    } catch (err) {
      useToastStore.getState().addToast(getErrorMessage(err, 'Failed to start Slack connection'))
    }
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
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-50">
            <MessageSquare className="h-5 w-5 text-purple-600" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Slack Integration</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {status?.connected
                ? `Connected to ${status.teamName}`
                : 'Connect to send daily reports to Slack channels'}
            </p>
          </div>
        </div>

        {status?.connected ? (
          <button
            onClick={() => disconnectMutation.mutate()}
            disabled={disconnectMutation.isPending}
            className="flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
          >
            <Unplug className="h-3.5 w-3.5" />
            {disconnectMutation.isPending ? 'Disconnecting...' : 'Disconnect'}
          </button>
        ) : (
          <button
            onClick={handleConnect}
            className="flex items-center gap-1.5 rounded-lg bg-purple-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-purple-700"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Connect Slack
          </button>
        )}
      </div>
    </div>
  )
}
