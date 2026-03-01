import { IsString, IsEmail, IsNotEmpty, MinLength, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ResetPasswordDto {
  @ApiProperty({ example: 'ulrich@gmail.com' })
  @IsEmail({}, { message: 'Please enter a valid email address' })
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: 'WO9-OPS' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[A-Z0-9]{3}-[A-Z0-9]{3}$/, { 
    message: 'Reset code must be in the format XXX-XXX (e.g., WO9-OPS)' 
  })
  resetCode: string;

  @ApiProperty({ example: 'NewPassword123!' })
  @IsString()
  @IsNotEmpty()
  @MinLength(6, { message: 'New password must be at least 6 characters' })
  newPassword: string;
}