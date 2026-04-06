import { IsEnum, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ProjectRole } from '../../../generated/prisma/enums.js';

export class AddMemberDto {
  @ApiProperty({ example: 'uuid-of-user' })
  @IsUUID()
  userId!: string;

  @ApiProperty({ enum: ProjectRole, example: ProjectRole.DEVELOPER })
  @IsEnum(ProjectRole)
  role!: ProjectRole;
}
