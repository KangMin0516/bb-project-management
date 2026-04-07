import { IsString, IsOptional, MaxLength, IsEnum } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IssueType } from '../../../generated/prisma/enums.js';

export class UpdateTemplateDto {
  @ApiPropertyOptional({ example: 'Feature Request' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ enum: IssueType, example: 'TASK' })
  @IsOptional()
  @IsEnum(IssueType)
  type?: IssueType;

  @ApiPropertyOptional({ example: '## Description\n\n...' })
  @IsOptional()
  @IsString()
  description?: string;
}
