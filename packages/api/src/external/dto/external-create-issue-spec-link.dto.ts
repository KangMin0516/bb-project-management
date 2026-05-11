import { IsString, IsOptional, IsUUID, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ExternalCreateIssueSpecLinkDto {
  @ApiProperty({ description: 'Specification UUID to link' })
  @IsUUID()
  specId!: string;

  @ApiPropertyOptional({
    description:
      'Section slug within the spec (omit for a whole-document link).',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  sectionSlug?: string;
}
