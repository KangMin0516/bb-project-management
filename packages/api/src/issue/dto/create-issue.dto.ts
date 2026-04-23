import {
  IsString,
  IsOptional,
  IsEnum,
  IsUUID,
  IsDateString,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IssueStatus,
  IssuePriority,
  IssueType,
} from '../../../generated/prisma/enums.js';

export class CreateIssueDto {
  @ApiProperty({ example: 'Implement login page' })
  @IsString()
  @MaxLength(500)
  title!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ enum: IssueStatus, default: IssueStatus.BACKLOG })
  @IsOptional()
  @IsEnum(IssueStatus)
  status?: IssueStatus;

  @ApiPropertyOptional({ enum: IssuePriority, default: IssuePriority.MEDIUM })
  @IsOptional()
  @IsEnum(IssuePriority)
  priority?: IssuePriority;

  @ApiPropertyOptional({ enum: IssueType, default: IssueType.TASK })
  @IsOptional()
  @IsEnum(IssueType)
  type?: IssueType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  assigneeId?: string;

  @ApiPropertyOptional({ description: 'Reviewer assignee ID' })
  @IsOptional()
  @IsUUID()
  reviewerAssigneeId?: string;

  @ApiPropertyOptional({ description: 'Parent issue ID for sub-tasks' })
  @IsOptional()
  @IsUUID()
  parentId?: string;

  @ApiPropertyOptional({ description: 'Due date (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @ApiPropertyOptional({ description: 'Label IDs to attach', type: [String] })
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
}
