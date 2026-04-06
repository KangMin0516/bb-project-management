import {
  IsString,
  IsOptional,
  IsEnum,
  IsUUID,
  IsInt,
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

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateIf((o) => o.parentId !== null)
  @IsUUID()
  parentId?: string | null;

  @ApiPropertyOptional({ description: 'Kanban column order' })
  @IsOptional()
  @IsInt()
  order?: number;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsUUID('4', { each: true })
  labelIds?: string[];
}
