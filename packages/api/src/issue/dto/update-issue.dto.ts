import {
  IsString,
  IsOptional,
  IsEnum,
  IsUUID,
  IsInt,
  IsBoolean,
  IsDateString,
  IsArray,
  ArrayMaxSize,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IssueStatus,
  IssuePriority,
  IssueType,
} from '../../../generated/prisma/enums.js';

export class UpdateIssueDto {
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

  @ApiPropertyOptional({ enum: IssueType })
  @IsOptional()
  @IsEnum(IssueType)
  type?: IssueType;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateIf((o) => o.assigneeId !== null)
  @IsUUID()
  assigneeId?: string | null;

  @ApiPropertyOptional({ description: 'Reviewer assignee ID, null to clear' })
  @IsOptional()
  @ValidateIf((o) => o.reviewerAssigneeId !== null)
  @IsUUID()
  reviewerAssigneeId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateIf((o) => o.parentId !== null)
  @IsUUID()
  parentId?: string | null;

  @ApiPropertyOptional({ description: 'Kanban column order' })
  @IsOptional()
  @IsInt()
  order?: number;

  @ApiPropertyOptional({ description: 'Start date (ISO 8601), null to clear' })
  @IsOptional()
  @ValidateIf((o) => o.startDate !== null)
  @IsDateString()
  startDate?: string | null;

  @ApiPropertyOptional({ description: 'Due date (ISO 8601), null to clear' })
  @IsOptional()
  @ValidateIf((o) => o.dueDate !== null)
  @IsDateString()
  dueDate?: string | null;

  @ApiPropertyOptional({
    description: 'Focus date (YYYY-MM-DD), null to clear',
  })
  @IsOptional()
  @ValidateIf((o) => o.focusDate !== null)
  @IsDateString()
  focusDate?: string | null;

  @ApiPropertyOptional({ description: 'Mark as recheck (QA returned)' })
  @IsOptional()
  @IsBoolean()
  isRecheck?: boolean;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsUUID('4', { each: true })
  labelIds?: string[];

  @ApiPropertyOptional({
    description: 'Component IDs to attach',
    type: [String],
  })
  @IsOptional()
  @IsUUID('4', { each: true })
  componentIds?: string[];

  @ApiPropertyOptional({
    description:
      'When true, skip assignee notification side effects. Used by the ' +
      'frontend Undo action so reverting a mis-click does not DM anyone.',
  })
  @IsOptional()
  @IsBoolean()
  silent?: boolean;

  /**
   * User IDs explicitly mentioned via the @-picker in the description
   * editor. Only fires MENTIONED notifications when description is also
   * being changed in this update.
   */
  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsUUID('4', { each: true })
  mentionedUserIds?: string[];
}
