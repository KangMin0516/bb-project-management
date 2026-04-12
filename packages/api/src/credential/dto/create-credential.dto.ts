import {
  IsString,
  IsOptional,
  IsArray,
  ValidateNested,
  IsBoolean,
  MaxLength,
  ArrayMaxSize,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CredentialEntryDto {
  @ApiProperty({ example: 'Access Key' })
  @IsString()
  @MaxLength(200)
  key!: string;

  @ApiProperty({ example: 'AKIA...' })
  @IsString()
  @MaxLength(5000)
  value!: string;

  @ApiProperty({ example: true })
  @IsBoolean()
  sensitive!: boolean;
}

export class CreateCredentialDto {
  @ApiProperty({ example: 'AWS Production' })
  @IsString()
  @MaxLength(200)
  name!: string;

  @ApiProperty({ example: 'AWS' })
  @IsString()
  @MaxLength(50)
  serviceType!: string;

  @ApiPropertyOptional({ example: 'Production AWS credentials' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiPropertyOptional({ example: 'https://console.aws.amazon.com' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  url?: string;

  @ApiProperty({ type: [CredentialEntryDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => CredentialEntryDto)
  entries!: CredentialEntryDto[];
}
