import {
  IsString,
  IsIn,
  IsOptional,
  MaxLength,
  IsNotEmpty,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Image attachment payload accepted by MCP / API-key callers. The
 * upload travels as base64 inside JSON instead of multipart so the LLM
 * host doesn't need to construct a multipart body — most MCP clients
 * can pass binary content as a base64 string field but cannot stream
 * file uploads.
 */
export class ExternalAttachImageDto {
  @ApiProperty({
    description:
      'Base64-encoded image bytes. Strip any `data:image/...;base64,` prefix — only the raw base64 payload.',
  })
  @IsString()
  @IsNotEmpty()
  data!: string;

  @ApiProperty({
    description: 'Image MIME type',
    enum: ['image/png', 'image/jpeg', 'image/gif', 'image/webp'],
  })
  @IsString()
  @IsIn(['image/png', 'image/jpeg', 'image/gif', 'image/webp'])
  mimeType!: 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp';

  @ApiProperty({ example: 'login-crash.png' })
  @IsString()
  @MaxLength(200)
  filename!: string;

  @ApiPropertyOptional({
    description:
      'Alt text used in the returned markdown snippet (accessibility).',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  alt?: string;
}

/**
 * Inline-attachment slot for `create_issue` — same shape as
 * `ExternalAttachImageDto` so the LLM can reuse one mental model.
 * Listed as a separate class so Swagger keeps both schemas distinct.
 */
export class ExternalInlineAttachmentDto {
  @IsString()
  @IsNotEmpty()
  data!: string;

  @IsString()
  @IsIn(['image/png', 'image/jpeg', 'image/gif', 'image/webp'])
  mimeType!: 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp';

  @IsString()
  @MaxLength(200)
  filename!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  alt?: string;
}

/**
 * Wrap the optional `attachments[]` field added to
 * `ExternalCreateIssueDto`. Lives here so the create-issue DTO stays
 * focused on issue fields.
 */
export class ExternalCreateIssueWithAttachments {
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ExternalInlineAttachmentDto)
  attachments?: ExternalInlineAttachmentDto[];
}
