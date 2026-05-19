import {
  IsOptional,
  IsEnum,
  IsUUID,
  IsString,
  IsInt,
  IsIn,
  IsBoolean,
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
  })
  @IsOptional()
  @IsIn(['number', 'title', 'status', 'priority', 'createdAt', 'dueDate'])
  sortBy?: string;

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'desc' })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc';

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
}
