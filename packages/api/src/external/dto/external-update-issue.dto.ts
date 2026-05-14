import {
  IsString,
  IsOptional,
  IsEnum,
  IsUUID,
  IsDateString,
  ValidateIf,
  MaxLength,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IssueStatus, IssuePriority } from '../../../generated/prisma/enums.js';

export class ExternalUpdateIssueDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ enum: IssueStatus })
  @IsOptional()
  @IsEnum(IssueStatus)
  status?: IssueStatus;

  @ApiPropertyOptional({ enum: IssuePriority })
  @IsOptional()
  @IsEnum(IssuePriority)
  priority?: IssuePriority;

  @ApiPropertyOptional({
    description: 'Assignee email (empty string or null to clear)',
  })
  @IsOptional()
  @IsString()
  assigneeEmail?: string | null;

  @ApiPropertyOptional({ description: 'Parent issue ID (null to clear)' })
  @IsOptional()
  @ValidateIf((o) => o.parentId !== null)
  @IsUUID()
  parentId?: string | null;

  @ApiPropertyOptional({ description: 'Start date ISO 8601 (null to clear)' })
  @IsOptional()
  @ValidateIf((o) => o.startDate !== null)
  @IsDateString()
  startDate?: string | null;

  @ApiPropertyOptional({ description: 'Due date ISO 8601 (null to clear)' })
  @IsOptional()
  @ValidateIf((o) => o.dueDate !== null)
  @IsDateString()
  dueDate?: string | null;
}
