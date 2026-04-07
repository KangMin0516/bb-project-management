import { IsString, IsOptional, IsNotEmpty, MaxLength, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IssueType } from '../../../generated/prisma/enums.js';

export class CreateTemplateDto {
  @ApiProperty({ example: 'Bug Report' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @ApiProperty({ enum: IssueType, example: 'BUG' })
  @IsEnum(IssueType)
  type!: IssueType;

  @ApiPropertyOptional({ example: '## Steps to reproduce\n\n1. ...' })
  @IsOptional()
  @IsString()
  description?: string;
}
