import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ChangePasswordDto {
  @ApiProperty({ description: 'Current password' })
  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  oldPassword: string;

  @ApiProperty({ description: 'New password (6–72 characters)' })
  @IsString()
  @IsNotEmpty()
  @MinLength(6, { message: 'New password must be at least 6 characters' })
  @MaxLength(72, { message: 'New password must be at most 72 characters' })
  newPassword: string;

  @ApiProperty({ description: 'Confirm new password (must match newPassword)' })
  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  confirmNewPassword: string;
}
