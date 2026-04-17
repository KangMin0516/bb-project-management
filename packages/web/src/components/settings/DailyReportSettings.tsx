import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { reportApi, type UpdateReportConfigPayload } from '@/api/reports'
import { slackApi, type SlackChannel } from '@/api/slack'
import { useToastStore } from '@/stores/toast'
import { getErrorMessage } from '@/lib/error'
import { Clock, Send, Calendar } from 'lucide-react'

const TIMEZONES = [
  'Asia/Seoul',
  'Asia/Ho_Chi_Minh',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Asia/Singapore',
  'UTC',
  'America/New_York',
  'America/Los_Angeles',
  'Europe/London',
]

interface DailyReportSettingsProps {
  projectId: string
  integrationId: string | undefined
  slackConnected: boolean
}

export default function DailyReportSettings({ projectId, integrationId, slackConnected }: DailyReportSettingsProps) {
  const queryClient = useQueryClient()

  const { data: config } = useQuery({
    queryKey: ['report-config', projectId],
    queryFn: () => reportApi.getConfig(projectId),
    enabled: slackConnected,
  })

  const { data: channels } = useQuery({
    queryKey: ['slack-channels', integrationId],
    queryFn: () => slackApi.getChannels(integrationId!),
    enabled: !!integrationId,
  })

  const [form, setForm] = useState({
    enabled: false,
    timezone: 'Asia/Seoul',
    skipWeekends: true,
    morningTime: '09:00',
    morningChannelId: '' as string,
    lunchTime: '13:00',
    lunchChannelId: '' as string,
    eveningTime: '18:00',
    eveningChannelId: '' as string,
  })

  useEffect(() => {
    if (config) {
      setForm({
        enabled: config.enabled,
        timezone: config.timezone,
        skipWeekends: config.skipWeekends,
        morningTime: config.morningTime,
        morningChannelId: config.morningChannelId ?? '',
        lunchTime: config.lunchTime,
        lunchChannelId: config.lunchChannelId ?? '',
        eveningTime: config.eveningTime,
        eveningChannelId: config.eveningChannelId ?? '',
      })
    }
  }, [config])

  const saveMutation = useMutation({
    mutationFn: (data: UpdateReportConfigPayload) => reportApi.updateConfig(projectId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['report-config', projectId] })
      useToastStore.getState().addToast('Report settings saved')
    },
    onError: (err) => {
      useToastStore.getState().addToast(getErrorMessage(err, 'Failed to save'))
    },
  })

  const testMutation = useMutation({
    mutationFn: (type: 'morning' | 'lunch' | 'evening') => reportApi.testSend(projectId, type),
    onSuccess: () => {
      useToastStore.getState().addToast('Test report sent!')
    },
    onError: (err) => {
      useToastStore.getState().addToast(getErrorMessage(err, 'Failed to send test'))
    },
  })

  const handleSave = () => {
    const channelName = (id: string) => channels?.find((c: SlackChannel) => c.id === id)?.name ?? null
    saveMutation.mutate({
      enabled: form.enabled,
      timezone: form.timezone,
      skipWeekends: form.skipWeekends,
      morningTime: form.morningTime,
      morningChannelId: form.morningChannelId || null,
      morningChannelName: channelName(form.morningChannelId),
      lunchTime: form.lunchTime,
      lunchChannelId: form.lunchChannelId || null,
      lunchChannelName: channelName(form.lunchChannelId),
      eveningTime: form.eveningTime,
      eveningChannelId: form.eveningChannelId || null,
      eveningChannelName: channelName(form.eveningChannelId),
      slackIntegrationId: integrationId!,
    })
  }

  if (!slackConnected) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <div className="flex items-center gap-3">
          <Clock className="h-5 w-5 text-gray-400" />
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Daily Reports</h3>
            <p className="text-xs text-gray-500">Connect Slack first to configure daily reports</p>
          </div>
        </div>
      </div>
    )
  }

  const reports = [
    { key: 'morning' as const, label: 'Morning', desc: "Today's tasks by assignee", timeKey: 'morningTime' as const, channelKey: 'morningChannelId' as const },
    { key: 'lunch' as const, label: 'Lunch', desc: "Today's changes summary", timeKey: 'lunchTime' as const, channelKey: 'lunchChannelId' as const },
    { key: 'evening' as const, label: 'Evening', desc: 'End of day summary + overdue', timeKey: 'eveningTime' as const, channelKey: 'eveningChannelId' as const },
  ]

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Clock className="h-5 w-5 text-primary-600" />
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Daily Reports</h3>
            <p className="text-xs text-gray-500">Automated Slack reports 3x daily</p>
          </div>
        </div>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={form.enabled}
            onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
            className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
          />
          <span className="text-xs font-medium text-gray-700">Enabled</span>
        </label>
      </div>

      <div className="mt-4 space-y-4">
        {/* Timezone + Skip Weekends */}
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-600 mb-1">Timezone</label>
            <select
              value={form.timezone}
              onChange={(e) => setForm({ ...form, timezone: e.target.value })}
              className="w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
            >
              {TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>{tz}</option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-2 pt-5">
            <Calendar className="h-3.5 w-3.5 text-gray-400" />
            <input
              type="checkbox"
              checked={form.skipWeekends}
              onChange={(e) => setForm({ ...form, skipWeekends: e.target.checked })}
              className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
            <span className="text-xs text-gray-600">Skip weekends</span>
          </label>
        </div>

        {/* Report Rows */}
        <div className="space-y-2">
          {reports.map((r) => (
            <div key={r.key} className="flex items-center gap-3 rounded-lg border border-gray-100 bg-gray-50/50 px-3 py-2.5">
              <div className="w-20">
                <div className="text-xs font-semibold text-gray-900">{r.label}</div>
                <div className="text-[10px] text-gray-500">{r.desc}</div>
              </div>
              <input
                type="time"
                value={form[r.timeKey]}
                onChange={(e) => setForm({ ...form, [r.timeKey]: e.target.value })}
                className="rounded border border-gray-300 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
              <select
                value={form[r.channelKey]}
                onChange={(e) => setForm({ ...form, [r.channelKey]: e.target.value })}
                className="flex-1 rounded border border-gray-300 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary-500"
              >
                <option value="">Select channel...</option>
                {channels?.map((ch: SlackChannel) => (
                  <option key={ch.id} value={ch.id}>#{ch.name}</option>
                ))}
              </select>
              <button
                onClick={() => testMutation.mutate(r.key)}
                disabled={!form[r.channelKey] || testMutation.isPending}
                className="flex items-center gap-1 rounded border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 disabled:opacity-40"
                title="Send test report"
              >
                <Send className="h-3 w-3" />
                Test
              </button>
            </div>
          ))}
        </div>

        <div className="flex justify-end">
          <button
            onClick={handleSave}
            disabled={saveMutation.isPending}
            className="rounded-lg bg-primary-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-primary-700 disabled:opacity-50"
          >
            {saveMutation.isPending ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  )
}
