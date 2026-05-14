/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { describe, expect, it, jest } from '@jest/globals';
import { OutboxHandlerRegistry } from './outbox-handler.registry.js';
import type { ClaimedOutboxRow } from './outbox.repository.js';

const row = (eventType: string): ClaimedOutboxRow => ({
  id: 'r1',
  eventType,
  aggregateType: 'X',
  aggregateId: 'a1',
  payload: {},
  attempts: 0,
  occurredAt: new Date(),
});

describe('OutboxHandlerRegistry', () => {
  it('returns the registered handler', async () => {
    const registry = new OutboxHandlerRegistry();
    const handler = jest.fn(() => Promise.resolve());
    registry.register('Foo', handler);

    const got = registry.get('Foo');
    expect(got).toBe(handler);
    await got?.(row('Foo'));
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('returns undefined for unknown types', () => {
    const registry = new OutboxHandlerRegistry();
    expect(registry.get('Unknown')).toBeUndefined();
  });

  it('overwrites on re-register (last writer wins)', () => {
    const registry = new OutboxHandlerRegistry();
    const a = jest.fn(() => Promise.resolve());
    const b = jest.fn(() => Promise.resolve());
    registry.register('Foo', a);
    registry.register('Foo', b);
    expect(registry.get('Foo')).toBe(b);
  });

  it('reports known types', () => {
    const registry = new OutboxHandlerRegistry();
    registry.register('A', () => Promise.resolve());
    registry.register('B', () => Promise.resolve());
    expect(registry.knownEventTypes().sort()).toEqual(['A', 'B']);
  });
});
