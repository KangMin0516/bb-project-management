import { useEffect } from 'react'
import { X } from 'lucide-react'
import { useImagePreviewStore } from '@/shared/lib/imagePreview'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/shared/ui/dialog'

export default function ImagePreviewModal() {
  const { url, alt, close, open } = useImagePreviewStore()

  // Global click handler for images inside .tiptap-editor and .markdown-body.
  // Kept as-is — the store decides when to show the lightbox.
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

  // The lightbox is open whenever the store has a url; Dialog handles
  // Esc + click-outside via onOpenChange.
  const isOpen = !!url

  return (
    <Dialog open={isOpen} onOpenChange={(next) => { if (!next) close() }}>
      <DialogContent
        hideCloseButton
        className="max-w-[95vw] w-auto border-0 bg-transparent shadow-none p-0 gap-0"
        onClick={close}
      >
        <DialogTitle className="sr-only">Image preview</DialogTitle>
        <DialogDescription className="sr-only">{alt || 'Preview image'}</DialogDescription>
        <button
          onClick={close}
          className="absolute right-4 top-4 rounded-full bg-black/50 p-2 text-white hover:bg-black/70 transition z-10"
          aria-label="Close preview"
        >
          <X className="h-5 w-5" />
        </button>
        {url && (
          <img
            src={url}
            alt={alt}
            className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
