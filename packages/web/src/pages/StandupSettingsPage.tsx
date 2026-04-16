import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { standupApi, type StandupConfig, type StandupQuestion } from '@/api/standup'
import { slackApi, type SlackChannel } from '@/api/slack'
import { useAuthStore } from '@/stores/auth'
import { useToastStore } from '@/stores/toast'
import { getErrorMessage } from '@/lib/error'
import { Trash2, Plus, Play, ChevronDown, ChevronRight } from 'lucide-react'

const DAYS = [
  { value: '1-5', label: 'Mon-Fri' },
  { value: '0-6', label: 'Every day' },
  { value: '1,3,5', label: 'Mon/Wed/Fri' },
  { value: '2,4', label: 'Tue/Thu' },
]

const TIMEZONES = [
  'Asia/Seoul',
  'Asia/Ho_Chi_Minh',
  'Asia/Tokyo',
  'UTC',
  'America/New_York',
]

export default function StandupSettingsPage() {
  const currentUser = useAuthStore((s) => s.user)

  const { data: questions } = useQuery({
    queryKey: ['standup-questions'],
    queryFn: standupApi.listQuestions,
  })

  const { data: configs } = useQuery({
    queryKey: ['standup-configs'],
    queryFn: standupApi.listConfigs,
  })

  const { data: slackStatus } = useQuery({
    queryKey: ['slack-status'],
    queryFn: slackApi.getStatus,
  })

  const { data: channels } = useQuery({
    queryKey: ['slack-channels', slackStatus?.integrationId],
    queryFn: () => slackApi.getChannels(slackStatus!.integrationId!),
    enabled: !!slackStatus?.integrationId,
  })

  if (!currentUser?.isSuperuser) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <p className="text-sm text-gray-500">Only superusers can manage standup settings.</p>
      </div>
    )
  }

  if (!slackStatus?.connected) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <h1 className="mb-4 text-xl font-bold text-gray-900">Standup Bot</h1>
        <p className="text-sm text-gray-500">Connect Slack first in project Settings to use the Standup Bot.</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8 p-6">
      <h1 className="text-xl font-bold text-gray-900">Standup Bot</h1>

      <QuestionsSection questions={questions ?? []} />

      <ConfigsSection
        configs={configs ?? []}
        questions={questions ?? []}
        channels={channels ?? []}
        integrationId={slackStatus.integrationId!}
      />
    </div>
  )
}

// ─── Questions Section ──────────────────────────────────────

function QuestionsSection({ questions }: { questions: StandupQuestion[] }) {
  const queryClient = useQueryClient()
  const [newText, setNewText] = useState('')

  const createMutation = useMutation({
    mutationFn: () => standupApi.createQuestion({ text: newText, order: questions.length }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['standup-questions'] })
      setNewText('')
    },
    onError: (err) => useToastStore.getState().addToast(getErrorMessage(err, 'Failed')),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => standupApi.deleteQuestion(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['standup-questions'] }),
    onError: (err) => useToastStore.getState().addToast(getErrorMessage(err, 'Failed')),
  })

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5">
      <h2 className="mb-4 text-sm font-semibold text-gray-700">Questions</h2>
      <div className="space-y-2">
        {questions.map((q, i) => (
          <div key={q.id} className="flex items-center gap-3 rounded-lg bg-gray-50 px-3 py-2">
            <span className="text-xs font-mono text-gray-400 w-5">{i + 1}</span>
            <span className="flex-1 text-sm text-gray-900">{q.text}</span>
            <span className="text-xs text-gray-400">ignore: {q.ignoreText}</span>
            <button
              onClick={() => deleteMutation.mutate(q.id)}
              className="text-gray-400 hover:text-red-500"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-2">
        <input
          value={newText}
          onChange={(e) => setNewText(e.target.value)}
          placeholder="New question text..."
          className="flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
          onKeyDown={(e) => e.key === 'Enter' && newText && createMutation.mutate()}
        />
        <button
          onClick={() => newText && createMutation.mutate()}
          disabled={!newText}
          className="flex items-center gap-1 rounded-lg bg-primary-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />
          Add
        </button>
      </div>
    </section>
  )
}

// ─── Configs Section ────────────────────────────────────────

function ConfigsSection({
  configs,
  questions,
  channels,
  integrationId,
}: {
  configs: StandupConfig[]
  questions: StandupQuestion[]
  channels: SlackChannel[]
  integrationId: string
}) {
  const queryClient = useQueryClient()
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [showNew, setShowNew] = useState(false)

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-gray-700">Standup Configs</h2>
        <button
          onClick={() => setShowNew(!showNew)}
          className="flex items-center gap-1 rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-700"
        >
          <Plus className="h-3.5 w-3.5" />
          New Config
        </button>
      </div>

      {showNew && (
        <ConfigForm
          questions={questions}
          channels={channels}
          integrationId={integrationId}
          onDone={() => {
            setShowNew(false)
            queryClient.invalidateQueries({ queryKey: ['standup-configs'] })
          }}
        />
      )}

      <div className="space-y-2">
        {configs.map((config) => (
          <ConfigRow
            key={config.id}
            config={config}
            questions={questions}
            channels={channels}
            expanded={expandedId === config.id}
            onToggle={() => setExpandedId(expandedId === config.id ? null : config.id)}
          />
        ))}
        {configs.length === 0 && !showNew && (
          <p className="text-sm text-gray-400">No standup configs yet.</p>
        )}
      </div>
    </section>
  )
}

