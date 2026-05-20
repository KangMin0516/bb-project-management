import {
  IsOptional,
  IsEnum,
  IsUUID,
  IsString,
  IsInt,
  IsIn,
  IsBoolean,
  IsISO8601,
  Min,
  Max,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IssueStatus,
  IssuePriority,
  IssueType,
} from '../../../generated/prisma/enums.js';
import type { SourceLiteral } from '../../common/source.js';
import { Type, Transform } from 'class-transformer';

const ISSUE_SOURCES: SourceLiteral[] = [
  'WEB',
  'MCP',
  'SLACK',
  'WEBHOOK',
  'API',
  'SYSTEM',
];

export class QueryIssueDto {
  @ApiPropertyOptional({ enum: IssueStatus })
  @IsOptional()
  @IsEnum(IssueStatus)
  status?: IssueStatus;

  @ApiPropertyOptional({ enum: IssuePriority })
  @IsOptional()
  @IsEnum(IssuePriority)
  priority?: IssuePriority;

  @ApiPropertyOptional({ enum: IssueType })
  @IsOptional()
  @IsEnum(IssueType)
  type?: IssueType;

  @ApiPropertyOptional({
    enum: ISSUE_SOURCES,
    description: 'Origin of the row (WEB / MCP / SLACK / WEBHOOK / API / SYSTEM)',
  })
  @IsOptional()
  @IsIn(ISSUE_SOURCES)
  source?: SourceLiteral;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  assigneeId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    enum: ['number', 'title', 'status', 'priority', 'createdAt', 'dueDate'],
    description: 'Legacy single-field sort. Prefer `sort=field:dir,…` for multi-field.',
  })
  @IsOptional()
  @IsIn(['number', 'title', 'status', 'priority', 'createdAt', 'dueDate'])
  sortBy?: string;

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'desc' })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc';

  @ApiPropertyOptional({
    description:
      'Multi-field sort, comma-separated `field:dir` pairs. Allowed fields: priority, dueDate, startDate, createdAt, updatedAt, title, number, status. Direction is asc or desc. Example: `priority:desc,dueDate:asc`. Wins over `sortBy`/`sortOrder` when provided.',
    example: 'priority:desc,dueDate:asc',
  })
  @IsOptional()
  @IsString()
  sort?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number = 50;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  includeArchived?: boolean = false;

  @ApiPropertyOptional({
    description:
      'ISO 8601 timestamp. Restricts results to issues with `dueDate >= this`. Used by the Calendar view to fetch only the visible month range — avoids the silent data-loss path where a 200-row default cap hides deadlines past the first page.',
    example: '2026-05-01T00:00:00.000Z',
  })
  @IsOptional()
  @IsISO8601()
  dueDateFrom?: string;

  @ApiPropertyOptional({
    description:
      'ISO 8601 timestamp. Restricts results to issues with `dueDate <= this`. Pair with `dueDateFrom` for the Calendar month range query.',
    example: '2026-05-31T23:59:59.999Z',
  })
  @IsOptional()
  @IsISO8601()
  dueDateTo?: string;
}
