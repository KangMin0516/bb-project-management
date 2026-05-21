import {
  IsArray,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  Length,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum ShareScopeDto {
  TIMELINE = 'TIMELINE',
  BOARD = 'BOARD',
  CALENDAR = 'CALENDAR',
  LISTS = 'LISTS',
}

export class CreateShareLinkDto {
  @ApiProperty({ minLength: 6, maxLength: 64 })
  @IsString()
  @Length(6, 64)
  passcode!: string;

  @ApiProperty({ enum: ShareScopeDto, isArray: true })
  @IsArray()
  @IsEnum(ShareScopeDto, { each: true })
  scopes!: ShareScopeDto[];

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsDateString()
  expiresAt?: string | null;
}
