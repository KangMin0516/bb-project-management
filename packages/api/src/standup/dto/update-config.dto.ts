import {
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ConfigQuestionDto, ConfigMemberDto } from './shared.dto.js';

export class UpdateConfigDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  greeting?: string;

  @IsOptional()
  @IsString()
  goodbye?: string;

  @IsOptional()
  @IsString()
  channelId?: string;

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

  // Accepted but not applied — the web form reuses its create payload on save.
  @IsOptional()
  @IsString()
  slackIntegrationId?: string;

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
