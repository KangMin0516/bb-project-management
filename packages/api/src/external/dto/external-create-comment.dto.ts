import {
  ArrayMaxSize,
  IsArray,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ExternalCreateCommentDto {
  @ApiProperty({
    example: 'API spec đã cập nhật, mention reviewer giúp nhé',
    description:
      'Comment body (markdown / HTML). Send the @ mention as plain text — ' +
      'pair with `mentionedUserIds` so the API can dispatch the Slack DM.',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(10000)
  content!: string;

  @ApiPropertyOptional({
    type: [String],
    description: 'Up to 20 user UUIDs to notify via in-app + Slack mention DM',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsUUID('4', { each: true })
  mentionedUserIds?: string[];
}
