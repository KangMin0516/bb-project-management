import { IsString, IsOptional, IsUUID, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class QuickCreateIssueDto {
  @ApiProperty({ example: 'BBPM 로그인 버그 긴급 @Thu' })
  @IsString()
  @MaxLength(1000)
  text!: string;

  @ApiPropertyOptional({ description: 'Pre-selected project ID' })
  @IsOptional()
  @IsUUID()
  projectId?: string;
}