// ─── Config Row ─────────────────────────────────────────────

function ConfigRow({
  config,
  questions,
  channels,
  expanded,
  onToggle,
}: {
  config: StandupConfig
  questions: StandupQuestion[]
  channels: SlackChannel[]
  expanded: boolean
  onToggle: () => void
}) {
  const queryClient = useQueryClient()

  const deleteMutation = useMutation({
    mutationFn: () => standupApi.deleteConfig(config.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['standup-configs'] }),
    onError: (err) => useToastStore.getState().addToast(getErrorMessage(err, 'Failed')),
  })

  const triggerMutation = useMutation({
    mutationFn: () => standupApi.triggerConfig(config.id),
    onSuccess: () => useToastStore.getState().addToast('Standup triggered!'),
    onError: (err) => useToastStore.getState().addToast(getErrorMessage(err, 'Failed')),
  })

  const toggleMutation = useMutation({
    mutationFn: () => standupApi.updateConfig(config.id, { enabled: !config.enabled }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['standup-configs'] }),
  })

  const channelName = config.channelName ?? channels.find((c) => c.id === config.channelId)?.name ?? config.channelId

  return (
    <div className="rounded-lg border border-gray-100 bg-gray-50/50">
      <div className="flex items-center gap-3 px-3 py-2.5 cursor-pointer" onClick={onToggle}>
        {expanded ? <ChevronDown className="h-4 w-4 text-gray-400" /> : <ChevronRight className="h-4 w-4 text-gray-400" />}
        <div className="flex-1">
          <div className="text-sm font-medium text-gray-900">{config.name}</div>
          <div className="text-xs text-gray-500">
            #{channelName} · {config.cronHour}:{config.cronMinute.padStart(2, '0')} · {config.members.length} members · {config._count.reports} reports
          </div>
        </div>
        <label className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
          <input
            type="checkbox"
            checked={config.enabled}
            onChange={() => toggleMutation.mutate()}
            className="h-3.5 w-3.5 rounded border-gray-300 text-primary-600"
          />
          <span className="text-xs text-gray-500">On</span>
        </label>
        <button
          onClick={(e) => { e.stopPropagation(); triggerMutation.mutate() }}
          disabled={triggerMutation.isPending}
          className="rounded border border-gray-300 p-1 text-gray-500 hover:bg-gray-100"
          title="Trigger now"
        >
          <Play className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation()
            if (confirm(`Delete "${config.name}"?`)) deleteMutation.mutate()
          }}
          className="text-gray-400 hover:text-red-500"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {expanded && (
        <div className="border-t border-gray-100 px-3 py-3">
          <ConfigEditForm config={config} questions={questions} channels={channels} />
        </div>
      )}
    </div>
  )
}

