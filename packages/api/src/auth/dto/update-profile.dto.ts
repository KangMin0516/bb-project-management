import { IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'John Doe' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ example: 'https://s3.amazonaws.com/bucket/avatars/user.jpg' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  avatar?: string;
}
