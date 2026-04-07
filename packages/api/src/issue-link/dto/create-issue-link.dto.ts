import { IsEnum, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { IssueLinkType } from '../../../generated/prisma/enums.js';

export class CreateIssueLinkDto {
  @ApiProperty({ example: '00000000-0000-0000-0000-000000000000' })
  @IsUUID()
  targetIssueId!: string;

  @ApiProperty({ enum: IssueLinkType, example: 'BLOCKS' })
  @IsEnum(IssueLinkType)
  type!: IssueLinkType;
}
