import { useState } from 'react'
import { Trash2, UserPlus } from 'lucide-react'
import type { ProjectMember } from '@/features/project/api'
import type { User } from '@/entities/user/api'
import { useImagePreviewStore } from '@/shared/lib/imagePreview'
import SettingsSection from './SettingsSection'

const ROLES = ['ADMIN', 'PM', 'DEVELOPER'] as const

interface MembersSectionProps {
  members: ProjectMember[] | undefined
  allUsers: User[] | undefined
  onAdd: (data: { userId: string; role: string }) => void
  onRemove: (memberId: string) => void
  onUpdateRole: (memberId: string, role: string) => void
}

export default function MembersSection({ members, allUsers, onAdd, onRemove, onUpdateRole }: MembersSectionProps) {
  const memberUserIds = new Set(members?.map((m) => m.userId) || [])
  const availableUsers = allUsers?.filter((u) => !memberUserIds.has(u.id)) || []

  return (
    <SettingsSection title="Members">
      <div className="space-y-2">
        {members?.map((m) => (
          <MemberRow key={m.id} member={m} onRemove={() => onRemove(m.id)} onChangeRole={(role) => onUpdateRole(m.id, role)} />
        ))}
      </div>
      {availableUsers.length > 0 && <AddMemberForm users={availableUsers} onSubmit={onAdd} />}
    </SettingsSection>
  )
}

function MemberRow({
  member,
  onRemove,
  onChangeRole,
}: {
  member: ProjectMember
  onRemove: () => void
  onChangeRole: (role: string) => void
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg bg-gray-50 dark:bg-gray-900 px-3 py-2">
      <button
        type="button"
        onClick={() => member.user.avatar && useImagePreviewStore.getState().open(member.user.avatar, member.user.name)}
        className={`flex h-7 w-7 items-center justify-center rounded-full bg-primary-100 text-xs font-medium text-primary-700 overflow-hidden ${member.user.avatar ? 'cursor-pointer hover:ring-2 hover:ring-primary-300 transition' : 'cursor-default'}`}
      >
        {member.user.avatar
          ? <img src={member.user.avatar} alt={member.user.name} className="h-full w-full object-cover" />
          : member.user.name.charAt(0).toUpperCase()}
      </button>
      <div className="flex-1">
        <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{member.user.name}</div>
        <div className="text-xs text-gray-500 dark:text-gray-400">{member.user.email}</div>
      </div>
      <select
        value={member.role}
        onChange={(e) => onChangeRole(e.target.value)}
        className="rounded border border-gray-300 dark:border-gray-600 px-2 py-1 text-xs focus:outline-none"
      >
        {ROLES.map((r) => <option key={r} value={r}>{r === 'DEVELOPER' ? 'Developer' : r}</option>)}
      </select>
      <button onClick={onRemove} className="text-gray-400 dark:text-gray-500 hover:text-red-500" aria-label={`Remove ${member.user.name}`}>
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  )
}

function AddMemberForm({
  users,
  onSubmit,
}: {
  users: User[]
  onSubmit: (data: { userId: string; role: string }) => void
}) {
  const [userId, setUserId] = useState('')
  const [role, setRole] = useState<string>('DEVELOPER')

  const submit = () => {
    if (!userId) return
    onSubmit({ userId, role })
    setUserId('')
  }

  return (
    <div className="mt-3 flex items-center gap-2">
      <select
        value={userId}
        onChange={(e) => setUserId(e.target.value)}
        className="flex-1 rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-sm focus:outline-none"
      >
        <option value="">Select user...</option>
        {users.map((u) => (
          <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
        ))}
      </select>
      <select
        value={role}
        onChange={(e) => setRole(e.target.value)}
        className="rounded-lg border border-gray-300 dark:border-gray-600 px-2 py-1.5 text-sm focus:outline-none"
      >
        {ROLES.map((r) => <option key={r} value={r}>{r === 'DEVELOPER' ? 'Developer' : r}</option>)}
      </select>
      <button
        onClick={submit}
        disabled={!userId}
        className="flex items-center gap-1 rounded-lg bg-primary-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
      >
        <UserPlus className="h-4 w-4" />
        Add
      </button>
    </div>
  )
}
