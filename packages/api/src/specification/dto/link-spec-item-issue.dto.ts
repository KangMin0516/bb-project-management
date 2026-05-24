import { IsString, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LinkSpecItemIssueDto {
  @ApiProperty({
    description: 'UUID of the Issue to link to this SpecItem.',
    example: '8f1b6a3c-2e6f-4f00-b6d3-23f6a25c1e3d',
  })
  @IsString()
  @IsUUID()
  issueId!: string;
}
