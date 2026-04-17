import { useEffect, useRef, useCallback, useMemo } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import Image from '@tiptap/extension-image'
import { Table, TableRow, TableCell, TableHeader } from '@tiptap/extension-table'
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight'
import { common, createLowlight } from 'lowlight'
import TipTapToolbar from './TipTapToolbar'
import { uploadApi } from '@/api/issues'
import { useToastStore } from '@/stores/toast'
import './editor.css'

const lowlight = createLowlight(common)

interface TipTapEditorProps {
  content: string
  onChange: (html: string) => void
  placeholder?: string
  className?: string
  editable?: boolean
  minHeight?: string
  onSubmit?: () => void
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
}: TipTapEditorProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
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
      Image.configure({
        HTMLAttributes: {
          class: 'rounded-md max-w-full',
        },
      }),
      Table.configure({
        resizable: true,
      }),
      TableRow,
      TableCell,
      TableHeader,
      CodeBlockLowlight.configure({
        lowlight,
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
          const imageFiles = Array.from(files).filter((f) => f.type.startsWith('image/'))
          if (imageFiles.length > 0) {
            event.preventDefault()
            imageFiles.forEach((file) => handleImageUpload(file))
            return true
          }
        }
        return false
      },
      handlePaste: (_view, event) => {
        const files = event.clipboardData?.files
        if (files && files.length > 0) {
          const imageFiles = Array.from(files).filter((f) => f.type.startsWith('image/'))
          if (imageFiles.length > 0) {
            event.preventDefault()
            imageFiles.forEach((file) => handleImageUpload(file))
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

  const handleImageUpload = useCallback(async (file: File) => {
    if (!editor) return
    try {
      const result = await uploadApi.upload(file)
      if (result.url) {
        editor.chain().focus().setImage({ src: result.url }).run()
      }
    } catch {
      useToastStore.getState().addToast('Image upload failed', 'error')
    }
  }, [editor])

  const handleImageButtonClick = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      handleImageUpload(file)
    }
    e.target.value = ''
  }, [handleImageUpload])

  if (!editor) return null

  return (
    <div className={`rounded-lg border border-gray-300 dark:border-gray-600 overflow-hidden ${className}`}>
      {editable && (
        <TipTapToolbar editor={editor} onImageClick={handleImageButtonClick} />
      )}
      <EditorContent editor={editor} />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileSelect}
      />
    </div>
  )
}
