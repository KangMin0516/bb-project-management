import { useEffect } from 'react'
import { X } from 'lucide-react'
import { useImagePreviewStore } from '@/stores/imagePreview'

export default function ImagePreviewModal() {
  const { url, alt, close, open } = useImagePreviewStore()

  // Global click handler for images inside .tiptap-editor and .markdown-body
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (target.tagName !== 'IMG') return
      const container = target.closest('.tiptap-editor, .markdown-body')
      if (!container) return
      // Skip if inside an editable TipTap editor (editing mode)
      const editable = target.closest('[contenteditable="true"]')
      if (editable) return
      const img = target as HTMLImageElement
      if (img.src) {
        e.preventDefault()
        e.stopPropagation()
        open(img.src, img.alt || '')
      }
    }
    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [open])

  useEffect(() => {
    if (!url) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [url, close])

  if (!url) return null

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70"
      onClick={close}
    >
      <button
        onClick={close}
        className="absolute right-4 top-4 rounded-full bg-black/50 p-2 text-white hover:bg-black/70 transition"
      >
        <X className="h-5 w-5" />
      </button>
      <img
        src={url}
        alt={alt}
        className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  )
}
