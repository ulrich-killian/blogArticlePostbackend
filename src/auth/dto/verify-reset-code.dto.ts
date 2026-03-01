import { IsEmail, IsNotEmpty, IsString, Length, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class VerifyResetCodeDto {
  @ApiProperty({
    description: 'User email address',
    example: 'user@example.com',
  })
  @IsEmail({}, { message: 'Please enter a valid email address' })
  @IsNotEmpty({ message: 'Email is required' })
  email: string;

  @ApiProperty({
    description: '7-character reset code with hyphen',
    example: 'ABC-123',
  })
  @IsString({ message: 'Reset code must be a string' })
  @IsNotEmpty({ message: 'Reset code is required' })

  @Length(7, 7, { message: 'Reset code must be exactly 7 characters (e.g., XXX-XXX)' })
  @Matches(/^[A-Z0-9]{3}-[A-Z0-9]{3}$/, { 
    message: 'Reset code must be in the format XXX-XXX' 
  })
  resetCode: string;
}