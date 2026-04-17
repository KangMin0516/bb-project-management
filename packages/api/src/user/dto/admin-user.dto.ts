import {
  IsString,
  IsEmail,
  IsBoolean,
  IsOptional,
  MinLength,
  MaxLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AdminUpdateUserDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  isSuperuser?: boolean;
}

export class AdminResetPasswordDto {
  @ApiProperty({ example: 'newpassword123' })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  newPassword!: string;
}
