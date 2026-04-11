import { IsString, IsOptional, IsUUID, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateIssueSpecLinkDto {
  @ApiProperty({ description: 'Specification ID to link' })
  @IsUUID()
  specId!: string;

  @ApiPropertyOptional({
    description: 'Section slug (null for whole document)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  sectionSlug?: string;
}
