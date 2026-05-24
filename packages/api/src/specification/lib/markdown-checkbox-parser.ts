import { randomUUID } from 'node:crypto';

export interface ParsedSpecItem {
  /** Stable identifier embedded in the markdown as `<!-- spec-item:<uuid> -->`. */
  marker: string;
  /** Visible checkbox label — the `<text>` of `- [ ] <text>` with marker comment stripped. */
  text: string;
  /** `- [x]` vs `- [ ]`. Display-only; the canonical progress is computed from linked issues. */
  checked: boolean;
  /** Position in the document (0-based across all parsed items, fenced code excluded). */
  order: number;
  /** 0-based line index in the source content; used to map to the enclosing SpecSection. */
  lineNumber: number;
}

export interface ParseCheckboxesResult {
  /**
   * Original content with stable marker comments appended to every checkbox line
   * that lacked one (or whose marker collided with an earlier line). Callers MUST
   * persist this back to `Specification.content` so future parses are idempotent.
   */
  markedContent: string;
  items: ParsedSpecItem[];
}

const CHECKBOX_LINE_RE =
  /^(?<indent>\s*)- \[(?<checked> |x|X)\] (?<rest>.*?)\s*$/;
const MARKER_INLINE_RE = /<!-- spec-item:(?<id>[0-9a-f-]{8,})\s*-->/;
const FENCE_RE = /^\s*```/;
const MARKER_TEXT_MAX = 500;

/**
 * Parse `- [ ]` / `- [x]` checkboxes inside markdown into stable SpecItem records.
 *
 * Each checkbox line carries an inline HTML comment marker (`<!-- spec-item:<uuid> -->`)
 * that survives reorderings and text edits. The parser:
 *   1. Skips lines inside fenced code blocks (``` … ```) to avoid false positives
 *      from documentation that quotes checkbox syntax.
 *   2. Reuses an existing marker when present; allocates a new UUID otherwise and
 *      writes it back into the line so the next parse round trips cleanly.
 *   3. Detects duplicate markers (e.g. PM copy-pasted a block) — first occurrence
 *      wins; later collisions get a fresh marker.
 *
 * Returns the rewritten content plus the parsed items in document order.
 */
export function parseCheckboxes(content: string): ParseCheckboxesResult {
  const lines = content.split('\n');
  const outLines: string[] = [];
  const items: ParsedSpecItem[] = [];
  const seenMarkers = new Set<string>();
  let inFence = false;
  let order = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (FENCE_RE.test(line)) {
      inFence = !inFence;
      outLines.push(line);
      continue;
    }
    if (inFence) {
      outLines.push(line);
      continue;
    }

    const match = CHECKBOX_LINE_RE.exec(line);
    if (!match || !match.groups) {
      outLines.push(line);
      continue;
    }

    const { indent, checked, rest } = match.groups;
    const markerMatch = MARKER_INLINE_RE.exec(rest);

    let marker = markerMatch?.groups?.id;
    if (!marker || seenMarkers.has(marker)) {
      marker = randomUUID();
    }
    seenMarkers.add(marker);

    // Strip any existing marker comment from the visible text so we don't double-emit.
    const textPart = rest.replace(MARKER_INLINE_RE, '').trim();
    const text = textPart.slice(0, MARKER_TEXT_MAX);
    const rewritten = `${indent}- [${checked}] ${textPart}${
      textPart ? ' ' : ''
    }<!-- spec-item:${marker} -->`;

    items.push({
      marker,
      text,
      checked: checked.toLowerCase() === 'x',
      order: order++,
      lineNumber: i,
    });
    outLines.push(rewritten);
  }

  return {
    markedContent: outLines.join('\n'),
    items,
  };
}
