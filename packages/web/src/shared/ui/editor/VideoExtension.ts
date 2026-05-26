import { Node, mergeAttributes, type CommandProps } from '@tiptap/core'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    video: {
      setVideo: (options: { src: string; width?: string | null }) => ReturnType
    }
  }
}

export const VideoExtension = Node.create({
  name: 'video',
  group: 'block',
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      src: { default: null },
      width: {
        default: null,
        parseHTML: (el: HTMLElement) => el.style.width || null,
        renderHTML: (attrs: Record<string, unknown>) =>
          attrs.width
            ? { style: `width: ${attrs.width}; max-width: 100%;` }
            : { style: 'max-width: 100%;' },
      },
    }
  },

  parseHTML() {
    return [{ tag: 'video[src]' }]
  },

  renderHTML({ HTMLAttributes }: { HTMLAttributes: Record<string, unknown> }) {
    return ['video', mergeAttributes(HTMLAttributes, { controls: true })]
  },

  addCommands() {
    return {
      setVideo:
        (options: { src: string; width?: string | null }) =>
        ({ commands }: CommandProps) =>
          commands.insertContent({ type: this.name, attrs: options }),
    }
  },
})
