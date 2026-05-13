import { IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class CreateJoinRequestDto {
  @ApiPropertyOptional({ example: 'I would like to join this project' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  message?: string;
}
