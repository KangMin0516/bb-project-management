import { useQuery } from '@tanstack/react-query'
import { slackApi } from '@/features/integrations/slack/api'

/**
 * Slack data triple every standup view needs: connection status, channels,
 * and users. Channels and users only fetch once we have an integrationId
 * (no point making them yell 404 before the user connects Slack).
 */
export function useSlackData() {
  const statusQuery = useQuery({
    queryKey: ['slack-status'],
    queryFn: slackApi.getStatus,
  })

  const integrationId = statusQuery.data?.integrationId

  const channelsQuery = useQuery({
    queryKey: ['slack-channels', integrationId],
    queryFn: () => slackApi.getChannels(integrationId!),
    enabled: !!integrationId,
  })

  const usersQuery = useQuery({
    queryKey: ['slack-users', integrationId],
    queryFn: () => slackApi.getUsers(integrationId!),
    enabled: !!integrationId,
  })

  return {
    status: statusQuery.data,
    channels: channelsQuery.data ?? [],
    users: usersQuery.data ?? [],
    isConnected: !!statusQuery.data?.connected,
    integrationId,
  }
}
