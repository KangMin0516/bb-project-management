import {
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ConfigQuestionDto, ConfigMemberDto } from './shared.dto.js';

export class CreateConfigDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  greeting?: string;

  @IsOptional()
  @IsString()
  goodbye?: string;

  @IsString()
  channelId: string;

  @IsOptional()
  @IsString()
  channelName?: string;

  @IsOptional()
  @IsString()
  cronHour?: string;

  @IsOptional()
  @IsString()
  cronMinute?: string;

  @IsOptional()
  @IsString()
  cronDayOfWeek?: string;

  @IsOptional()
  @IsString()
  timezone?: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsString()
  slackIntegrationId: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ConfigQuestionDto)
  questions?: ConfigQuestionDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ConfigMemberDto)
  members?: ConfigMemberDto[];
}
