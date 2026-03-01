import {
  Injectable,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import slugify from 'slugify';
import * as crypto from 'crypto';

import { Tenant } from '../tenants/tenant.schema';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { VerifyResetCodeDto } from './dto/verify-reset-code.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { EmailService } from '../email/email.service';
import { UsersService } from '../users/users.service';
import { User, UserDocument } from '../users/user.schema'; 

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private userModel: Model<User>,
    @InjectModel(Tenant.name) private tenantModel: Model<Tenant>,
    private jwtService: JwtService,
    private emailService: EmailService,
    private usersService: UsersService,
  ) {}

  async register(dto: RegisterDto) {
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.com$/i;

    if (!emailRegex.test(dto.email)) {
      throw new BadRequestException(
        'Email address should include @ and end with .com (e.g., user@example.com)',
      );
    }

    const [existingEmail, existingUsername] = await Promise.all([
      this.userModel.findOne({ email: dto.email }),
      this.userModel.findOne({ username: dto.username }),
    ]);

    if (existingEmail) throw new ConflictException('Email already in use');
    if (existingUsername) throw new ConflictException('Username already taken');

    const passwordHash = await bcrypt.hash(dto.password, 10);

    const user = new this.userModel({
      email: dto.email,
      username: dto.username,
      passwordHash,
      role: 'reader',
    });

    await user.save();

    const tenantName = dto.username;
    const baseSlug = slugify(tenantName, { lower: true, strict: true });
    let tenantSlug = baseSlug;
    let counter = 1;

    while (await this.tenantModel.findOne({ slug: tenantSlug })) {
      tenantSlug = `${baseSlug}-${counter}`;
      counter++;

      if (counter > 100) {
        tenantSlug = `${baseSlug}-${Date.now()}`;
        break;
      }
    }

    try {
      const tenant = new this.tenantModel({
        owner: user._id.toString(),
        userId: user._id.toString(),
        name: tenantName,
        slug: tenantSlug,
      });

      await tenant.save();

      user.tenantId = tenant._id.toString();
      await user.save();

      const tokenPayload = {
        sub: user._id.toString(),
        userId: user._id.toString(),
        email: user.email,
        username: user.username,
        role: 'author',
        hasBlog: true,
        tenantId: tenant._id.toString(),
      };

      const token = this.jwtService.sign(tokenPayload);

      return {
        message: 'Welcome! Your blog tenant has been created.',
        accessToken: token,
        user: {
          id: user._id,
          userId: user._id.toString(),
          email: user.email,
          username: user.username,
          role: 'author',
          hasBlog: true,
          tenantId: tenant._id,
        },
      };
    } catch (error) {
      await this.userModel.deleteOne({ _id: user._id });

      if (error.code === 11000) {
        const field = Object.keys(error.keyPattern || {})[0];
        const messages = {
          slug: 'Profile URL conflict. Please try a different username or contact support.',
          owner: 'User already has a blog profile.',
          userId: 'User already has a blog profile.',
        };

        throw new ConflictException(
          messages[field] ||
            'Registration conflict. Please try different information.',
        );
      }

      throw new BadRequestException(
        `Registration failed: ${error.message || 'Please try again.'}`,
      );
    }
  }

  async login(dto: LoginDto) {
    const user = await this.userModel.findOne({ email: dto.email });
    if (!user) throw new BadRequestException('Account does not exist');

    if (!user.passwordHash) {
      throw new BadRequestException(
        'This account uses Google Sign-In. Please login with Google.',
      );
    }

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid)
      throw new BadRequestException(
        'Invalid email or password. Please try again.',
      );

    let tenant = await this.tenantModel.findOne({
      $or: [{ owner: user._id.toString() }, { userId: user._id.toString() }],
    });

    if (!tenant) {
      const tenantName = user.username || user.email.split('@')[0];
      const tenantSlug = slugify(tenantName, { lower: true, strict: true });

      tenant = new this.tenantModel({
        owner: user._id.toString(),
        userId: user._id.toString(),
        name: tenantName,
        slug: tenantSlug,
      });
      await tenant.save();

      user.tenantId = tenant._id.toString();
      user.role = 'author';
      await user.save();
    }

    const hasBlog = true;
    const role = 'author';

    const tokenPayload = {
      sub: user._id.toString(),
      userId: user._id.toString(),
      email: user.email,
      username: user.username,
      role,
      hasBlog,
      tenantId: user.tenantId || tenant._id.toString(),
    };

    const token = this.jwtService.sign(tokenPayload);

    return {
      accessToken: token,
      user: {
        id: user._id,
        userId: user._id.toString(),
        email: user.email,
        username: user.username,
        role,
        hasBlog,
        tenantId: user.tenantId || tenant._id,
      },
    };
  }

  async upgradeToAuthor(userId: string, tenantId: string) {
    const user = await this.userModel.findById(userId);
    if (!user) throw new BadRequestException('User not found');

    user.role = 'author';
    user.tenantId = tenantId;
    await user.save();

    const tokenPayload = {
      sub: user._id.toString(),
      userId: user._id.toString(),
      email: user.email,
      username: user.username,
      role: 'author',
      hasBlog: true,
      tenantId,
    };

    return this.jwtService.sign(tokenPayload);
  }

  private generateResetCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 7; i++) {
      if (i === 3) {
        result += '-';
      } else {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
      }
    }
    return result;
  }

  async forgotPassword(forgotPasswordDto: ForgotPasswordDto) {
    const { email } = forgotPasswordDto;

    const user = await this.userModel.findOne({ email });

    const resetCode = this.generateResetCode();
    const resetCodeExpires = new Date(Date.now() + 15 * 60 * 1000);

    if (user) {
      user.resetCode = resetCode;
      user.resetCodeExpires = resetCodeExpires;
      await user.save();

      await this.emailService.sendResetCode(email, resetCode);
      console.log(`[DEV] Reset code for ${email}: ${resetCode}`);
    }

    return {
      message:
        "We've sent a password reset email to the address associated with your account.",
    };
  }

  async verifyResetCode(verifyResetCodeDto: VerifyResetCodeDto) {
    const { email, resetCode } = verifyResetCodeDto;

    const user = await this.userModel.findOne({
      email,
      resetCode,
      resetCodeExpires: { $gt: new Date() },
    });

    if (!user) {
      throw new BadRequestException('Invalid or expired reset code');
    }

    return {
      success: true,
      message: 'Code verified successfully',
    };
  }

  async resetPassword(resetPasswordDto: ResetPasswordDto) {
    const { email, resetCode, newPassword } = resetPasswordDto;

    const user = await this.userModel.findOne({
      email,
      resetCode,
      resetCodeExpires: { $gt: new Date() },
    });

    if (!user) {
      throw new BadRequestException('Invalid or expired reset code');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.passwordHash = hashedPassword;
    user.resetCode = undefined;
    user.resetCodeExpires = undefined;
    await user.save();

    const payload = { sub: user._id, email: user.email };
    const accessToken = this.jwtService.sign(payload);

    return {
      success: true,
      message: 'Password reset successful. log in with your new password.',
      accessToken,
      user: {
        id: user._id,
        email: user.email,
        username: user.username,
        hasBlog: true,
      },
    };
  }

  async checkResetCodeStatus(email: string, resetCode: string) {
    const user = await this.userModel.findOne({
      email,
      resetCode,
      resetCodeExpires: { $gt: new Date() },
    });

    return {
      valid: !!user,
      expiresAt: user?.resetCodeExpires,
    };
  }

  async resendResetCode(email: string) {
    const user = await this.userModel.findOne({ email });

    const resetCode = this.generateResetCode();
    const resetCodeExpires = new Date(Date.now() + 15 * 60 * 1000);

    if (user) {
      user.resetCode = resetCode;
      user.resetCodeExpires = resetCodeExpires;
      await user.save();

      await this.emailService.sendResetCode(email, resetCode);
      console.log(`[DEV] New reset code for ${email}: ${resetCode}`);
    }

    return {
      message:
        "We've sent a password reset email to the address associated with your account.",
    };
  }

  //
  async validateGoogleUser(googleUser: {
  email: string;
  firstName: string;
  lastName: string;
  picture: string;
}) {
  const { email, firstName, lastName, picture } = googleUser;


  const baseUsername = firstName.toLowerCase().replace(/[^a-z0-9]/g, '');
  let username = baseUsername;
  let counter = 1;

  while (await this.userModel.findOne({ username })) {
    username = `${baseUsername}${counter}`;
    counter++;
    if (counter > 100) {
      username = `${baseUsername}${Date.now()}`;
      break;
    }
  }

  // Get or create user
  let user: UserDocument;
  const existingUser = await this.userModel.findOne({ email });

  if (existingUser) {
    // Update existing user
    existingUser.firstName = firstName;
    existingUser.lastName = lastName;
    existingUser.picture = picture;
    existingUser.displayName = `${firstName} ${lastName}`.trim();
    existingUser.profilePicture = picture;
    existingUser.lastLoginAt = new Date();
    existingUser.loginCount = (existingUser.loginCount || 0) + 1;
    user = await existingUser.save();
  } else {
  
    user = await this.usersService.create({
      email,
      firstName,
      lastName,
      picture,
      username,
      isEmailVerified: true,
      role: 'reader', 
      loginCount: 1,
      lastLoginAt: new Date(),
      displayName: `${firstName} ${lastName}`.trim(),
    });
  }


  let tenant = await this.tenantModel.findOne({
    $or: [{ owner: user._id.toString() }, { userId: user._id.toString() }],
  });


  if (!tenant) {
    const tenantName = username; 
    const baseSlug = slugify(tenantName, { lower: true, strict: true });
    let tenantSlug = baseSlug;
    let slugCounter = 1;


    while (await this.tenantModel.findOne({ slug: tenantSlug })) {
      tenantSlug = `${baseSlug}-${slugCounter}`;
      slugCounter++;
      if (slugCounter > 100) {
        tenantSlug = `${baseSlug}-${Date.now()}`;
        break;
      }
    }

    tenant = new this.tenantModel({
      owner: user._id.toString(),
      userId: user._id.toString(),
      name: tenantName,
      slug: tenantSlug,
    });

    await tenant.save();

  
    user.tenantId = tenant._id.toString();
    user.role = 'author'; 
    await user.save();
  }

  const hasBlog = true; 
  const role = user.role; 

  const tokenPayload = {
    sub: user._id.toString(),
    userId: user._id.toString(),
    email: user.email,
    username: user.username,
    role: role,
    hasBlog: hasBlog,
    tenantId: tenant._id.toString(), 
  };

  const accessToken = this.jwtService.sign(tokenPayload);

  return {
    accessToken,
    user: {
      id: user._id,
      userId: user._id.toString(),
      email: user.email,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      displayName: user.displayName,
      picture: user.picture,
      role: role,
      hasBlog: hasBlog,
      tenantId: tenant._id, 
    },
  };
}
};