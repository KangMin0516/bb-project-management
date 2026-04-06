import { IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateApiKeyDto {
  @ApiProperty({ example: 'AI Integration Key' })
  @IsString()
  @MaxLength(100)
  name!: string;
}
