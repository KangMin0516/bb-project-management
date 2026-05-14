import { useState } from 'react'
import type { StandupQuestion } from '@/features/standup/api'
import type { SlackChannel, SlackUser } from '@/features/integrations/slack/api'
import { EMPTY_CONFIG_FORM, type StandupConfigFormData } from '@/features/standup/lib'
import ScheduleFields from './ScheduleFields'
import QuestionSelector from './QuestionSelector'
import MemberSelector from './MemberSelector'

interface ConfigFormProps {
  /** 'create' shows only schedule/questions; 'edit' adds greeting/goodbye. */
  mode: 'create' | 'edit'
  initial?: Partial<StandupConfigFormData>
  questions: StandupQuestion[]
  channels: SlackChannel[]
  slackUsers: SlackUser[]
  isPending: boolean
  onSubmit: (data: StandupConfigFormData) => void
  onCancel?: () => void
}

/**
 * Unified config form for both create and edit modes (eliminates the
 * ~150-line duplication the page had). `mode='edit'` reveals greeting +
 * goodbye fields and renames the submit button.
 */
export default function ConfigForm({ mode, initial, questions, channels, slackUsers, isPending, onSubmit, onCancel }: ConfigFormProps) {
  const [form, setForm] = useState<StandupConfigFormData>({ ...EMPTY_CONFIG_FORM, ...initial })

  const updateField = <K extends keyof StandupConfigFormData>(key: K, value: StandupConfigFormData[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const canSubmit = !!form.name && !!form.channelId && !isPending

  const wrapperClass =
    mode === 'create'
      ? 'mb-4 rounded-lg border border-primary-200 bg-primary-50/30 p-4 space-y-3'
      : 'space-y-3'

  return (
    <div className={wrapperClass}>
      <input
        value={form.name}
        onChange={(e) => updateField('name', e.target.value)}
        placeholder="Config name (e.g. Daily Standup)"
        className="w-full rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
      />
      <ScheduleFields
        channels={channels}
        channelId={form.channelId}
        cronHour={form.cronHour}
        cronMinute={form.cronMinute}
        cronDayOfWeek={form.cronDayOfWeek}
        timezone={form.timezone}
        onChange={(patch) => setForm((prev) => ({ ...prev, ...patch }))}
      />
      {mode === 'edit' && (
        <>
          <TextField label="Greeting" value={form.greeting} onChange={(v) => updateField('greeting', v)} />
          <TextField label="Goodbye" value={form.goodbye} onChange={(v) => updateField('goodbye', v)} />
        </>
      )}
      <QuestionSelector
        questions={questions}
        selectedIds={form.selectedQuestionIds}
        onChange={(ids) => updateField('selectedQuestionIds', ids)}
      />
      <MemberSelector
        slackUsers={slackUsers}
        selectedIds={form.selectedMemberIds}
        onChange={(ids) => updateField('selectedMemberIds', ids)}
      />
      <div className="flex gap-2">
        <button
          onClick={() => onSubmit(form)}
          disabled={!canSubmit}
          className="rounded-lg bg-primary-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-primary-700 disabled:opacity-50"
        >
          {mode === 'create' ? (isPending ? 'Creating...' : 'Create') : (isPending ? 'Saving...' : 'Save Changes')}
        </button>
        {onCancel && (
          <button
            onClick={onCancel}
            className="rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  )
}

function TextField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 dark:text-gray-500 mb-1">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded border border-gray-300 dark:border-gray-600 px-2 py-1.5 text-sm"
      />
    </div>
  )
}
