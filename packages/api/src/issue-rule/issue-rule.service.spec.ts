import { describe, expect, it, jest } from '@jest/globals';
import {
  IssueRuleService,
  type ResolvedIssueRule,
} from './issue-rule.service.js';
import { IssueType } from '../../generated/prisma/enums.js';

const mkRule = (
  overrides: Partial<ResolvedIssueRule> = {},
): ResolvedIssueRule => ({
  issueType: IssueType.BUG,
  titlePattern: null,
  descriptionTemplate: null,
  requiredFields: [],
  defaultValues: {},
  enforcedLabelNames: [],
  ...overrides,
});

const svc = () => new IssueRuleService({} as never);

describe('IssueRuleService.applyDefaultsAndValidate', () => {
  it('passes through when no rule configured', () => {
    const { merged, warnings } = svc().applyDefaultsAndValidate(null, {
      title: 'x',
    });
    expect(merged).toEqual({ title: 'x' });
    expect(warnings).toEqual([]);
  });

  it('merges default_values for missing fields only', () => {
    const rule = mkRule({
      defaultValues: { priority: 'MEDIUM', status: 'TODO' },
    });
    const { merged } = svc().applyDefaultsAndValidate(rule, {
      title: 'x',
      priority: 'HIGH', // explicit — should NOT be overridden
    });
    expect(merged.priority).toBe('HIGH');
    expect(merged.status).toBe('TODO'); // filled by default
  });

  it('warns on missing required fields after defaults', () => {
    const rule = mkRule({
      requiredFields: ['priority', 'assigneeId', 'description'],
      defaultValues: { priority: 'MEDIUM' }, // priority gets filled
    });
    const { warnings } = svc().applyDefaultsAndValidate(rule, {
      title: 'x',
    });
    // priority filled by default; assigneeId + description still missing
    expect(warnings).toEqual([
      expect.stringContaining("'assigneeId'"),
      expect.stringContaining("'description'"),
    ]);
  });

  it('warns when title does not match the /regex/ pattern', () => {
    const rule = mkRule({ titlePattern: '/^\\[BUG\\]/' });
    const { warnings } = svc().applyDefaultsAndValidate(rule, {
      title: 'No prefix',
    });
    expect(warnings).toEqual([expect.stringContaining('Title doesn')]);
  });

  it('accepts title that matches the /regex/ pattern', () => {
    const rule = mkRule({ titlePattern: '/^\\[BUG\\]/' });
    const { warnings } = svc().applyDefaultsAndValidate(rule, {
      title: '[BUG] login null pointer',
    });
    expect(warnings).toEqual([]);
  });

  it('treats non-/regex/ titlePattern as a hint (no warning)', () => {
    const rule = mkRule({ titlePattern: '[BUG] {short_desc}' });
    const { warnings } = svc().applyDefaultsAndValidate(rule, {
      title: 'doesn’t match anyway',
    });
    expect(warnings).toEqual([]);
  });

  it('treats empty-string field as missing for required_fields', () => {
    const rule = mkRule({ requiredFields: ['description'] });
    const { warnings } = svc().applyDefaultsAndValidate(rule, {
      title: 'x',
      description: '',
    });
    expect(warnings).toHaveLength(1);
  });
});

describe('IssueRuleService.resolveEnforcedLabels', () => {
  it('returns [] when rule is null', async () => {
    const ids = await svc().resolveEnforcedLabels(null, 'p1');
    expect(ids).toEqual([]);
  });

  it('reuses an existing label even when case differs (no duplicate)', async () => {
    // Project already has "Bug" (capitalised). Rule says "bug".
    // The lookup must find the existing row instead of creating a
    // second one.
    const findMany = jest.fn(async () => [
      { id: 'lbl-bug-existing', name: 'Bug' },
    ]);
    const create = jest.fn();
    const prisma = {
      label: { findMany, create },
    };
    const service = new IssueRuleService(prisma as never);
    const rule = mkRule({ enforcedLabelNames: ['bug'] });
    const ids = await service.resolveEnforcedLabels(rule, 'p1');
    expect(ids).toEqual(['lbl-bug-existing']);
    expect(create).not.toHaveBeenCalled();
  });

  it('trims whitespace before matching', async () => {
    const findMany = jest.fn(async () => [
      { id: 'lbl-existing', name: 'needs-triage' },
    ]);
    const create = jest.fn();
    const prisma = { label: { findMany, create } };
    const service = new IssueRuleService(prisma as never);
    const rule = mkRule({ enforcedLabelNames: ['  needs-triage  '] });
    const ids = await service.resolveEnforcedLabels(rule, 'p1');
    expect(ids).toEqual(['lbl-existing']);
    expect(create).not.toHaveBeenCalled();
  });

  it('creates a new label when no row matches case-insensitively', async () => {
    const findMany = jest.fn(async () => []);
    const create = jest.fn(async () => ({ id: 'lbl-new' }));
    const prisma = { label: { findMany, create } };
    const service = new IssueRuleService(prisma as never);
    const rule = mkRule({ enforcedLabelNames: ['fresh-label'] });
    const ids = await service.resolveEnforcedLabels(rule, 'p1');
    expect(ids).toEqual(['lbl-new']);
    expect(create).toHaveBeenCalledTimes(1);
  });
});
