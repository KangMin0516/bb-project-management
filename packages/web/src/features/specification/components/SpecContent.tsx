import { type JSX, useMemo, useEffect, useRef, useCallback, useState, useImperativeHandle, forwardRef } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeSanitize from 'rehype-sanitize'
import rehypeHighlight from 'rehype-highlight'
import type { SpecSection, SpecComment, SpecIssueLink } from '@/features/specification/api'
import { MessageSquare, Plus, ExternalLink, X } from 'lucide-react'
import { STATUS_COLORS, STATUS_LABELS, PRIORITY_COLORS } from '@/shared/config/constants'
import { cn } from '@/shared/lib/utils'
import '@/shared/ui/markdown/markdown.css'

export interface SpecContentHandle {
  scrollToSection: (sectionId: string) => void
}

interface SpecContentProps {
  content: string
  sections: SpecSection[]
  comments: SpecComment[]
  issueLinks?: SpecIssueLink[]
  onSectionClick: (sectionId: string) => void
  onIssueClick?: (issueId: string) => void
  onCreateIssue?: (sectionSlug: string) => void
}

function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9가-힣\s-]/g, '')
    .replace(/\s+/g, '-')
    .slice(0, 100)
}

const SpecContent = forwardRef<SpecContentHandle, SpecContentProps>(function SpecContent({ content, sections, comments, issueLinks, onSectionClick, onIssueClick, onCreateIssue }, ref) {
  const contentRef = useRef<HTMLDivElement>(null)
  const [activeTocId, setActiveTocId] = useState<string | null>(null)
  const [popoverIssue, setPopoverIssue] = useState<SpecIssueLink | null>(null)
  const [popoverPos, setPopoverPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 })
  const popoverIssueRef = useRef(popoverIssue)
  popoverIssueRef.current = popoverIssue

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

  useImperativeHandle(ref, () => ({ scrollToSection }), [scrollToSection])

  // Group issue links by sectionSlug
  const issueLinksBySection = useMemo(() => {
    const map = new Map<string, SpecIssueLink[]>()
    if (issueLinks) {
      for (const link of issueLinks) {
        const slug = link.sectionSlug || ''
        const list = map.get(slug) || []
        list.push(link)
        map.set(slug, list)
      }
    }
    return map
  }, [issueLinks])

  // Custom heading components that add IDs and comment badges
  const headingComponents = useMemo(() => {
    const createHeading = (level: number) => {
      const Tag = `h${level}` as keyof JSX.IntrinsicElements
      return function HeadingWithBadge({ children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
        const text = typeof children === 'string' ? children : String(children)
        const id = slugify(text)
        const count = commentCounts.get(id) || 0
        const sectionIssues = issueLinksBySection.get(id) || []
        return (
          // @ts-expect-error dynamic tag
          <Tag id={id} {...props} className="group relative flex items-center gap-1.5 flex-wrap">
            <span>{children}</span>
            <button
              onClick={(e) => { e.preventDefault(); onSectionClick(id) }}
              className={cn(
                'inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-medium transition hover:bg-gray-100 dark:hover:bg-gray-700',
                count > 0 ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
              )}
            >
              <MessageSquare className="h-3 w-3 text-gray-400 dark:text-gray-500" />
              {count > 0 && <span className="text-amber-600">{count}</span>}
            </button>
            {onCreateIssue && (
              <button
                onClick={(e) => { e.preventDefault(); onCreateIssue(id) }}
                className="inline-flex items-center gap-0.5 rounded-full px-1 py-0.5 text-[10px] font-medium opacity-0 transition group-hover:opacity-100 hover:bg-blue-50 hover:text-blue-600"
                title="Create issue for this section"
              >
                <Plus className="h-3 w-3 text-gray-400 dark:text-gray-500" />
              </button>
            )}
            {sectionIssues.length > 0 && (
              <span className="inline-flex items-center gap-1">
                {sectionIssues.map((link) => (
                  <button
                    key={link.id}
                    onClick={(e) => {
                      e.preventDefault()
                      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                      setPopoverPos({ top: rect.bottom + 4, left: rect.left })
                      setPopoverIssue((prev) => prev?.id === link.id ? null : link)
                    }}
                    className={cn(
                      'inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-medium transition',
                      popoverIssueRef.current?.id === link.id
                        ? 'bg-blue-200 text-blue-800'
                        : 'bg-blue-50 text-blue-700 hover:bg-blue-100',
                    )}
                    title={`#${link.issue.number} ${link.issue.title}`}
                  >
                    <span className={cn('h-1.5 w-1.5 rounded-full', STATUS_COLORS[link.issue.status])} />
                    #{link.issue.number}
                  </button>
                ))}
              </span>
            )}
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
  }, [commentCounts, issueLinksBySection, onSectionClick, onIssueClick, onCreateIssue])

  return (
    <div className="flex gap-6">
      {/* Issue popover */}
      {popoverIssue && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setPopoverIssue(null)} />
          <div
            className="fixed z-50 w-72 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3 shadow-lg dark:shadow-gray-900/50"
            style={{ top: Math.min(popoverPos.top, window.innerHeight - 120), left: Math.min(popoverPos.left, window.innerWidth - 288) }}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className={cn('h-2 w-2 rounded-full shrink-0', STATUS_COLORS[popoverIssue.issue.status])} />
                  <span className="text-[10px] text-gray-500 dark:text-gray-400">{STATUS_LABELS[popoverIssue.issue.status] || popoverIssue.issue.status}</span>
                  <span className={cn('rounded px-1 py-0.5 text-[9px] font-medium', PRIORITY_COLORS[popoverIssue.issue.priority])}>
                    {popoverIssue.issue.priority}
                  </span>
                </div>
                <p className="mt-1 text-sm font-medium text-gray-900 dark:text-gray-100">#{popoverIssue.issue.number} {popoverIssue.issue.title}</p>
              </div>
              <button onClick={() => setPopoverIssue(null)} className="shrink-0 rounded p-0.5 text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <button
              onClick={() => { onIssueClick?.(popoverIssue.issue.id); setPopoverIssue(null) }}
              className="mt-2 flex w-full items-center justify-center gap-1 rounded-md bg-gray-50 dark:bg-gray-900 px-2 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition"
            >
              <ExternalLink className="h-3 w-3" />
              Go to issue
            </button>
          </div>
        </>
      )}
      {/* TOC sidebar */}
      {sections.length > 0 && (
        <nav className="sticky top-0 hidden w-48 shrink-0 self-start lg:block">
          <div className="max-h-[calc(100vh-10rem)] overflow-y-auto py-4">
            <p className="mb-2 text-xs font-medium uppercase text-gray-400 dark:text-gray-500">On this page</p>
            <ul className="space-y-0.5">
              {sections.map((sec) => (
                <li key={sec.id}>
                  <button
                    onClick={() => scrollToSection(sec.sectionId)}
                    className={`flex w-full items-center gap-1 rounded px-2 py-1 text-left text-xs transition ${
                      activeTocId === sec.sectionId
                        ? 'bg-primary-50 font-medium text-primary-700'
                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:text-gray-300'
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
})

export default SpecContent
