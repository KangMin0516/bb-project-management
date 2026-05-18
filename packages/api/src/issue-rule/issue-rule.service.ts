import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { IssueType } from '../../generated/prisma/enums.js';
import type { UpsertIssueRuleDto } from './dto/upsert-rule.dto.js';

/**
 * Shape returned to MCP `get_create_rules` — flattened so an LLM can
 * read the rules without traversing nested join rows.
 */
export interface ResolvedIssueRule {
  issueType: IssueType;
  titlePattern: string | null;
  descriptionTemplate: string | null;
  requiredFields: string[];
  defaultValues: Record<string, unknown>;
  enforcedLabelNames: string[];
}

@Injectable()
export class IssueRuleService {
  constructor(private prisma: PrismaService) {}

  /**
   * Find the global rule for `issueType`. Returns `null` when no rule
   * has been configured — callers treat that as "no rules, accept
   * anything".
   */
  async resolve(issueType: IssueType): Promise<ResolvedIssueRule | null> {
    const rule = await this.prisma.issueRule.findUnique({
      where: { issueType },
    });
    if (!rule) return null;

    return {
      issueType: rule.issueType,
      titlePattern: rule.titlePattern,
      descriptionTemplate: rule.descriptionTemplate,
      requiredFields: rule.requiredFields as string[],
      defaultValues: rule.defaultValues as Record<string, unknown>,
      enforcedLabelNames: rule.enforcedLabelNames,
    };
  }

  /** Lists every configured rule — used by admin UI. */
  async listAll() {
    return this.prisma.issueRule.findMany({
      orderBy: { issueType: 'asc' },
    });
  }

  async upsert(dto: UpsertIssueRuleDto) {
    return this.prisma.issueRule.upsert({
      where: { issueType: dto.issueType },
      create: {
        issueType: dto.issueType,
        titlePattern: dto.titlePattern ?? null,
        descriptionTemplate: dto.descriptionTemplate ?? null,
        requiredFields: dto.requiredFields ?? [],
        defaultValues: (dto.defaultValues as object | undefined) ?? {},
        enforcedLabelNames: dto.enforcedLabelNames ?? [],
      },
      update: {
        titlePattern: dto.titlePattern ?? null,
        descriptionTemplate: dto.descriptionTemplate ?? null,
        ...(dto.requiredFields !== undefined && {
          requiredFields: dto.requiredFields,
        }),
        ...(dto.defaultValues !== undefined && {
          defaultValues: dto.defaultValues as object,
        }),
        ...(dto.enforcedLabelNames !== undefined && {
          enforcedLabelNames: dto.enforcedLabelNames,
        }),
      },
    });
  }

  async remove(issueType: IssueType) {
    return this.prisma.issueRule.deleteMany({ where: { issueType } });
  }

  /**
   * Apply defaults + collect warnings for an incoming create payload.
   * Mutates a copy of the input and returns both the merged payload
   * and the warnings list — callers (ExternalService.createIssue)
   * decide what to do with each.
   *
   * Warnings are *advisory*, never thrown: a missing required field
   * doesn't block creation, the LLM gets the warning back and can
   * call `update_issue` to patch.
   */
  applyDefaultsAndValidate(
    rule: ResolvedIssueRule | null,
    incoming: Record<string, unknown>,
  ): { merged: Record<string, unknown>; warnings: string[] } {
    if (!rule) return { merged: incoming, warnings: [] };

    const merged: Record<string, unknown> = { ...incoming };
    const warnings: string[] = [];

    // Apply default_values for missing fields.
    for (const [field, value] of Object.entries(rule.defaultValues)) {
      if (
        merged[field] === undefined ||
        merged[field] === null ||
        merged[field] === ''
      ) {
        merged[field] = value;
      }
    }

    // Validate required_fields — soft. Lists fields we ended up
    // missing after defaults were merged.
    for (const field of rule.requiredFields) {
      const v = merged[field];
      if (v === undefined || v === null || v === '') {
        warnings.push(
          `Required field '${field}' is missing for ${rule.issueType} issues.`,
        );
      }
    }

    // Validate title_pattern — regex form supported as `/pattern/`,
    // anything else is treated as a hint string surfaced via
    // get_create_rules.
    const title = merged.title;
    if (typeof title === 'string' && rule.titlePattern) {
      const pattern = rule.titlePattern;
      if (
        pattern.startsWith('/') &&
        pattern.endsWith('/') &&
        pattern.length >= 2
      ) {
        try {
          const re = new RegExp(pattern.slice(1, -1));
          if (!re.test(title)) {
            warnings.push(`Title doesn't match expected pattern: ${pattern}`);
          }
        } catch {
          // Bad regex → skip silently.
        }
      }
    }

    return { merged, warnings };
  }

  /**
   * Resolve enforced label names to per-project label IDs. Labels
   * missing in the target project are created on the fly with a
   * neutral default color so the rule "just works" regardless of
   * which project the LLM creates in.
   */
  async resolveEnforcedLabels(
    rule: ResolvedIssueRule | null,
    projectId: string,
  ): Promise<string[]> {
    if (!rule || rule.enforcedLabelNames.length === 0) return [];

    const existing = await this.prisma.label.findMany({
      where: {
        projectId,
        name: { in: rule.enforcedLabelNames },
      },
      select: { id: true, name: true },
    });
    const existingByName = new Map(existing.map((l) => [l.name, l.id]));

    const missing = rule.enforcedLabelNames.filter(
      (name) => !existingByName.has(name),
    );
    if (missing.length > 0) {
      // Create one-by-one (small N — usually 0-3 labels per rule) so
      // each row picks up its own UUID and createdAt. Could be a
      // createMany() with skipDuplicates if we add a (projectId, name)
      // unique constraint later.
      for (const name of missing) {
        const created = await this.prisma.label.create({
          data: { projectId, name, color: '#9CA3AF' },
        });
        existingByName.set(name, created.id);
      }
    }

    return rule.enforcedLabelNames
      .map((name) => existingByName.get(name))
      .filter((id): id is string => Boolean(id));
  }
}
