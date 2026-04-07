import { IsString, IsOptional, MaxLength, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateProjectDto {
  @ApiProperty({ example: 'BB PM' })
  @IsString()
  @MaxLength(100)
  name!: string;

  @ApiProperty({
    example: 'BBPM',
    description: 'Unique project key (uppercase letters/numbers)',
  })
  @IsString()
  @Matches(/^[A-Z][A-Z0-9_]{1,9}$/, {
    message:
      'Key must be 2-10 uppercase letters/numbers, starting with a letter',
  })
  key!: string;

  @ApiPropertyOptional({ example: 'Internal project management system' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}