// ─── Config Form (Create) ───────────────────────────────────

function ConfigForm({
  questions,
  channels,
  integrationId,
  onDone,
}: {
  questions: StandupQuestion[]
  channels: SlackChannel[]
  integrationId: string
  onDone: () => void
}) {
  const [form, setForm] = useState({
    name: '',
    channelId: '',
    cronHour: '9',
    cronMinute: '0',
    cronDayOfWeek: '1-5',
    timezone: 'Asia/Seoul',
    selectedQuestionIds: [] as string[],
    members: '' as string, // comma-separated Slack user IDs
  })

  const createMutation = useMutation({
    mutationFn: () =>
      standupApi.createConfig({
        name: form.name,
        channelId: form.channelId,
        channelName: channels.find((c) => c.id === form.channelId)?.name,
        cronHour: form.cronHour,
        cronMinute: form.cronMinute,
        cronDayOfWeek: form.cronDayOfWeek,
        timezone: form.timezone,
        slackIntegrationId: integrationId,
        questions: form.selectedQuestionIds.map((qId, i) => ({
          questionId: qId,
          order: i,
        })),
        members: form.members
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
          .map((slackUserId) => ({ slackUserId })),
      }),
    onSuccess: () => {
      useToastStore.getState().addToast('Config created')
      onDone()
    },
    onError: (err) => useToastStore.getState().addToast(getErrorMessage(err, 'Failed')),
  })

  return (
    <div className="mb-4 rounded-lg border border-primary-200 bg-primary-50/30 p-4 space-y-3">
      <input
        value={form.name}
        onChange={(e) => setForm({ ...form, name: e.target.value })}
        placeholder="Config name (e.g. Daily Standup)"
        className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
      />
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Channel</label>
          <select
            value={form.channelId}
            onChange={(e) => setForm({ ...form, channelId: e.target.value })}
            className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
          >
            <option value="">Select...</option>
            {channels.map((ch) => (
              <option key={ch.id} value={ch.id}>#{ch.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Timezone</label>
          <select
            value={form.timezone}
            onChange={(e) => setForm({ ...form, timezone: e.target.value })}
            className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
          >
            {TIMEZONES.map((tz) => (
              <option key={tz} value={tz}>{tz}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Hour</label>
          <input
            value={form.cronHour}
            onChange={(e) => setForm({ ...form, cronHour: e.target.value })}
            placeholder="9"
            className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Minute</label>
          <input
            value={form.cronMinute}
            onChange={(e) => setForm({ ...form, cronMinute: e.target.value })}
            placeholder="0"
            className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Days</label>
          <select
            value={form.cronDayOfWeek}
            onChange={(e) => setForm({ ...form, cronDayOfWeek: e.target.value })}
            className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
          >
            {DAYS.map((d) => (
              <option key={d.value} value={d.value}>{d.label}</option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Questions</label>
        <div className="space-y-1">
          {questions.map((q) => (
            <label key={q.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.selectedQuestionIds.includes(q.id)}
                onChange={(e) => {
                  const ids = e.target.checked
                    ? [...form.selectedQuestionIds, q.id]
                    : form.selectedQuestionIds.filter((id) => id !== q.id)
                  setForm({ ...form, selectedQuestionIds: ids })
                }}
                className="h-3.5 w-3.5 rounded border-gray-300 text-primary-600"
              />
              {q.text}
            </label>
          ))}
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Members (Slack User IDs, comma-separated)</label>
        <input
          value={form.members}
          onChange={(e) => setForm({ ...form, members: e.target.value })}
          placeholder="U01ABCDEF, U02GHIJKL"
          className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
        />
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => createMutation.mutate()}
          disabled={!form.name || !form.channelId || createMutation.isPending}
          className="rounded-lg bg-primary-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-primary-700 disabled:opacity-50"
        >
          Create
        </button>
        <button
          onClick={onDone}
          className="rounded-lg border border-gray-300 px-4 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

// ─── Config Edit Form ───────────────────────────────────────

function ConfigEditForm({
  config,
  questions,
  channels,
}: {
  config: StandupConfig
  questions: StandupQuestion[]
  channels: SlackChannel[]
}) {
  const queryClient = useQueryClient()
  const [form, setForm] = useState({
    name: config.name,
    channelId: config.channelId,
    cronHour: config.cronHour,
    cronMinute: config.cronMinute,
    cronDayOfWeek: config.cronDayOfWeek,
    timezone: config.timezone,
    greeting: config.greeting,
    goodbye: config.goodbye,
    selectedQuestionIds: config.questions.map((q) => q.questionId),
    members: config.members.map((m) => m.slackUserId).join(', '),
  })

  const updateMutation = useMutation({
    mutationFn: () =>
      standupApi.updateConfig(config.id, {
        name: form.name,
        channelId: form.channelId,
        channelName: channels.find((c) => c.id === form.channelId)?.name,
        cronHour: form.cronHour,
        cronMinute: form.cronMinute,
        cronDayOfWeek: form.cronDayOfWeek,
        timezone: form.timezone,
        greeting: form.greeting,
        goodbye: form.goodbye,
        questions: form.selectedQuestionIds.map((qId, i) => ({
          questionId: qId,
          order: i,
        })),
        members: form.members
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
          .map((slackUserId) => ({ slackUserId })),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['standup-configs'] })
      useToastStore.getState().addToast('Config updated')
    },
    onError: (err) => useToastStore.getState().addToast(getErrorMessage(err, 'Failed')),
  })

  return (
    <div className="space-y-3">
      <input
        value={form.name}
        onChange={(e) => setForm({ ...form, name: e.target.value })}
        className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none"
      />
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Channel</label>
          <select
            value={form.channelId}
            onChange={(e) => setForm({ ...form, channelId: e.target.value })}
            className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
          >
            {channels.map((ch) => (
              <option key={ch.id} value={ch.id}>#{ch.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Timezone</label>
          <select
            value={form.timezone}
            onChange={(e) => setForm({ ...form, timezone: e.target.value })}
            className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
          >
            {TIMEZONES.map((tz) => (
              <option key={tz} value={tz}>{tz}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Hour</label>
          <input
            value={form.cronHour}
            onChange={(e) => setForm({ ...form, cronHour: e.target.value })}
            className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Minute</label>
          <input
            value={form.cronMinute}
            onChange={(e) => setForm({ ...form, cronMinute: e.target.value })}
            className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Days</label>
          <select
            value={form.cronDayOfWeek}
            onChange={(e) => setForm({ ...form, cronDayOfWeek: e.target.value })}
            className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
          >
            {DAYS.map((d) => (
              <option key={d.value} value={d.value}>{d.label}</option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Greeting</label>
        <input
          value={form.greeting}
          onChange={(e) => setForm({ ...form, greeting: e.target.value })}
          className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Goodbye</label>
        <input
          value={form.goodbye}
          onChange={(e) => setForm({ ...form, goodbye: e.target.value })}
          className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Questions</label>
        <div className="space-y-1">
          {questions.map((q) => (
            <label key={q.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.selectedQuestionIds.includes(q.id)}
                onChange={(e) => {
                  const ids = e.target.checked
                    ? [...form.selectedQuestionIds, q.id]
                    : form.selectedQuestionIds.filter((id) => id !== q.id)
                  setForm({ ...form, selectedQuestionIds: ids })
                }}
                className="h-3.5 w-3.5 rounded border-gray-300 text-primary-600"
              />
              {q.text}
            </label>
          ))}
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Members (Slack User IDs)</label>
        <input
          value={form.members}
          onChange={(e) => setForm({ ...form, members: e.target.value })}
          className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none"
        />
      </div>
      <button
        onClick={() => updateMutation.mutate()}
        disabled={updateMutation.isPending}
        className="rounded-lg bg-primary-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-primary-700 disabled:opacity-50"
      >
        {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
      </button>
    </div>
  )
}
