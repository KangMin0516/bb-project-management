import {
  IsString,
  IsOptional,
  IsEnum,
  IsInt,
  Min,
  MinLength,
  MaxLength,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { SpecStatus } from '../../../generated/prisma/enums.js';

export class ExternalUpdateSpecDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  content?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  category?: string;

  @ApiPropertyOptional({ enum: SpecStatus })
  @IsOptional()
  @IsEnum(SpecStatus)
  status?: SpecStatus;

  @ApiPropertyOptional({ description: 'Absolute display order (>=0)' })
  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;
}
