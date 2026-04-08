import { type JSX, useMemo, useEffect, useRef, useCallback, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeSanitize from 'rehype-sanitize'
import rehypeHighlight from 'rehype-highlight'
import type { SpecSection, SpecComment } from '@/api/specifications'
import { MessageSquare } from 'lucide-react'
import '@/components/markdown/markdown.css'

interface Props {
  content: string
  sections: SpecSection[]
  comments: SpecComment[]
  onSectionClick: (sectionId: string) => void
}

function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9가-힣\s-]/g, '')
    .replace(/\s+/g, '-')
    .slice(0, 100)
}

export default function SpecContent({ content, sections, comments, onSectionClick }: Props) {
  const contentRef = useRef<HTMLDivElement>(null)
  const [activeTocId, setActiveTocId] = useState<string | null>(null)

  // Count unresolved comments per section
  const commentCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const c of comments) {
      if (!c.resolved && c.section?.sectionId) {
        counts.set(c.section.sectionId, (counts.get(c.section.sectionId) || 0) + 1)
      }
    }
    return counts
  }, [comments])

  // IntersectionObserver for active TOC heading
  useEffect(() => {
    const container = contentRef.current
    if (!container) return

    const headings = container.querySelectorAll<HTMLElement>('h1, h2, h3, h4, h5, h6')
    if (headings.length === 0) return

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveTocId(entry.target.id)
          }
        }
      },
      { rootMargin: '-20% 0px -70% 0px' },
    )

    headings.forEach((h) => observer.observe(h))
    return () => observer.disconnect()
  }, [content])

  // Scroll to section
  const scrollToSection = useCallback((sectionId: string) => {
    const el = contentRef.current?.querySelector(`#${CSS.escape(sectionId)}`)
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])

  // Custom heading components that add IDs and comment badges
  const headingComponents = useMemo(() => {
    const createHeading = (level: number) => {
      const Tag = `h${level}` as keyof JSX.IntrinsicElements
      return function HeadingWithBadge({ children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
        const text = typeof children === 'string' ? children : String(children)
        const id = slugify(text)
        const count = commentCounts.get(id) || 0
        return (
          // @ts-expect-error dynamic tag
          <Tag id={id} {...props} className="group relative">
            {children}
            <button
              onClick={(e) => { e.preventDefault(); onSectionClick(id) }}
              className="ml-2 inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-medium opacity-0 transition group-hover:opacity-100 hover:bg-gray-100"
            >
              <MessageSquare className="h-3 w-3 text-gray-400" />
              {count > 0 && <span className="text-amber-600">{count}</span>}
            </button>
          </Tag>
        )
      }
    }

    return {
      h1: createHeading(1),
      h2: createHeading(2),
      h3: createHeading(3),
      h4: createHeading(4),
      h5: createHeading(5),
      h6: createHeading(6),
    }
  }, [commentCounts, onSectionClick])

  return (
    <div className="flex gap-6">
      {/* TOC sidebar */}
      {sections.length > 0 && (
        <nav className="sticky top-0 hidden w-48 shrink-0 lg:block">
          <div className="max-h-[calc(100vh-200px)] overflow-y-auto py-4">
            <p className="mb-2 text-xs font-medium uppercase text-gray-400">On this page</p>
            <ul className="space-y-0.5">
              {sections.map((sec) => (
                <li key={sec.id}>
                  <button
                    onClick={() => scrollToSection(sec.sectionId)}
                    className={`flex w-full items-center gap-1 rounded px-2 py-1 text-left text-xs transition ${
                      activeTocId === sec.sectionId
                        ? 'bg-primary-50 font-medium text-primary-700'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                    style={{ paddingLeft: `${(sec.level - 1) * 8 + 8}px` }}
                  >
                    <span className="truncate">{sec.title}</span>
                    {(commentCounts.get(sec.sectionId) || 0) > 0 && (
                      <span className="shrink-0 rounded-full bg-amber-100 px-1 text-[9px] font-medium text-amber-600">
                        {commentCounts.get(sec.sectionId)}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </nav>
      )}

      {/* MD content */}
      <div ref={contentRef} className="markdown-body min-w-0 flex-1">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeHighlight, rehypeSanitize]}
          components={headingComponents}
        >
          {content}
        </ReactMarkdown>
      </div>
    </div>
  )
}
