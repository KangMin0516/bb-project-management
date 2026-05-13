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

/**
 * Dropdown for picking a user from a member list, with optional "no
 * selection" (id='') first option. Renders absolutely-positioned beneath
 * its parent — the parent provides the click-outside behaviour.
 */
export default function UserPicker({ members, value, onChange, emptyLabel = 'Unassigned' }: UserPickerProps) {
  return (
    <div className="relative">
      <div className="absolute z-20 mt-1 w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 py-1 shadow-lg max-h-52 overflow-y-auto">
        <UserOption selected={!value} onClick={() => onChange('')}>
          <UserAvatar user={null} />
          {emptyLabel}
        </UserOption>
        {members.map((m) => (
          <UserOption key={m.user.id} selected={value === m.user.id} onClick={() => onChange(m.user.id)}>
            <UserAvatar user={m.user} />
            {m.user.name}
          </UserOption>
        ))}
      </div>
    </div>
  )
}

function UserOption({
  selected,
  onClick,
  children,
}: {
  selected: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  const selectedClass = selected
    ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
    : 'text-gray-700 dark:text-gray-300'
  return (
    <button onClick={onClick} className={`flex w-full items-center gap-2 px-3 py-1.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-600 ${selectedClass}`}>
      {children}
    </button>
  )
}
