import type { Attachment } from '@/features/issue/api'
import AttachmentItem from '@/features/issue/components/AttachmentItem'

interface IssueAttachmentsProps {
  attachments: Attachment[] | undefined
  uploading: boolean
  onUpload: (file: File) => void
  onDelete: (id: string) => void
}

export default function IssueAttachments({ attachments, uploading, onUpload, onDelete }: IssueAttachmentsProps) {
  const count = attachments?.length ?? 0
  return (
    <div>
      <span className="block text-xs font-medium text-gray-500 mb-1">
        Attachments {count > 0 ? `(${count})` : ''}
      </span>
      {count > 0 && (
        <div className="space-y-1 mb-2">
          {attachments!.map((att) => (
            <AttachmentItem key={att.id} attachment={att} onDelete={onDelete} />
          ))}
        </div>
      )}
      <label className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700">
        <input
          type="file"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) onUpload(file)
            e.target.value = ''
          }}
        />
        {uploading ? 'Uploading...' : '+ Add file'}
      </label>
    </div>
  )
}
