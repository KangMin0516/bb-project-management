import { IsString, MinLength, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateCommentDto {
  @ApiProperty({ example: 'This needs API changes.' })
  @IsString()
  @MinLength(1)
  @MaxLength(10000)
  content!: string;
}
