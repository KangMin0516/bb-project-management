/**
 * Strip HTML tags + decode the few entities the TipTap-stored content can
 * contain, producing a plain-text snippet suitable for Slack DMs / push
 * notifications. Comments and issue descriptions both round-trip through
 * DOMPurify-sanitized HTML, so the same routine works for both.
 */
export function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}
