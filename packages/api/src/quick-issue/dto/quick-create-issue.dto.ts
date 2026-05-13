import { IsString, IsOptional, IsUUID, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class QuickCreateIssueDto {
  @ApiProperty({
    example: 'BBPM login bug urgent @Thu',
    description:
      'Free-form natural language. The rule parser accepts both English and Korean priority/type keywords; the LLM enricher (if ANTHROPIC_API_KEY is set) extracts structured fields.',
  })
  @IsString()
  @MaxLength(1000)
  text!: string;

  @ApiPropertyOptional({ description: 'Pre-selected project ID' })
  @IsOptional()
  @IsUUID()
  projectId?: string;
}
