import { IsInt, IsString, MaxLength, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ATTACHMENT_MAX_SIZE } from '../../common/constants.js';

export class PresignUploadDto {
  @ApiProperty({ description: 'Original filename (used for extension check)' })
  @IsString()
  @MaxLength(255)
  fileName!: string;

  @ApiProperty({ description: 'File size in bytes' })
  @IsInt()
  @Min(1)
  fileSize!: number;

  @ApiProperty({ description: 'MIME type (used for ACL + Content-Type)' })
  @IsString()
  @MaxLength(127)
  mimeType!: string;
}

export const PRESIGN_MAX_SIZE = ATTACHMENT_MAX_SIZE;
