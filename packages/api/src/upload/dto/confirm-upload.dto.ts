import { IsInt, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ConfirmUploadDto {
  @ApiProperty({ description: 'Storage key issued by /upload/presign' })
  @IsString()
  @MaxLength(512)
  key!: string;

  @ApiProperty({ description: 'Original filename' })
  @IsString()
  @MaxLength(255)
  fileName!: string;

  @ApiProperty({ description: 'File size in bytes' })
  @IsInt()
  @Min(1)
  fileSize!: number;

  @ApiProperty({ description: 'MIME type' })
  @IsString()
  @MaxLength(127)
  mimeType!: string;

  @ApiPropertyOptional({ description: 'Issue to attach this file to' })
  @IsOptional()
  @IsUUID()
  issueId?: string;

  @ApiPropertyOptional({ description: 'Comment to attach this file to' })
  @IsOptional()
  @IsUUID()
  commentId?: string;
}
