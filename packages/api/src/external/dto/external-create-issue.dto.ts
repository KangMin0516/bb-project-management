import {
  IsString,
  IsOptional,
  IsEnum,
  IsUUID,
  MaxLength,
  IsArray,
  IsDateString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IssueStatus,
  IssuePriority,
  IssueType,
} from '../../../generated/prisma/enums.js';
import { ExternalInlineAttachmentDto } from './external-attach-image.dto.js';

export class ExternalCreateIssueDto {
  @ApiProperty({ example: 'BBPM' })
  @IsString()
  projectKey!: string;

  @ApiProperty({ example: 'Implement login page' })
  @IsString()
  @MaxLength(500)
  title!: string;

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

  @ApiPropertyOptional({ description: 'Assignee email (resolved to a user)' })
  @IsOptional()
  @IsString()
  assigneeEmail?: string;

  @ApiPropertyOptional({
    description:
      'Assignee user UUID. Takes precedence over assigneeEmail when both are sent.',
  })
  @IsOptional()
  @IsUUID()
  assigneeId?: string;

  @ApiPropertyOptional({ description: 'Parent issue ID' })
  @IsOptional()
  @IsUUID()
  parentId?: string;

  @ApiPropertyOptional({ description: 'Planned start date (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ description: 'Due date (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @ApiPropertyOptional({ description: 'Label names', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  labels?: string[];

  @ApiPropertyOptional({
    description:
      'Inline image attachments. Each is base64-encoded and uploaded to storage before the issue is created; their markdown is appended to the description so they render in the issue body.',
    type: [ExternalInlineAttachmentDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ExternalInlineAttachmentDto)
  attachments?: ExternalInlineAttachmentDto[];
}
