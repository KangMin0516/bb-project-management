import { useEffect, useRef, useCallback, useMemo, useState } from 'react'
import { useEditor, EditorContent, type Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import Image from '@tiptap/extension-image'
import { Table, TableRow, TableCell, TableHeader } from '@tiptap/extension-table'
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight'
import Mention from '@tiptap/extension-mention'
import { common, createLowlight } from 'lowlight'
import TipTapToolbar from './TipTapToolbar'
import { VideoExtension } from './VideoExtension'
import { MediaBubbleMenu } from './MediaBubbleMenu'

import { useToastStore } from '@/shared/lib/toast'
import { prepareForUpload } from '@/shared/lib/prepareUpload'
import { getErrorMessage } from '@/shared/lib/error'
import './editor.css'
import { issueRepository } from '@/features/issue/repository'

// Extend the base Image extension to support a width attribute for inline resize.
const ResizableImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        parseHTML: (el) => (el as HTMLElement).style.width || null,
        renderHTML: (attrs) =>
          attrs.width ? { style: `width: ${attrs.width}; max-width: 100%;` } : {},
      },
    }
  },
})

const lowlight = createLowlight(common)

interface TipTapEditorProps {
  content: string
  onChange: (html: string) => void
  placeholder?: string
  className?: string
  editable?: boolean
  minHeight?: string
  onSubmit?: () => void
  onReady?: (editor: Editor) => void
  issueId?: string
}

/**
 * Detect if content is markdown (not HTML) and convert to simple HTML.
 * This ensures backward compatibility with existing markdown content.
 */
function markdownToHtml(content: string): string {
  if (!content) return ''

  // If it already contains HTML tags, return as-is
  if (/<[a-z][\s\S]*>/i.test(content)) {
    return content
  }

  // Simple markdown to HTML conversion for TipTap consumption
  let html = content
    // Headings
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    // Bold & Italic
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/_(.+?)_/g, '<em>$1</em>')
    // Strikethrough
    .replace(/~~(.+?)~~/g, '<del>$1</del>')
    // Inline code
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    // Images (must come before links to avoid ![alt](url) matching as link)
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img alt="$1" src="$2" />')
    // Links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    // Blockquote
    .replace(/^> (.+)$/gm, '<blockquote><p>$1</p></blockquote>')
    // Horizontal rule
    .replace(/^---$/gm, '<hr>')
    // Unordered list items
    .replace(/^[-*] (.+)$/gm, '<li>$1</li>')
    // Ordered list items
    .replace(/^\d+\. (.+)$/gm, '<li>$1</li>')

  // Wrap consecutive <li> in <ul> (simple heuristic)
  html = html.replace(/((?:<li>.*<\/li>\n?)+)/g, '<ul>$1</ul>')

  // Convert remaining plain lines to paragraphs
  const lines = html.split('\n')
  const result: string[] = []
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) {
      continue
    }
    if (
      trimmed.startsWith('<h') ||
      trimmed.startsWith('<ul') ||
      trimmed.startsWith('<ol') ||
      trimmed.startsWith('<li') ||
      trimmed.startsWith('<blockquote') ||
      trimmed.startsWith('<hr') ||
      trimmed.startsWith('<img') ||
      trimmed.startsWith('<pre') ||
      trimmed.startsWith('<table')
    ) {
      result.push(trimmed)
    } else if (!trimmed.startsWith('<p') && !trimmed.startsWith('</')) {
      result.push(`<p>${trimmed}</p>`)
    } else {
      result.push(trimmed)
    }
  }

  return result.join('')
}

