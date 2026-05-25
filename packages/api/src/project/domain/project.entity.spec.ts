import { describe, expect, it } from '@jest/globals';
import { Project, ProjectDomainError } from './project.entity.js';
import { ProjectArchivedEvent } from './events/project-archived.event.js';
import { ProjectCreatedEvent } from './events/project-created.event.js';
import { ProjectUnarchivedEvent } from './events/project-unarchived.event.js';

const base = {
  id: 'p-1',
  name: 'Alpha',
  key: 'ALP',
  creatorId: 'u-1',
};

describe('Project.create — key validation', () => {
  it('accepts a valid key', () => {
    const p = Project.create(base);
    expect(p.key).toBe('ALP');
  });

  it('rejects empty key', () => {
    expect(() => Project.create({ ...base, key: '' })).toThrow(
      ProjectDomainError,
    );
  });

  it('rejects key starting with digit', () => {
    expect(() => Project.create({ ...base, key: '1AB' })).toThrow(
      ProjectDomainError,
    );
  });

  it('rejects key with lowercase', () => {
    expect(() => Project.create({ ...base, key: 'abc' })).toThrow(
      ProjectDomainError,
    );
  });

  it('rejects key longer than 16 chars', () => {
    expect(() => Project.create({ ...base, key: 'A'.repeat(17) })).toThrow(
      ProjectDomainError,
    );
  });

  it('accepts key with digits + underscore after first letter', () => {
    const p = Project.create({ ...base, key: 'A1_B' });
    expect(p.key).toBe('A1_B');
  });
});

describe('Project.create — other invariants', () => {
  it('rejects empty name', () => {
    expect(() => Project.create({ ...base, name: '   ' })).toThrow(
      ProjectDomainError,
    );
  });

  it('trims name + description', () => {
    const p = Project.create({
      ...base,
      name: '  Alpha  ',
      description: '  desc  ',
    });
    expect(p.name).toBe('Alpha');
    expect(p.description).toBe('desc');
  });

  it('emits ProjectCreatedEvent', () => {
    const p = Project.create(base);
    const events = p.pullEvents();
    expect(events).toHaveLength(1);
    expect(events[0]).toBeInstanceOf(ProjectCreatedEvent);
  });
});

describe('Project.update', () => {
  it('updates name and description', () => {
    const p = Project.create(base);
    p.update({ name: 'Alpha v2', description: 'new desc' });
    expect(p.name).toBe('Alpha v2');
    expect(p.description).toBe('new desc');
  });

  it('treats undefined as no-change but explicit null clears description', () => {
    const p = Project.create({ ...base, description: 'old' });
    p.update({ name: undefined, description: null });
    expect(p.name).toBe('Alpha');
    expect(p.description).toBeNull();
  });

  it('rejects empty name on update', () => {
    const p = Project.create(base);
    expect(() => p.update({ name: '  ' })).toThrow(ProjectDomainError);
  });
});

describe('Project.archive / unarchive', () => {
  it('flips archived state + records the actor and emits an event', () => {
    const p = Project.create(base);
    p.pullEvents(); // drain ProjectCreated
    expect(p.isArchived).toBe(false);

    p.archive('u-9');

    expect(p.isArchived).toBe(true);
    expect(p.archivedById).toBe('u-9');
    expect(p.archivedAt).toBeInstanceOf(Date);
    const events = p.pullEvents();
    expect(events).toHaveLength(1);
    expect(events[0]).toBeInstanceOf(ProjectArchivedEvent);
  });

  it('rejects archive when already archived', () => {
    const p = Project.create(base);
    p.archive('u-1');
    expect(() => p.archive('u-2')).toThrow(ProjectDomainError);
  });

  it('rejects unarchive when not archived', () => {
    const p = Project.create(base);
    expect(() => p.unarchive('u-1')).toThrow(ProjectDomainError);
  });

  it('unarchive clears the actor and emits ProjectUnarchivedEvent', () => {
    const p = Project.create(base);
    p.archive('u-1');
    p.pullEvents();

    p.unarchive('u-9');

    expect(p.isArchived).toBe(false);
    expect(p.archivedById).toBeNull();
    expect(p.archivedAt).toBeNull();
    const events = p.pullEvents();
    expect(events).toHaveLength(1);
    expect(events[0]).toBeInstanceOf(ProjectUnarchivedEvent);
  });

  it('archive bumps updatedAt', () => {
    const start = new Date('2026-01-01T00:00:00Z');
    const p = Project.create(base, start);
    p.archive('u-1', new Date('2026-02-01T00:00:00Z'));
    expect(p.updatedAt.toISOString()).toBe('2026-02-01T00:00:00.000Z');
  });
});
