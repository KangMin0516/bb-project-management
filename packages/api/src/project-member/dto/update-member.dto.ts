import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ProjectRole } from '../../../generated/prisma/enums.js';

export class UpdateMemberDto {
  @ApiProperty({ enum: ProjectRole, example: ProjectRole.PM })
  @IsEnum(ProjectRole)
  role!: ProjectRole;
}
