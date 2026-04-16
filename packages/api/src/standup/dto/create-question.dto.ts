import { IsInt, IsOptional, IsString } from 'class-validator';

export class CreateQuestionDto {
  @IsString()
  text: string;

  @IsOptional()
  @IsString()
  ignoreText?: string;

  @IsOptional()
  @IsInt()
  order?: number;
}
