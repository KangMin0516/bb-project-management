import { IsString, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UnlockShareLinkDto {
  @ApiProperty({ minLength: 1, maxLength: 64 })
  @IsString()
  @Length(1, 64)
  passcode!: string;
}
