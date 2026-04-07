import { IsString, IsOptional, MaxLength, IsUUID, ValidateIf } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateComponentDto {
  @ApiPropertyOptional({ example: 'API' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ example: 'Backend API service' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Component lead user ID, null to clear' })
  @IsOptional()
  @ValidateIf((o) => o.leadId !== null)
  @IsUUID()
  leadId?: string | null;

  @ApiPropertyOptional({ description: 'Default assignee user ID, null to clear' })
  @IsOptional()
  @ValidateIf((o) => o.defaultAssigneeId !== null)
  @IsUUID()
  defaultAssigneeId?: string | null;
}
