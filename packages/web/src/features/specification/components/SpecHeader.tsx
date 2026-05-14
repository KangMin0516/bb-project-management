import { Download, PanelRightClose, PanelRightOpen } from 'lucide-react'
import { cn } from '@/shared/lib/utils'
import { SPEC_STATUS_COLORS } from '@/shared/config/constants'
import type { SpecDetail, SpecStatus } from '@/features/specification/api'
import { confirmDialog } from '@/shared/ui/confirm-dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/ui/select'

const STATUSES: SpecStatus[] = ['DRAFT', 'REVIEW', 'APPROVED', 'DEPRECATED']

interface SpecHeaderProps {
  spec: SpecDetail
  editing: boolean
  isUpdating: boolean
  showComments: boolean
  onStatusChange: (status: SpecStatus) => void
  onEdit: () => void
  onCancel: () => void
  onSave: () => void
  onDownload: () => void
  onDelete: () => void
  onToggleComments: () => void
}

export default function SpecHeader({
  spec,
  editing,
  isUpdating,
  showComments,
  onStatusChange,
  onEdit,
  onCancel,
  onSave,
  onDownload,
  onDelete,
  onToggleComments,
}: SpecHeaderProps) {
  return (
    <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-6 py-3">
      <div className="flex items-center gap-3 flex-wrap">
        <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">{spec.title}</h2>
        <span className={cn('rounded px-2 py-0.5 text-[10px] font-medium', SPEC_STATUS_COLORS[spec.status])}>{spec.status}</span>
        {spec.issueLinks && spec.issueLinks.length > 0 && (
          <div className="flex items-center gap-1">
            {spec.issueLinks.map((link) => (
              <span
                key={link.id}
                className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700"
                title={`#${link.issue.number} ${link.issue.title} (${link.issue.status})`}
              >
                #{link.issue.number}
                <span className="text-blue-400">{link.issue.status.replace(/_/g, ' ')}</span>
              </span>
            ))}
          </div>
        )}
      </div>
      <div className="flex items-center gap-2">
        <Select value={spec.status} onValueChange={(v) => onStatusChange(v as SpecStatus)}>
          <SelectTrigger className="h-8 w-auto text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        {!editing ? (
          <ActionButton onClick={onEdit}>Edit</ActionButton>
        ) : (
          <>
            <ActionButton onClick={onSave} primary disabled={isUpdating}>
              {isUpdating ? 'Saving...' : 'Save'}
            </ActionButton>
            <ActionButton onClick={onCancel}>Cancel</ActionButton>
          </>
        )}
        <ActionButton onClick={onDownload} title="Download as Markdown">
          <Download className="inline h-3.5 w-3.5 -mt-0.5 mr-1" />
          .md
        </ActionButton>
        <DeleteButton onClick={onDelete} />
        <button
          onClick={onToggleComments}
          className="rounded p-1 text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-600 dark:hover:text-gray-300"
          title={showComments ? 'Hide comments' : 'Show comments'}
        >
          {showComments ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
        </button>
      </div>
    </div>
  )
}

function ActionButton({ onClick, primary, disabled, title, children }: { onClick: () => void; primary?: boolean; disabled?: boolean; title?: string; children: React.ReactNode }) {
  const cls = primary
    ? 'bg-primary-600 text-white hover:bg-primary-700'
    : 'border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`rounded-lg ${primary ? '' : 'border'} px-3 py-1 text-xs font-medium ${cls} disabled:opacity-50`}
    >
      {children}
    </button>
  )
}

function DeleteButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={async () => {
        if (await confirmDialog({
          title: 'Delete this specification?',
          confirmLabel: 'Delete',
          destructive: true,
        })) onClick()
      }}
      className="rounded-lg border border-red-200 px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
    >
      Delete
    </button>
  )
}
