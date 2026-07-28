import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Length,
  Min,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  MAX_BODY_LENGTH,
  MAX_CONTAINER_ID_LENGTH,
  MAX_CONTEXT_LENGTH,
  MAX_DISPLAY_NAME_LENGTH,
  MAX_DOC_KEY_LENGTH,
  MAX_QUOTE_LENGTH,
} from '../domain/doc-comment.entity.js';

/**
 * Where in the document the comment attaches. Every field is optional:
 * omit the object entirely for a page-level comment, and the domain
 * clamps anything over-long rather than rejecting the post (losing a
 * typed comment to a validation error is worse than a fuzzier anchor).
 */
export class DocCommentAnchorDto {
  @ApiPropertyOptional({ maxLength: MAX_CONTAINER_ID_LENGTH })
  @IsOptional()
  @IsString()
  @Length(0, MAX_CONTAINER_ID_LENGTH)
  containerId?: string;

  @ApiPropertyOptional({ maxLength: MAX_QUOTE_LENGTH })
  @IsOptional()
  @IsString()
  @Length(0, MAX_QUOTE_LENGTH)
  quote?: string;

  @ApiPropertyOptional({ maxLength: MAX_CONTEXT_LENGTH })
  @IsOptional()
  @IsString()
  @Length(0, MAX_CONTEXT_LENGTH)
  prefix?: string;

  @ApiPropertyOptional({ maxLength: MAX_CONTEXT_LENGTH })
  @IsOptional()
  @IsString()
  @Length(0, MAX_CONTEXT_LENGTH)
  suffix?: string;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  textOffset?: number;
}

export class CreateDocCommentDto {
  @ApiProperty({
    description: 'Document path in the publishing site, e.g. "/f/js-auth"',
    maxLength: MAX_DOC_KEY_LENGTH,
  })
  @IsString()
  @Length(1, MAX_DOC_KEY_LENGTH)
  docKey!: string;

  @ApiProperty({ maxLength: MAX_BODY_LENGTH })
  @IsString()
  @Length(1, MAX_BODY_LENGTH)
  body!: string;

  @ApiPropertyOptional({ type: DocCommentAnchorDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => DocCommentAnchorDto)
  anchor?: DocCommentAnchorDto;

  @ApiPropertyOptional({
    description: 'Thread head to reply to. Anchor and docKey are inherited.',
  })
  @IsOptional()
  @IsString()
  parentId?: string;

  @ApiPropertyOptional({ maxLength: MAX_DISPLAY_NAME_LENGTH })
  @IsOptional()
  @IsString()
  @Length(0, MAX_DISPLAY_NAME_LENGTH)
  guestName?: string;
}
