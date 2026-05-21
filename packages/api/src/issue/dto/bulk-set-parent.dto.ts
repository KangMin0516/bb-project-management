import {
  ArrayMinSize,
  IsArray,
  IsOptional,
  IsUUID,
  ValidateIf,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Body for `PATCH /projects/:projectId/issues/bulk-set-parent` — used
 * by the Module (DOMAIN) bulk-assignment flow on the Issues page and
 * the "Unassigned Epics" section of the Table of Content view.
 */
export class BulkSetParentDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @IsUUID('4', { each: true })
  @ArrayMinSize(1)
  issueIds!: string[];

  /** Set null to unparent (move epics out of any Module). */
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((o) => o.parentId !== null)
  @IsUUID()
  parentId!: string | null;
}
