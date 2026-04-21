import { IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class CreateJoinRequestDto {
  @ApiPropertyOptional({ example: '이 프로젝트에 참여하고 싶습니다' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  message?: string;
}
