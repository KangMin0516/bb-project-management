import {
  IsString,
  MinLength,
  MaxLength,
  IsOptional,
  IsEnum,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SpecStatus } from '../../../generated/prisma/enums.js';

export class CreateSpecificationDto {
  @ApiProperty({ example: 'User Authentication Flow' })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title!: string;

  @ApiProperty({ example: '# Auth Flow\n\n## Login\n...' })
  @IsString()
  @MinLength(1)
  content!: string;

  @ApiPropertyOptional({ example: 'FRS' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  category?: string;

  @ApiPropertyOptional({ enum: SpecStatus })
  @IsOptional()
  @IsEnum(SpecStatus)
  status?: SpecStatus;
}
