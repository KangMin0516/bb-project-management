import {
  IsArray,
  IsObject,
  IsOptional,
  IsString,
  IsEnum,
  MaxLength,
} from 'class-validator';
import { IssueType } from '../../../generated/prisma/enums.js';

/**
 * Single-shot upsert payload. The issueType is part of the body (rather
 * than the URL) so the same endpoint accepts new and existing rules
 * uniformly — the unique constraint on `issueType` makes this a true
 * upsert.
 */
export class UpsertIssueRuleDto {
  @IsEnum(IssueType)
  issueType!: IssueType;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  titlePattern?: string | null;

  @IsOptional()
  @IsString()
  descriptionTemplate?: string | null;

  /** Camel-case Issue keys: e.g. ['priority', 'assigneeId', 'dueDate']. */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  requiredFields?: string[];

  /** `{ priority: 'MEDIUM', status: 'TODO' }`. Only literal scalars. */
  @IsOptional()
  @IsObject()
  defaultValues?: Record<string, unknown>;

  /**
   * Label NAMES (not IDs). Per-project label rows are created on
   * demand at issue-create time, so the same rule applies cleanly
   * across projects with different label catalogs.
   */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  enforcedLabelNames?: string[];
}
