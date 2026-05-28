import Combobox from '@/shared/ui/combobox'
import UserAvatar from './UserAvatar'

interface MemberOption {
  user: { id: string; name: string; email?: string; avatar?: string | null }
}

interface UserPickerProps {
  members: MemberOption[]
  value: string
  onChange: (id: string) => void
  /** Label for the "no selection" option. Default 'Unassigned'. */
  emptyLabel?: string
}

/** Sentinel for the "no user" option — Combobox value cannot be empty. */
const NO_USER = '__none__'

/**
 * Dropdown for picking a user from a member list. Backed by the shared
 * `Combobox` (cmdk-powered) so callers get type-to-search, keyboard
 * navigation, and an empty-state for free — previously this was a plain
 * Radix Select which forced users to scroll a long list (PM-106).
 *
 * Opens immediately on mount because callers put the picker into edit
 * mode in response to a click, so showing the popover deferred would
 * feel like a stutter.
 */
export default function UserPicker({ members, value, onChange, emptyLabel = 'Unassigned' }: UserPickerProps) {
  const options = [
    {
      value: NO_USER,
      label: emptyLabel,
      searchValue: emptyLabel,
      render: (
        <span className="flex items-center gap-2">
          <UserAvatar user={null} />
          <span>{emptyLabel}</span>
        </span>
      ),
      triggerRender: (
        <span className="flex items-center gap-2">
          <UserAvatar user={null} />
          <span className="truncate">{emptyLabel}</span>
        </span>
      ),
    },
    ...members.map((m) => ({
      value: m.user.id,
      label: m.user.name,
      searchValue: m.user.email ? `${m.user.name} ${m.user.email}` : m.user.name,
      render: (
        <span className="flex items-center gap-2 min-w-0">
          <UserAvatar user={m.user} />
          <span className="flex min-w-0 flex-col">
            <span className="truncate">{m.user.name}</span>
            {m.user.email && (
              <span className="truncate text-[11px] text-gray-500 dark:text-gray-400">
                {m.user.email}
              </span>
            )}
          </span>
        </span>
      ),
      triggerRender: (
        <span className="flex items-center gap-2 min-w-0">
          <UserAvatar user={m.user} />
          <span className="truncate">{m.user.name}</span>
        </span>
      ),
    })),
  ]

  return (
    <Combobox
      defaultOpen
      value={value || NO_USER}
      onChange={(v) => onChange(v === NO_USER ? '' : v)}
      options={options}
      placeholder={emptyLabel}
      searchPlaceholder="Search member..."
      emptyMessage="No matches"
      className="h-8"
    />
  )
}
