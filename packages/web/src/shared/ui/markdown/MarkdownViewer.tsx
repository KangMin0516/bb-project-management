import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeSanitize from 'rehype-sanitize'
import rehypeHighlight from 'rehype-highlight'
import DOMPurify from 'dompurify'
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
    const sanitized = DOMPurify.sanitize(content, {
      ADD_TAGS: ['img'],
      ADD_ATTR: ['target', 'rel', 'src', 'alt', 'href'],
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
