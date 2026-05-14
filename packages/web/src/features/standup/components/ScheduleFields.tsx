import type { SlackChannel } from '@/features/integrations/slack/api'
import { DAYS, TIMEZONES } from '@/features/standup/lib'

interface ScheduleFieldsProps {
  channels: SlackChannel[]
  channelId: string
  cronHour: string
  cronMinute: string
  cronDayOfWeek: string
  timezone: string
  onChange: (patch: Partial<{ channelId: string; cronHour: string; cronMinute: string; cronDayOfWeek: string; timezone: string }>) => void
}

/**
 * The 2x2 grid + 3-column timing row shared by both create and edit
 * config forms. No state of its own — fully driven by the parent's
 * onChange so reuse is trivial.
 */
export default function ScheduleFields({
  channels,
  channelId,
  cronHour,
  cronMinute,
  cronDayOfWeek,
  timezone,
  onChange,
}: ScheduleFieldsProps) {
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Channel">
          <select
            value={channelId}
            onChange={(e) => onChange({ channelId: e.target.value })}
            className="w-full rounded border border-gray-300 dark:border-gray-600 px-2 py-1.5 text-sm"
          >
            <option value="">Select...</option>
            {channels.map((ch) => <option key={ch.id} value={ch.id}>#{ch.name}</option>)}
          </select>
        </Field>
        <Field label="Timezone">
          <select
            value={timezone}
            onChange={(e) => onChange({ timezone: e.target.value })}
            className="w-full rounded border border-gray-300 dark:border-gray-600 px-2 py-1.5 text-sm"
          >
            {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
          </select>
        </Field>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Hour">
          <input
            value={cronHour}
            onChange={(e) => onChange({ cronHour: e.target.value })}
            placeholder="9"
            className="w-full rounded border border-gray-300 dark:border-gray-600 px-2 py-1.5 text-sm"
          />
        </Field>
        <Field label="Minute">
          <input
            value={cronMinute}
            onChange={(e) => onChange({ cronMinute: e.target.value })}
            placeholder="0"
            className="w-full rounded border border-gray-300 dark:border-gray-600 px-2 py-1.5 text-sm"
          />
        </Field>
        <Field label="Days">
          <select
            value={cronDayOfWeek}
            onChange={(e) => onChange({ cronDayOfWeek: e.target.value })}
            className="w-full rounded border border-gray-300 dark:border-gray-600 px-2 py-1.5 text-sm"
          >
            {DAYS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
          </select>
        </Field>
      </div>
    </>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 dark:text-gray-500 mb-1">{label}</label>
      {children}
    </div>
  )
}
