import { IsString, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RotatePasscodeDto {
  @ApiProperty({ minLength: 6, maxLength: 64 })
  @IsString()
  @Length(6, 64)
  newPasscode!: string;
}