export default function TipTapEditor({
  content,
  onChange,
  placeholder: placeholderText = '',
  className = '',
  editable = true,
  minHeight = '150px',
  onSubmit,
  onReady,
  issueId,
}: TipTapEditorProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const videoInputRef = useRef<HTMLInputElement>(null)
  const [uploadingCount, setUploadingCount] = useState(0)
  const isUploading = uploadingCount > 0
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const initialContent = useMemo(() => markdownToHtml(content), [])

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        codeBlock: false, // We use CodeBlockLowlight instead
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          rel: 'noopener noreferrer',
          target: '_blank',
        },
      }),
      Placeholder.configure({
        placeholder: placeholderText,
      }),
      ResizableImage.configure({
        HTMLAttributes: { class: 'rounded-md' },
      }),
      VideoExtension,
      Table.configure({
        resizable: true,
      }),
      TableRow,
      TableCell,
      TableHeader,
      CodeBlockLowlight.configure({
        lowlight,
      }),
      // Mention node — we keep the suggestion popup logic in the
      // consumer (CommentInput) and only use this extension for the
      // styled chip when a mention is committed. `renderHTML` outputs
      // a span with data attrs the backend can parse if needed.
      Mention.configure({
        HTMLAttributes: { class: 'mention' },
        renderHTML({ options, node }) {
          const id = node.attrs.id ?? ''
          const label = node.attrs.label ?? node.attrs.id ?? ''
          return [
            'span',
            { ...options.HTMLAttributes, 'data-id': id, 'data-label': label },
            `@${label}`,
          ]
        },
      }),
    ],
    content: initialContent,
    editable,
    onUpdate: ({ editor: e }) => {
      const html = e.getHTML()
      // TipTap returns '<p></p>' for empty content
      onChange(html === '<p></p>' ? '' : html)
    },
    editorProps: {
      attributes: {
        class: 'tiptap-editor focus:outline-none',
        style: `min-height: ${minHeight}; padding: 0.75rem;`,
      },
      handleKeyDown: (_view, event) => {
        if ((event.metaKey || event.ctrlKey) && event.key === 'Enter' && onSubmit) {
          event.preventDefault()
          onSubmit()
          return true
        }
        return false
      },
      handleDrop: (_view, event) => {
        const files = event.dataTransfer?.files
        if (files && files.length > 0) {
          const mediaFiles = Array.from(files).filter(
            (f) => f.type.startsWith('image/') || f.type.startsWith('video/'),
          )
          if (mediaFiles.length > 0) {
            event.preventDefault()
            mediaFiles.forEach((file) =>
              file.type.startsWith('video/') ? handleVideoUpload(file) : handleImageUpload(file),
            )
            return true
          }
        }
        return false
      },
      handlePaste: (_view, event) => {
        const files = event.clipboardData?.files
        if (files && files.length > 0) {
          const mediaFiles = Array.from(files).filter(
            (f) => f.type.startsWith('image/') || f.type.startsWith('video/'),
          )
          if (mediaFiles.length > 0) {
            event.preventDefault()
            mediaFiles.forEach((file) =>
              file.type.startsWith('video/') ? handleVideoUpload(file) : handleImageUpload(file),
            )
            return true
          }
        }
        return false
      },
    },
  })

  // Update content when prop changes externally
  useEffect(() => {
    if (!editor) return
    const newHtml = markdownToHtml(content)
    const currentHtml = editor.getHTML()
    // Clear editor when content is empty (e.g., after submit)
    if (content === '' && currentHtml !== '<p></p>') {
      editor.commands.clearContent()
      return
    }
    // Only update if content is meaningfully different (avoid cursor reset)
    if (newHtml !== currentHtml && content !== '' && currentHtml === '<p></p>') {
      editor.commands.setContent(newHtml)
    }
  }, [content, editor])

  // Update editable state
  useEffect(() => {
    if (editor) {
      editor.setEditable(editable)
    }
  }, [editable, editor])

  // Notify parent once the editor instance is ready so it can drive
  // imperative inserts (mention picker etc.).
  useEffect(() => {
    if (editor && onReady) onReady(editor)
  }, [editor, onReady])

  const replaceNodeSrc = useCallback((placeholderSrc: string, finalSrc: string, type: 'image' | 'video') => {
    if (!editor) return
    const tr = editor.state.tr
    let replaced = false
    editor.state.doc.descendants((node, pos) => {
      if (node.type.name === type && node.attrs.src === placeholderSrc) {
        tr.setNodeAttribute(pos, 'src', finalSrc)
        replaced = true
      }
    })
    if (replaced) editor.view.dispatch(tr)
  }, [editor])

  const removeNode = useCallback((placeholderSrc: string, type: 'image' | 'video') => {
    if (!editor) return
    const tr = editor.state.tr
    const toDelete: { pos: number; size: number }[] = []
    editor.state.doc.descendants((node, pos) => {
      if (node.type.name === type && node.attrs.src === placeholderSrc) {
        toDelete.push({ pos, size: node.nodeSize })
      }
    })
    for (const { pos, size } of toDelete.reverse()) {
      tr.delete(pos, pos + size)
    }
    if (toDelete.length) editor.view.dispatch(tr)
  }, [editor])

  const handleImageUpload = useCallback(async (file: File) => {
    if (!editor) return
    const placeholderSrc = `data:uploading:img:${Date.now()}:${Math.random()}`
    editor.chain().focus().setImage({ src: placeholderSrc }).run()
    setUploadingCount((c) => c + 1)
    try {
      const prepared = await prepareForUpload(file)
      const result = await issueRepository.uploadFile(prepared, issueId ? { issueId } : undefined)
      if (result.url) {
        replaceNodeSrc(placeholderSrc, result.url, 'image')
      } else {
        removeNode(placeholderSrc, 'image')
      }
    } catch (err) {
      removeNode(placeholderSrc, 'image')
      useToastStore.getState().addToast(getErrorMessage(err, 'Image upload failed'), 'error')
    } finally {
      setUploadingCount((c) => c - 1)
    }
  }, [editor, replaceNodeSrc, removeNode])

  const handleVideoUpload = useCallback(async (file: File) => {
    if (!editor) return
    const placeholderSrc = `data:uploading:vid:${Date.now()}:${Math.random()}`
    editor.chain().focus().setVideo({ src: placeholderSrc }).run()
    setUploadingCount((c) => c + 1)
    try {
      const prepared = await prepareForUpload(file)
      const result = await issueRepository.uploadFile(prepared, issueId ? { issueId } : undefined)
      if (result.url) {
        replaceNodeSrc(placeholderSrc, result.url, 'video')
      } else {
        removeNode(placeholderSrc, 'video')
      }
    } catch (err) {
      removeNode(placeholderSrc, 'video')
      useToastStore.getState().addToast(getErrorMessage(err, 'Video upload failed'), 'error')
    } finally {
      setUploadingCount((c) => c - 1)
    }
  }, [editor, replaceNodeSrc, removeNode])

  const handleImageButtonClick = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const handleVideoButtonClick = useCallback(() => {
    videoInputRef.current?.click()
  }, [])

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleImageUpload(file)
    e.target.value = ''
  }, [handleImageUpload])

  const handleVideoSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleVideoUpload(file)
    e.target.value = ''
  }, [handleVideoUpload])

  if (!editor) return null

  return (
    <div className={`rounded-lg border border-gray-300 dark:border-gray-600 overflow-hidden ${className}`}>
      {editable && (
        <TipTapToolbar
          editor={editor}
          onImageClick={handleImageButtonClick}
          onVideoClick={handleVideoButtonClick}
          isUploading={isUploading}
        />
      )}
      <MediaBubbleMenu editor={editor} />
      <EditorContent editor={editor} />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        disabled={isUploading}
        onChange={handleFileSelect}
      />
      <input
        ref={videoInputRef}
        type="file"
        accept="video/*"
        className="hidden"
        disabled={isUploading}
        onChange={handleVideoSelect}
      />
    </div>
  )
}
