import { describe, expect, it } from '@jest/globals';
import { Project, ProjectDomainError } from './project.entity.js';
import { ProjectCreatedEvent } from './events/project-created.event.js';

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
