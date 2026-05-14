import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/ui/select'
import UserAvatar from './UserAvatar'

interface MemberOption {
  user: { id: string; name: string; avatar?: string | null }
}

interface UserPickerProps {
  members: MemberOption[]
  value: string
  onChange: (id: string) => void
  /** Label for the "no selection" option. Default 'Unassigned'. */
  emptyLabel?: string
}

/** Sentinel for the "no user" option — Radix Select rejects empty values. */
const NO_USER = '__none__'

/**
 * Dropdown for picking a user from a member list, with optional "no
 * selection" option as the first entry. Renders as a shadcn Select so
 * focus trap, keyboard nav, and theme tokens stay consistent with the
 * other pickers in the issue panel. `defaultOpen` mirrors the previous
 * always-visible-on-mount behaviour (parent puts UserPicker into edit
 * mode the moment the user clicks the field).
 */
export default function UserPicker({ members, value, onChange, emptyLabel = 'Unassigned' }: UserPickerProps) {
  const selected = members.find((m) => m.user.id === value)?.user

  return (
    <Select
      defaultOpen
      value={value || NO_USER}
      onValueChange={(v) => onChange(v === NO_USER ? '' : v)}
    >
      <SelectTrigger className="h-8 text-sm">
        <SelectValue>
          <span className="flex items-center gap-2">
            <UserAvatar user={selected ?? null} />
            <span className="truncate">{selected ? selected.name : emptyLabel}</span>
          </span>
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NO_USER}>
          <span className="flex items-center gap-2">
            <UserAvatar user={null} />
            {emptyLabel}
          </span>
        </SelectItem>
        {members.map((m) => (
          <SelectItem key={m.user.id} value={m.user.id}>
            <span className="flex items-center gap-2">
              <UserAvatar user={m.user} />
              {m.user.name}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
