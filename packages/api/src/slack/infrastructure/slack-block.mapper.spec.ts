import { toSlackBlocks } from './slack-block.mapper.js';

describe('toSlackBlocks', () => {
  it('translates a header block', () => {
    expect(toSlackBlocks([{ type: 'header', text: 'Hello' }])).toEqual([
      { type: 'header', text: { type: 'plain_text', text: 'Hello' } },
    ]);
  });

  it('translates a section as mrkdwn', () => {
    expect(toSlackBlocks([{ type: 'section', text: '*Hi* <@U1>' }])).toEqual([
      { type: 'section', text: { type: 'mrkdwn', text: '*Hi* <@U1>' } },
    ]);
  });

  it('translates a fields block to a 2-column section', () => {
    expect(
      toSlackBlocks([
        { type: 'fields', fields: ['*Name*\nAlice', '*Role*\nAdmin'] },
      ]),
    ).toEqual([
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: '*Name*\nAlice' },
          { type: 'mrkdwn', text: '*Role*\nAdmin' },
        ],
      },
    ]);
  });

  it('translates a divider', () => {
    expect(toSlackBlocks([{ type: 'divider' }])).toEqual([{ type: 'divider' }]);
  });

  it('translates a button_link with style into an actions block', () => {
    expect(
      toSlackBlocks([
        {
          type: 'button_link',
          text: 'Open issue',
          url: 'https://example.com/p',
          style: 'primary',
        },
      ]),
    ).toEqual([
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: { type: 'plain_text', text: 'Open issue' },
            url: 'https://example.com/p',
            style: 'primary',
          },
        ],
      },
    ]);
  });

  it('omits style on button_link when not provided', () => {
    const out = toSlackBlocks([
      { type: 'button_link', text: 'Open', url: 'https://x' },
    ]) as Array<{ elements: Array<{ style?: string }> }>;
    expect(out[0].elements[0]).not.toHaveProperty('style');
  });

  it('translates a context block', () => {
    expect(toSlackBlocks([{ type: 'context', text: 'small note' }])).toEqual([
      {
        type: 'context',
        elements: [{ type: 'mrkdwn', text: 'small note' }],
      },
    ]);
  });

  it('translates a multi-block message in order', () => {
    const blocks = toSlackBlocks([
      { type: 'header', text: 'Title' },
      { type: 'divider' },
      { type: 'section', text: 'Body' },
    ]);
    expect(blocks).toHaveLength(3);
    expect((blocks[0] as { type: string }).type).toBe('header');
    expect((blocks[1] as { type: string }).type).toBe('divider');
    expect((blocks[2] as { type: string }).type).toBe('section');
  });
});
