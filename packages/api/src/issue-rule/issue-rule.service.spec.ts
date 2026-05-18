import { describe, expect, it } from '@jest/globals';
import { IssueRuleService, type ResolvedIssueRule } from './issue-rule.service.js';
import { IssueType } from '../../generated/prisma/enums.js';

const mkRule = (overrides: Partial<ResolvedIssueRule> = {}): ResolvedIssueRule => ({
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
    expect(warnings).toEqual([
      expect.stringContaining('Title doesn'),
    ]);
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
