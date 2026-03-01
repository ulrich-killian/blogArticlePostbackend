import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User, UserDocument } from './user.schema';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
  ) {}


  async findById(id: string): Promise<UserDocument | null> {
    if (!Types.ObjectId.isValid(id)) {
      return null;
    }
    return this.userModel.findById(id).exec();
  }


  async findByEmail(email: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ email }).exec();
  }

  
  async findByUsername(username: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ username }).exec();
  }


  async update(userId: string, updateData: Partial<User>): Promise<UserDocument> {
    const updatedUser = await this.userModel
      .findByIdAndUpdate(userId, updateData, { new: true })
      .exec();
    
    if (!updatedUser) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }
    
    return updatedUser;
  }


  async updateProfilePicture(
    userId: string, 
    profilePictureUrl: string, 
    profilePicturePublicId?: string
  ): Promise<UserDocument> {
    const updateData: any = { profilePicture: profilePictureUrl };
    
    if (profilePicturePublicId) {
      updateData.profilePicturePublicId = profilePicturePublicId;
    }
    
    return this.update(userId, updateData);
  }

  async removeProfilePicture(userId: string): Promise<UserDocument> {
    return this.update(userId, {
      profilePicture: undefined,
      profilePicturePublicId: undefined
    });
  }


  async getProfile(userId: string) {
    const user = await this.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    
    return {
      id: user._id,
      username: user.username,
      email: user.email,
      displayName: user.displayName || user.username,
      bio: user.bio || '',
      profilePicture: user.profilePicture,
      role: user.role,
      hasBlog: !!user.tenantId,
      lastLoginAt: user.lastLoginAt,
    };
  }


  async updateLastLogin(userId: string): Promise<void> {
    await this.userModel.findByIdAndUpdate(userId, {
      lastLoginAt: new Date()
    }).exec();
  }

  async isUsernameAvailable(username: string, excludeUserId?: string): Promise<boolean> {
    const query: any = { username };
    if (excludeUserId) {
      query._id = { $ne: excludeUserId };
    }
    
    const existingUser = await this.userModel.findOne(query).exec();
    return !existingUser;
  }

 
  async isEmailAvailable(email: string, excludeUserId?: string): Promise<boolean> {
    const query: any = { email };
    if (excludeUserId) {
      query._id = { $ne: excludeUserId };
    }
    
    const existingUser = await this.userModel.findOne(query).exec();
    return !existingUser;
  }


  async updateTenant(userId: string, tenantId: string ): Promise<UserDocument> {
    return this.update(userId, { tenantId });
  }


  async create(userData: Partial<User>): Promise<UserDocument> {
    const user = new this.userModel(userData);
    return user.save();
  }


  async searchUsers(query: string, limit: number = 10): Promise<UserDocument[]> {
    return this.userModel
      .find({
        $or: [
          { username: { $regex: query, $options: 'i' } },
          { email: { $regex: query, $options: 'i' } },
          { displayName: { $regex: query, $options: 'i' } },
        ]
      })
      .select('-passwordHash')
      .limit(limit)
      .exec();
  }

  // Add this method to find or create Google users
async findOrCreateFromGoogle(googleData: {
  email: string;
  firstName: string;
  lastName: string;
  picture: string;
  username: string;
  displayName: string;
}): Promise<UserDocument> {
  let user = await this.findByEmail(googleData.email);
  
  if (user) {
    // Update existing user with latest Google data
    user.firstName = googleData.firstName;
    user.lastName = googleData.lastName;
    user.picture = googleData.picture;
    user.displayName = googleData.displayName;
    user.profilePicture = googleData.picture; // Keep both in sync
    user.lastLoginAt = new Date();
    user.loginCount = (user.loginCount || 0) + 1;
    
    return user.save();
  }
  
  // Create new user
  const newUser = new this.userModel({
    email: googleData.email,
    username: googleData.username,
    firstName: googleData.firstName,
    lastName: googleData.lastName,
    picture: googleData.picture,
    profilePicture: googleData.picture, // Sync both picture fields
    displayName: googleData.displayName,
    isEmailVerified: true,
    role: 'reader',
    loginCount: 1,
    lastLoginAt: new Date(),
  });
  
  return newUser.save();
}

async syncGooglePicture(userId: string, googlePictureUrl: string): Promise<UserDocument> {
  return this.update(userId, {
    picture: googlePictureUrl,
    profilePicture: googlePictureUrl, 
  });
}


async isGoogleUser(userId: string): Promise<boolean> {
  const user = await this.findById(userId);
  return user ? !user.passwordHash : false;
}
}