import { IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class RejectJoinRequestDto {
  @ApiPropertyOptional({ example: 'The team is currently at capacity' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
