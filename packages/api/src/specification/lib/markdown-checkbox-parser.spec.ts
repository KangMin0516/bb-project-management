import { describe, expect, it } from '@jest/globals';
import { parseCheckboxes } from './markdown-checkbox-parser.js';

const UUID_RE = /[0-9a-f-]{36}/i;

describe('parseCheckboxes', () => {
  it('extracts a single unchecked item and writes back a marker', () => {
    const { items, markedContent } = parseCheckboxes('- [ ] login flow');
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ text: 'login flow', checked: false, order: 0, lineNumber: 0 });
    expect(items[0].marker).toMatch(UUID_RE);
    expect(markedContent).toMatch(/- \[ \] login flow <!-- spec-item:[0-9a-f-]+ -->/);
  });

  it('recognises a checked item via `[x]` and `[X]`', () => {
    const { items } = parseCheckboxes('- [x] one\n- [X] two');
    expect(items.map((i) => i.checked)).toEqual([true, true]);
  });

  it('preserves an existing marker on re-parse', () => {
    const seed = '- [ ] persist me <!-- spec-item:00000000-0000-0000-0000-000000000abc -->';
    const { items, markedContent } = parseCheckboxes(seed);
    expect(items).toHaveLength(1);
    expect(items[0].marker).toBe('00000000-0000-0000-0000-000000000abc');
    expect(items[0].text).toBe('persist me');
    // Round-trip is idempotent: parsing the marked output yields the same marker.
    expect(parseCheckboxes(markedContent).items[0].marker).toBe('00000000-0000-0000-0000-000000000abc');
  });

  it('ignores checkbox syntax inside a fenced code block', () => {
    const content = '## Example\n\n```md\n- [ ] not a real item\n```\n\n- [ ] real item';
    const { items } = parseCheckboxes(content);
    expect(items.map((i) => i.text)).toEqual(['real item']);
  });

  it('handles indented checkbox lines (nested lists)', () => {
    const { items } = parseCheckboxes('- parent\n  - [ ] child A\n    - [ ] grandchild');
    expect(items.map((i) => i.text)).toEqual(['child A', 'grandchild']);
  });

  it('ignores lines that are not checkboxes', () => {
    const { items } = parseCheckboxes('# heading\n\njust prose\n- bare bullet\n- [ ] only this');
    expect(items).toHaveLength(1);
    expect(items[0].text).toBe('only this');
  });

  it('assigns a fresh marker on duplicate id', () => {
    const dup =
      '- [ ] first <!-- spec-item:aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa -->\n- [ ] second <!-- spec-item:aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa -->';
    const { items } = parseCheckboxes(dup);
    expect(items).toHaveLength(2);
    expect(items[0].marker).toBe('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
    expect(items[1].marker).not.toBe('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
    expect(items[1].marker).toMatch(UUID_RE);
  });

  it('returns an empty result for empty input', () => {
    expect(parseCheckboxes('')).toEqual({ markedContent: '', items: [] });
  });

  it('truncates very long text to 500 chars to fit DB column', () => {
    const long = `- [ ] ${'a'.repeat(600)}`;
    const { items } = parseCheckboxes(long);
    expect(items[0].text).toHaveLength(500);
  });

  it('assigns sequential order across multiple lines', () => {
    const { items } = parseCheckboxes('- [ ] a\nintro\n- [ ] b\n- [x] c');
    expect(items.map((i) => i.order)).toEqual([0, 1, 2]);
    expect(items.map((i) => i.lineNumber)).toEqual([0, 2, 3]);
  });

  it('keeps non-checkbox lines untouched in markedContent', () => {
    const src = '# Title\n\n- [ ] item\nplain line';
    const { markedContent } = parseCheckboxes(src);
    const lines = markedContent.split('\n');
    expect(lines[0]).toBe('# Title');
    expect(lines[1]).toBe('');
    expect(lines[2]).toMatch(/^- \[ \] item <!-- spec-item:[0-9a-f-]+ -->$/);
    expect(lines[3]).toBe('plain line');
  });

  it('marker survives content edits to the same line', () => {
    const seed = '- [ ] old text <!-- spec-item:11111111-1111-1111-1111-111111111111 -->';
    const round1 = parseCheckboxes(seed).markedContent;
    // Simulate a PM rewording the line but keeping the marker comment
    const edited = round1.replace('old text', 'new wording');
    const { items } = parseCheckboxes(edited);
    expect(items[0].marker).toBe('11111111-1111-1111-1111-111111111111');
    expect(items[0].text).toBe('new wording');
  });
});
