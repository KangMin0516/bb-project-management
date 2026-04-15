import { IsBoolean, IsOptional, IsString, Matches } from 'class-validator';

export class UpdateReportConfigDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsString()
  timezone?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{2}:\d{2}$/)
  morningTime?: string;

  @IsOptional()
  @IsString()
  morningChannelId?: string;

  @IsOptional()
  @IsString()
  morningChannelName?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{2}:\d{2}$/)
  lunchTime?: string;

  @IsOptional()
  @IsString()
  lunchChannelId?: string;

  @IsOptional()
  @IsString()
  lunchChannelName?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{2}:\d{2}$/)
  eveningTime?: string;

  @IsOptional()
  @IsString()
  eveningChannelId?: string;

  @IsOptional()
  @IsString()
  eveningChannelName?: string;

  @IsOptional()
  @IsBoolean()
  skipWeekends?: boolean;

  @IsOptional()
  @IsString()
  slackIntegrationId?: string;
}
