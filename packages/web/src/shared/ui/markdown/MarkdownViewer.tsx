import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeSanitize from 'rehype-sanitize'
import rehypeHighlight from 'rehype-highlight'
import DOMPurify from 'dompurify'
import { linkifyIssueKeys } from '@/shared/lib/linkifyIssueKeys'
import './markdown.css'

interface MarkdownViewerProps {
  content: string
  className?: string
}

const REMARK_PLUGINS = [remarkGfm]
const REHYPE_PLUGINS = [rehypeHighlight, rehypeSanitize]

/** Detect if content is HTML (contains common HTML tags) */
function isHtmlContent(content: string): boolean {
  const trimmed = content.trim()
  if (trimmed.startsWith('<')) return true
  // Check for common HTML tags
  return /<(p|h[1-6]|div|span|ul|ol|li|table|img|a|strong|em|blockquote|pre|code)\b/i.test(trimmed)
}

export default function MarkdownViewer({ content, className = '' }: MarkdownViewerProps) {
  if (isHtmlContent(content)) {
    // Auto-link `PM-123` patterns BEFORE sanitization so DOMPurify keeps
    // the new anchors. The pass skips text inside <code>/<pre>/<a>, so
    // code samples are not touched (PM-77).
    const withLinks = linkifyIssueKeys(content)
    const sanitized = DOMPurify.sanitize(withLinks, {
      ADD_TAGS: ['img'],
      ADD_ATTR: ['target', 'rel', 'src', 'alt', 'href', 'data-issue-key', 'class'],
    })
    return (
      <div
        className={`markdown-body ${className}`}
        dangerouslySetInnerHTML={{ __html: sanitized }}
      />
    )
  }

  return (
    <div className={`markdown-body ${className}`}>
      <ReactMarkdown
        remarkPlugins={REMARK_PLUGINS}
        rehypePlugins={REHYPE_PLUGINS}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
