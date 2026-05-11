import {
  IsString,
  IsOptional,
  IsEnum,
  MinLength,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SpecStatus } from '../../../generated/prisma/enums.js';

export class ExternalCreateSpecDto {
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

  @ApiPropertyOptional({ enum: SpecStatus, default: SpecStatus.DRAFT })
  @IsOptional()
  @IsEnum(SpecStatus)
  status?: SpecStatus;
}
