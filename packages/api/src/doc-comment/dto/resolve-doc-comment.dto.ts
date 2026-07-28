import { IsBoolean, IsOptional, IsString, Length } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MAX_DISPLAY_NAME_LENGTH } from '../domain/doc-comment.entity.js';

export class ResolveDocCommentDto {
  @ApiProperty({ description: 'true resolves the thread, false reopens it' })
  @IsBoolean()
  resolved!: boolean;

  @ApiPropertyOptional({
    description: 'Display name stamped on the resolve',
    maxLength: MAX_DISPLAY_NAME_LENGTH,
  })
  @IsOptional()
  @IsString()
  @Length(0, MAX_DISPLAY_NAME_LENGTH)
  by?: string;
}
