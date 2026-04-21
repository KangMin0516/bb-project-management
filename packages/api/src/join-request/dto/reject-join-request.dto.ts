import { IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class RejectJoinRequestDto {
  @ApiPropertyOptional({ example: '현재 팀 인원이 충분합니다' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
