import type { Editor } from '@tiptap/react'
import {
  Bold,
  Italic,
  Strikethrough,
  Code,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  CodeSquare,
  Link,
  Image,
  Table,
  Undo,
  Redo,
} from 'lucide-react'

interface TipTapToolbarProps {
  editor: Editor
  onImageClick?: () => void
}

interface ToolbarButton {
  icon: React.ReactNode
  title: string
  action: () => void
  isActive?: () => boolean
}

export default function TipTapToolbar({ editor, onImageClick }: TipTapToolbarProps) {
  const groups: ToolbarButton[][] = [
    // Text formatting
    [
      {
        icon: <Bold className="h-3.5 w-3.5" />,
        title: 'Bold (Ctrl+B)',
        action: () => editor.chain().focus().toggleBold().run(),
        isActive: () => editor.isActive('bold'),
      },
      {
        icon: <Italic className="h-3.5 w-3.5" />,
        title: 'Italic (Ctrl+I)',
        action: () => editor.chain().focus().toggleItalic().run(),
        isActive: () => editor.isActive('italic'),
      },
      {
        icon: <Strikethrough className="h-3.5 w-3.5" />,
        title: 'Strikethrough',
        action: () => editor.chain().focus().toggleStrike().run(),
        isActive: () => editor.isActive('strike'),
      },
      {
        icon: <Code className="h-3.5 w-3.5" />,
        title: 'Inline Code',
        action: () => editor.chain().focus().toggleCode().run(),
        isActive: () => editor.isActive('code'),
      },
    ],
    // Headings
    [
      {
        icon: <Heading1 className="h-3.5 w-3.5" />,
        title: 'Heading 1',
        action: () => editor.chain().focus().toggleHeading({ level: 1 }).run(),
        isActive: () => editor.isActive('heading', { level: 1 }),
      },
      {
        icon: <Heading2 className="h-3.5 w-3.5" />,
        title: 'Heading 2',
        action: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
        isActive: () => editor.isActive('heading', { level: 2 }),
      },
      {
        icon: <Heading3 className="h-3.5 w-3.5" />,
        title: 'Heading 3',
        action: () => editor.chain().focus().toggleHeading({ level: 3 }).run(),
        isActive: () => editor.isActive('heading', { level: 3 }),
      },
    ],
    // Lists & blocks
    [
      {
        icon: <List className="h-3.5 w-3.5" />,
        title: 'Bullet List',
        action: () => editor.chain().focus().toggleBulletList().run(),
        isActive: () => editor.isActive('bulletList'),
      },
      {
        icon: <ListOrdered className="h-3.5 w-3.5" />,
        title: 'Ordered List',
        action: () => editor.chain().focus().toggleOrderedList().run(),
        isActive: () => editor.isActive('orderedList'),
      },
      {
        icon: <Quote className="h-3.5 w-3.5" />,
        title: 'Blockquote',
        action: () => editor.chain().focus().toggleBlockquote().run(),
        isActive: () => editor.isActive('blockquote'),
      },
      {
        icon: <CodeSquare className="h-3.5 w-3.5" />,
        title: 'Code Block',
        action: () => editor.chain().focus().toggleCodeBlock().run(),
        isActive: () => editor.isActive('codeBlock'),
      },
    ],
    // Insert
    [
      {
        icon: <Link className="h-3.5 w-3.5" />,
        title: 'Link',
        action: () => {
          const url = window.prompt('Enter URL')
          if (url) {
            editor.chain().focus().setLink({ href: url }).run()
          }
        },
        isActive: () => editor.isActive('link'),
      },
      {
        icon: <Image className="h-3.5 w-3.5" />,
        title: 'Image',
        action: () => {
          if (onImageClick) {
            onImageClick()
          } else {
            const url = window.prompt('Enter image URL')
            if (url) {
              editor.chain().focus().setImage({ src: url }).run()
            }
          }
        },
      },
      {
        icon: <Table className="h-3.5 w-3.5" />,
        title: 'Insert Table',
        action: () => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
      },
    ],
    // History
    [
      {
        icon: <Undo className="h-3.5 w-3.5" />,
        title: 'Undo (Ctrl+Z)',
        action: () => editor.chain().focus().undo().run(),
      },
      {
        icon: <Redo className="h-3.5 w-3.5" />,
        title: 'Redo (Ctrl+Y)',
        action: () => editor.chain().focus().redo().run(),
      },
    ],
  ]

  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b border-gray-200 bg-gray-50 px-2 py-1">
      {groups.map((group, gi) => (
        <div key={gi} className="flex items-center gap-0.5">
          {gi > 0 && <div className="mx-1 h-4 w-px bg-gray-300" />}
          {group.map((btn, bi) => (
            <button
              key={bi}
              type="button"
              title={btn.title}
              onClick={btn.action}
              className={`rounded px-1.5 py-1 transition-colors ${
                btn.isActive?.()
                  ? 'bg-primary-100 text-primary-700'
                  : 'text-gray-600 hover:bg-gray-200 hover:text-gray-900'
              }`}
            >
              {btn.icon}
            </button>
          ))}
        </div>
      ))}
    </div>
  )
}
