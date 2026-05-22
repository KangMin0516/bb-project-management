/**
 * Walks an HTML string, wraps every standalone `KEY-N` token (project
 * key 2–8 uppercase chars + dash + 1–6 digits) in an anchor tag with a
 * `data-issue-key` attribute. The anchor's `href` is `#` so it's a
 * valid link with no client-side reload; a global click handler (see
 * `useIssueKeyLinkHandler`) intercepts the click, resolves the key
 * to a UUID via `/api/issues/resolve`, and navigates via React Router.
 *
 * Skips text inside `<a>` (already linked), `<code>`, and `<pre>` so we
 * don't turn code samples into clickable links — common cause of false
 * positives in technical specs.
 *
 * Runs in the browser only (uses `DOMParser`). Returns the input string
 * unchanged in server / unknown environments.
 */
const KEY_PATTERN = /\b[A-Z]{2,8}-\d{1,6}\b/g
const SKIP_TAGS = new Set(['A', 'CODE', 'PRE', 'SCRIPT', 'STYLE'])

export function linkifyIssueKeys(html: string): string {
  if (typeof window === 'undefined' || typeof DOMParser === 'undefined') {
    return html
  }
  if (!html || !KEY_PATTERN.test(html)) {
    // Reset lastIndex side-effect from the test() call above (sticky regex).
    KEY_PATTERN.lastIndex = 0
    return html
  }
  KEY_PATTERN.lastIndex = 0

  const doc = new DOMParser().parseFromString(html, 'text/html')
  walk(doc.body, doc)
  return doc.body.innerHTML
}

function walk(node: Node, doc: Document): void {
  if (node.nodeType === Node.TEXT_NODE) {
    linkifyTextNode(node as Text, doc)
    return
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return
  const el = node as Element
  if (SKIP_TAGS.has(el.tagName)) return
  // Snapshot children — wrapping mutates the live NodeList.
  Array.from(el.childNodes).forEach((child) => walk(child, doc))
}

function linkifyTextNode(textNode: Text, doc: Document): void {
  const text = textNode.textContent
  if (!text) return
  KEY_PATTERN.lastIndex = 0
  if (!KEY_PATTERN.test(text)) return
  KEY_PATTERN.lastIndex = 0

  const fragment = doc.createDocumentFragment()
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = KEY_PATTERN.exec(text)) !== null) {
    const start = match.index
    const end = start + match[0].length
    if (start > lastIndex) {
      fragment.appendChild(doc.createTextNode(text.slice(lastIndex, start)))
    }
    const a = doc.createElement('a')
    a.setAttribute('href', '#')
    a.setAttribute('data-issue-key', match[0])
    a.className = 'issue-key-link'
    a.textContent = match[0]
    fragment.appendChild(a)
    lastIndex = end
  }
  if (lastIndex < text.length) {
    fragment.appendChild(doc.createTextNode(text.slice(lastIndex)))
  }
  textNode.parentNode?.replaceChild(fragment, textNode)
}
