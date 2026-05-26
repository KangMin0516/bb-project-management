import { BubbleMenu } from '@tiptap/react/menus'
import type { Editor } from '@tiptap/react'

const WIDTH_PRESETS = [
  { label: '25%', value: '25%' },
  { label: '50%', value: '50%' },
  { label: '75%', value: '75%' },
  { label: '100%', value: '100%' },
]

export function MediaBubbleMenu({ editor }: { editor: Editor }) {
  const activeType = editor.isActive('image') ? 'image' : editor.isActive('video') ? 'video' : null
  const currentWidth = activeType ? editor.getAttributes(activeType).width : null

  const setWidth = (width: string) => {
    if (!activeType) return
    editor.chain().focus().updateAttributes(activeType, { width }).run()
  }

  return (
    <BubbleMenu
      editor={editor}
      shouldShow={({ editor: e }) => e.isActive('image') || e.isActive('video')}
      updateDelay={0}
    >
      <div className="flex items-center gap-0.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 shadow-lg px-1 py-1">
        <span className="px-1.5 text-[10px] font-medium text-gray-400 dark:text-gray-500 select-none">
          Width
        </span>
        <div className="mx-1 h-3.5 w-px bg-gray-200 dark:bg-gray-600" />
        {WIDTH_PRESETS.map(({ label, value }) => (
          <button
            key={value}
            type="button"
            onMouseDown={(e) => { e.preventDefault(); setWidth(value) }}
            className={`rounded px-2 py-0.5 text-xs font-medium transition-colors ${
              currentWidth === value
                ? 'bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
    </BubbleMenu>
  )
}
