import { useState, useMemo } from 'react'
import { Checkbox } from '@/shared/ui/checkbox'
import type { SlackUser } from '@/features/integrations/slack/api'

interface MemberSelectorProps {
  slackUsers: SlackUser[]
  selectedIds: string[]
  onChange: (ids: string[]) => void
}

/**
 * Two-pane Slack-user picker: selected pills above, searchable checkbox
 * list below. Search state is local — it doesn't bubble up because it has
 * no effect on the picked value.
 */
export default function MemberSelector({ slackUsers, selectedIds, onChange }: MemberSelectorProps) {
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return slackUsers.filter((u) => u.realName.toLowerCase().includes(q) || u.name.toLowerCase().includes(q))
  }, [slackUsers, search])

  const selectedUsers = useMemo(
    () => slackUsers.filter((u) => selectedIds.includes(u.id)),
    [slackUsers, selectedIds],
  )

  const toggle = (id: string, checked: boolean) => {
    onChange(checked ? [...selectedIds, id] : selectedIds.filter((x) => x !== id))
  }

  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 dark:text-gray-500 mb-1">
        Members ({selectedIds.length} selected)
      </label>
      {selectedUsers.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1">
          {selectedUsers.map((u) => (
            <span key={u.id} className="inline-flex items-center gap-1 rounded-full bg-primary-100 px-2 py-0.5 text-xs text-primary-700">
              {u.avatar && <img src={u.avatar} alt="" className="h-4 w-4 rounded-full" />}
              {u.realName}
              <button onClick={() => toggle(u.id, false)} className="ml-0.5 text-primary-400 hover:text-primary-600" aria-label={`Remove ${u.realName}`}>
                ×
              </button>
            </span>
          ))}
        </div>
      )}
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search users..."
        className="mb-1 w-full rounded border border-gray-300 dark:border-gray-600 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
      />
      <div className="max-h-40 overflow-y-auto rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        {filtered.length === 0 ? (
          <p className="px-2 py-2 text-xs text-gray-400 dark:text-gray-500">No users found</p>
        ) : (
          filtered.map((u) => (
            <label key={u.id} className="flex cursor-pointer items-center gap-2 px-2 py-1 text-sm hover:bg-gray-50 dark:hover:bg-gray-900">
              <Checkbox
                checked={selectedIds.includes(u.id)}
                onCheckedChange={(checked) => toggle(u.id, checked === true)}
              />
              {u.avatar && <img src={u.avatar} alt="" className="h-5 w-5 rounded-full" />}
              <span>{u.realName}</span>
              <span className="text-xs text-gray-400 dark:text-gray-500">@{u.name}</span>
            </label>
          ))
        )}
      </div>
    </div>
  )
}
