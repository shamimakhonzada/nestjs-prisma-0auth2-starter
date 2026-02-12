import { IsString, MinLength, MaxLength, IsOptional } from 'class-validator';

export class ChangePasswordDto {
  @IsString()
  @MinLength(6)
  oldPassword: string;

  @IsString()
  @MinLength(6)
  @MaxLength(18)
  newPassword: string;

  @IsString()
  @MinLength(6)
  @IsOptional() // only if you enforce password confirmation
  confirmNewPassword?: string;
}
