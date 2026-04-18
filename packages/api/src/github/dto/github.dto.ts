import {
  IsString,
  IsOptional,
  IsBoolean,
  IsUUID,
  IsUrl,
  IsIn,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IssueStatus } from '../../../generated/prisma/enums.js';

const VALID_ISSUE_STATUSES = Object.values(IssueStatus);

export class ConnectGitHubDto {
  @ApiProperty({ description: 'GitHub Personal Access Token' })
  @IsString()
  accessToken!: string;

  @ApiProperty()
  @IsUUID()
  projectId!: string;
}

export class UpdateGitHubConfigDto {
  @ApiPropertyOptional({ enum: VALID_ISSUE_STATUSES })
  @IsOptional()
  @IsIn(VALID_ISSUE_STATUSES)
  onPrOpenStatus?: string;

  @ApiPropertyOptional({ enum: VALID_ISSUE_STATUSES })
  @IsOptional()
  @IsIn(VALID_ISSUE_STATUSES)
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
