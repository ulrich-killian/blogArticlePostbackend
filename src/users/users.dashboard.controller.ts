import { 
  Controller, Get, Patch, UseGuards, Req, 
  UseInterceptors, UploadedFile, BadRequestException,
  Body, ParseFilePipe, MaxFileSizeValidator, FileTypeValidator,
  Logger,
  NotFoundException 
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TenantService } from '../tenants/tenant.service';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { UsersService } from './users.service';

@Controller('user')
@UseGuards(JwtAuthGuard)
export class DashboardController {
  private readonly logger = new Logger(DashboardController.name);

  constructor(
    private readonly tenantService: TenantService,
    private readonly cloudinaryService: CloudinaryService,
    private readonly usersService: UsersService,
  ) {}

  @Get('me')
  async getCurrentUser(@Req() req) {
    try {
      const userId = req.user.sub || req.user.userId;
      const user = await this.usersService.findById(userId);
      
      if (!user) {
        throw new NotFoundException('User not found');
      }
      
      return {
        success: true,
        data: {
          id: user._id.toString(),
          username: user.username,
          email: user.email,
          displayName: user.displayName || user.username,
          bio: user.bio || '',
          profilePicture: user.profilePicture,
          role: user.role,
          hasBlog: !!user.tenantId,
          lastLoginAt: user.lastLoginAt,
        }
      };
    } catch (error) {
      this.logger.error('Get current user error:', error.message);
      throw error;
    }
  }

  @Patch('profile/picture')
  @UseInterceptors(FileInterceptor('profilePicture'))
  async updateProfilePicture(
    @Req() req, 
    @UploadedFile(
      new ParseFilePipe({
        fileIsRequired: true,
        validators: [
          new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 }), 
          new FileTypeValidator({ fileType: /(jpg|jpeg|png|gif|webp)$/ }),
        ],
      })
    ) file: Express.Multer.File
  ) {
    try {
      this.logger.log(`Uploading profile picture for user: ${req.user?.userId || req.user?.sub}`);
      
      const userId = req.user.sub || req.user.userId;
      
      const currentUser = await this.usersService.findById(userId);
      if (!currentUser) {
        throw new BadRequestException('User not found');
      }
      
      if (currentUser.profilePicturePublicId) {
        try {
          await this.cloudinaryService.deleteImage(currentUser.profilePicturePublicId);
          this.logger.log(`Deleted old profile picture: ${currentUser.profilePicturePublicId}`);
        } catch (deleteError) {
          this.logger.warn(`Failed to delete old profile picture: ${deleteError.message}`);
        }
      }


      this.logger.log(`Uploading new profile picture: ${file.originalname} (${file.size} bytes)`);
      const upload = await this.cloudinaryService.uploadImage(file, 'user-profiles');
      
      await this.usersService.updateProfilePicture(
        userId, 
        upload.url, 
        upload.publicId
      );

      return { 
        success: true,
        message: 'Profile picture updated successfully',
        data: {
          profilePicture: upload.url
        }
      };
    } catch (error) {
      this.logger.error('Profile picture upload error:', error.message, error.stack);
      throw new BadRequestException(`Profile upload failed: ${error.message}`);
    }
  }

  @Patch('profile/picture/remove')
  async removeProfilePicture(@Req() req) {
    try {
      const userId = req.user.sub || req.user.userId;
      const currentUser = await this.usersService.findById(userId);
      
      if (currentUser?.profilePicturePublicId) {
        try {
          await this.cloudinaryService.deleteImage(currentUser.profilePicturePublicId);
          this.logger.log(`Deleted profile picture: ${currentUser.profilePicturePublicId}`);
        } catch (deleteError) {
          this.logger.warn(`Failed to delete profile picture: ${deleteError.message}`);
        }
      }
      
      await this.usersService.removeProfilePicture(userId);
      
      return {
        success: true,
        message: 'Profile picture removed successfully'
      };
    } catch (error) {
      this.logger.error('Remove profile picture error:', error.message);
      throw new BadRequestException('Failed to remove profile picture');
    }
  }

  @Patch('profile')
  async updateProfile(
    @Req() req,
    @Body() body: { 
      displayName?: string;
      bio?: string;
      username?: string;
      email?: string;
    }
  ) {
    try {
      const userId = req.user.sub || req.user.userId;
      const updateData: any = {};
      
      // Validate username if changing
      if (body.username && body.username !== req.user.username) {
        const isAvailable = await this.usersService.isUsernameAvailable(body.username, userId);
        if (!isAvailable) {
          throw new BadRequestException('Username already taken');
        }
        updateData.username = body.username;
      }
      
      // Validate email if changing
      if (body.email && body.email !== req.user.email) {
        const isAvailable = await this.usersService.isEmailAvailable(body.email, userId);
        if (!isAvailable) {
          throw new BadRequestException('Email already registered');
        }
        updateData.email = body.email;
      }
      
      // Update other fields
      if (body.displayName !== undefined) updateData.displayName = body.displayName;
      if (body.bio !== undefined) updateData.bio = body.bio;
      
      const updatedUser = await this.usersService.update(userId, updateData);
      
      return {
        success: true,
        message: 'Profile updated successfully',
        data: {
          username: updatedUser.username,
          email: updatedUser.email,
          displayName: updatedUser.displayName,
          bio: updatedUser.bio,
          profilePicture: updatedUser.profilePicture
        }
      };
    } catch (error) {
      this.logger.error('Update profile error:', error.message);
      throw error;
    }
  }

  // Get user profile - THIS WILL BE ACCESSIBLE AT /user/profile
  @Get('profile')
  async getProfile(@Req() req) {
    const userId = req.user.sub || req.user.userId;
    const profile = await this.usersService.getProfile(userId);
    
    return {
      success: true,
      data: profile
    };
  }

  // Get dashboard overview - THIS WILL BE ACCESSIBLE AT /user/
  @Get()
  async getDashboard(@Req() req) {
    const userId = req.user.sub || req.user.userId;
    
    // Get user profile
    const userProfile = await this.usersService.getProfile(userId);
    
    // Get blog info
    const blog = await this.tenantService.findByOwner(userId) as any;

    return {
      success: true,
      data: {
        user: userProfile,
        blog: blog ? {
          id: blog._id,
          name: blog.name,
          slug: blog.slug,
          description: blog.description || '',
          createdAt: blog.createdAt, 
          url: `/public/${blog.slug}`,
          postCount: blog.postCount || 0,
        } : null,
        quickActions: blog ? [
          {
            title: 'Write New Post',
            description: 'Share your thoughts',
            path: '/posts',
            method: 'POST',
            icon: ''
          },
          {
            title: 'View Your Blog',
            description: 'See how others see it',
            path: `/public/${blog.slug}`,
            method: 'GET',
            icon: '👁️'
          },
          {
            title: 'Update Profile',
            description: 'Change your profile information',
            path: '/dashboard/profile',
            method: 'PATCH',
            icon: '👤'
          },
        ] : [
          {
            title: 'Create Your Blog',
            description: 'Start publishing your ideas',
            path: '/tenants/create',
            method: 'POST',
            icon: '',
            highlight: true
          },
          {
            title: 'Update Profile Picture',
            description: 'Upload your profile picture',
            path: '/dashboard/profile/picture',
            method: 'PATCH',
            icon: ''
          },
          {
            title: 'Explore Blogs',
            description: 'Read amazing content',
            path: '/public/blogs',
            method: 'GET',
            icon: ''
          },
        ],
      }
    };
  }
}