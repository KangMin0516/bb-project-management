import {
  IsString,
  IsOptional,
  IsBoolean,
  IsUUID,
  IsUrl,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ConnectGitHubDto {
  @ApiProperty({ description: 'GitHub Personal Access Token' })
  @IsString()
  accessToken!: string;

  @ApiProperty()
  @IsUUID()
  projectId!: string;
}

export class UpdateGitHubConfigDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  onPrOpenStatus?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  onPrMergeStatus?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  autoLinkEnabled?: boolean;
}

export class LinkPrDto {
  @ApiProperty({ description: 'GitHub PR URL' })
  @IsUrl()
  prUrl!: string;

  @ApiProperty()
  @IsUUID()
  issueId!: string;

  @ApiProperty()
  @IsUUID()
  projectId!: string;
}
