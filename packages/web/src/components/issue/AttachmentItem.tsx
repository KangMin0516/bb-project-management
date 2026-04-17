import { type Attachment } from '@/api/issues'
import { Trash2 } from 'lucide-react'
import { useImagePreviewStore } from '@/stores/imagePreview'

export default function AttachmentItem({ attachment, onDelete }: { attachment: Attachment; onDelete: (id: string) => void }) {
  const isImage = attachment.mimeType.startsWith('image/')
  const isVideo = attachment.mimeType.startsWith('video/')
  const sizeStr = attachment.fileSize > 1024 * 1024
    ? `${(attachment.fileSize / (1024 * 1024)).toFixed(1)} MB`
    : `${(attachment.fileSize / 1024).toFixed(0)} KB`

  return (
    <div className="flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2">
      {isImage && (
        <button
          onClick={() => useImagePreviewStore.getState().open(attachment.url, attachment.fileName)}
          className="shrink-0"
        >
          <img src={attachment.url} alt={attachment.fileName} className="h-10 w-10 cursor-pointer rounded object-cover hover:opacity-80 transition" />
        </button>
      )}
      {isVideo && (
        <video src={attachment.url} className="h-10 w-10 rounded object-cover" muted />
      )}
      {!isImage && !isVideo && (
        <div className="flex h-10 w-10 items-center justify-center rounded bg-gray-200 text-xs text-gray-500">
          FILE
        </div>
      )}
      <div className="flex-1 min-w-0">
        <a href={attachment.url} target="_blank" rel="noopener noreferrer" className="block truncate text-sm font-medium text-gray-700 hover:text-primary-600">
          {attachment.fileName}
        </a>
        <span className="text-xs text-gray-400">{sizeStr}</span>
      </div>
      <button onClick={() => onDelete(attachment.id)} className="text-gray-400 hover:text-red-500">
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}
