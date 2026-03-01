import {
  Controller, Get, Post, Body, Patch, Param, Delete,
  UseGuards, Req, ForbiddenException, BadRequestException,
  UseInterceptors, UploadedFile, ParseFilePipe,
  MaxFileSizeValidator, FileTypeValidator, Logger, NotFoundException, UnauthorizedException
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { PostService } from './post.service';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { HasBlogGuard } from '../common/guards/has-blog.guard';
import { CloudinaryService } from '../cloudinary/cloudinary.service';

@Controller('posts')
@UseGuards(JwtAuthGuard, HasBlogGuard)
export class PostController {
  private readonly logger = new Logger(PostController.name);

  constructor(
    private readonly postService: PostService,
    private readonly cloudinaryService: CloudinaryService
  ) { }

  @Post('thumbnail')
  @UseGuards(JwtAuthGuard, HasBlogGuard)
  @UseInterceptors(FileInterceptor('thumbnail'))
  async uploadThumbnail(
    @UploadedFile(
      new ParseFilePipe({
        fileIsRequired: true,
        validators: [
          new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 }), // 5MB
          new FileTypeValidator({ fileType: /^image\/(jpeg|png|gif|webp)$/ }),
        ],
      })
    ) file: Express.Multer.File,
    @Req() req
  ) {
    try {
      this.logger.log(`Uploading thumbnail for user: ${req.user?.userId || req.user?.sub}`);

      const upload = await this.cloudinaryService.uploadImage(file, 'blog-posts');

      this.logger.log(`Thumbnail uploaded successfully: ${upload.url}`);

      return {
        success: true,
        message: 'Thumbnail uploaded successfully',
        data: {
          url: upload.url,
          publicId: upload.publicId
        }
      };
    } catch (error) {
      this.logger.error('Thumbnail upload failed:', error.message, error.stack);
      throw new BadRequestException(`Upload failed: ${error.message}`);
    }
  }

  @Post()
  async create(@Body() createPostDto: CreatePostDto, @Req() req) {
    try {
      this.logger.log(`Creating post for user: ${req.user?.userId || req.user?.sub}`);

      if (!createPostDto.title || !createPostDto.content) {
        throw new BadRequestException('Title and content are required');
      }

      const authorId = createPostDto.authorId || req.user.sub || req.user.userId;
      const tenantId = req.user.tenantId;

      if (!authorId) throw new BadRequestException('Author ID is required');
      if (!tenantId) throw new ForbiddenException('No blog/tenant associated with this account.');

      const result = await this.postService.create(createPostDto, authorId, tenantId);

      this.logger.log(`Post created successfully: ${result._id}`);

      return {
        success: true,
        message: 'Post created successfully',
        data: result
      };
    } catch (error) {
      this.logger.error('Create Post Error:', error.message, error.stack);
      throw error;
    }
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() updatePostDto: UpdatePostDto,
    @Req() req
  ) {
    try {
      this.logger.log(`Updating post: ${id}`);

      // Validation - check categories instead of tags
      if (updatePostDto.categories && !Array.isArray(updatePostDto.categories)) {
        throw new BadRequestException('Categories must be an array');
      }

      const userId = req.user.sub || req.user.userId;
      const tenantId = req.user.tenantId;

      if (!tenantId) throw new ForbiddenException('Access denied: Missing tenant context.');

      // Get current post to check for existing thumbnail logic and authorization
      const currentPost = await this.postService.findOne(id);
      if (!currentPost) {
        throw new NotFoundException('Post not found');
      }

      // Check authorization BEFORE any operations
      const userIdObj = new (require('mongoose').Types.ObjectId)(userId);
      const tenantIdObj = new (require('mongoose').Types.ObjectId)(tenantId);

      if (!currentPost.authorId.equals(userIdObj)) {
        throw new ForbiddenException('You do not have permission to update this post');
      }

      if (!currentPost.tenantId.equals(tenantIdObj)) {
        throw new ForbiddenException('You do not have permission to update this post');
      }

      // Store old thumbnail info for potential cleanup
      const oldThumbnailPublicId = currentPost.thumbnailPublicId;
      let shouldDeleteOldThumbnail = false;

      // Check if we need to delete old thumbnail
      if (updatePostDto.thumbnailPublicId && oldThumbnailPublicId) {
        if (updatePostDto.thumbnailPublicId !== oldThumbnailPublicId) {
          shouldDeleteOldThumbnail = true;
          this.logger.log(`New thumbnail detected. Will delete old thumbnail after update: ${oldThumbnailPublicId}`);
        }
      } else if (updatePostDto.thumbnail === null && oldThumbnailPublicId) {
        shouldDeleteOldThumbnail = true;
        this.logger.log(`Thumbnail removal detected. Will delete old thumbnail after update: ${oldThumbnailPublicId}`);
      }

      // Clean undefined fields
      const updateData: UpdatePostDto = { ...updatePostDto };
      Object.keys(updateData).forEach(key => {
        if (updateData[key] === undefined) delete updateData[key];
      });

      // Perform the update first
      const result = await this.postService.update(id, updateData, userId, tenantId);

      // Delete old thumbnail only after successful update
      if (shouldDeleteOldThumbnail && oldThumbnailPublicId) {
        try {
          await this.cloudinaryService.deleteImage(oldThumbnailPublicId);
          this.logger.log(`Successfully deleted old thumbnail: ${oldThumbnailPublicId}`);
        } catch (e) {
          this.logger.warn(`Failed to delete old thumbnail: ${e.message}`);
        }
      }

      return {
        success: true,
        message: 'Post updated successfully',
        data: result
      };
    } catch (error) {
      this.logger.error('Update Post Error:', error.message, error.stack);
      throw error;
    }
  }

  @Get()
  async findAll(@Req() req) {
    const tenantId = req.user.tenantId;
    if (!tenantId) throw new ForbiddenException('Access denied: No tenant ID found in token.');

    // This should still filter by tenant for dashboard view
    const posts = await this.postService.findAllByTenant(tenantId);
    return { success: true, count: posts.length, data: posts };
  }

@Post(':postId/like')
  @UseGuards(JwtAuthGuard) 
  async toggleLike(@Param('postId') postId: string, @Req() req) {
    const userId = req.user.sub || req.user.userId;
    return this.postService.toggleLike(postId, userId);
  }

  @Get(':identifier')
  async findOne(@Param('identifier') identifier: string, @Req() req) {
    const userId = req.user?.sub || req.user?.userId;
    const tenantId = req.user?.tenantId;

    // Find the post
    const post = await this.postService.findByIdOrSlug(identifier);

    if (!post) throw new NotFoundException('Post not found');

    // For draft posts, enforce stricter security
    if (post.status === 'draft') {
      if (!userId) {
        throw new ForbiddenException('Authentication required to view draft posts');
      }

      // Check both author AND tenant membership
      const userIdObj = new (require('mongoose').Types.ObjectId)(userId);
      const tenantIdObj = new (require('mongoose').Types.ObjectId)(tenantId);

      if (!post.authorId.equals(userIdObj)) {
        throw new ForbiddenException('You do not have permission to view this draft');
      }

      if (tenantId && !post.tenantId.equals(tenantIdObj)) {
        throw new ForbiddenException('You do not have permission to view this draft');
      }
    }

    return { success: true, data: post };
  }

  @Post(':postId/view')
  @UseGuards(JwtAuthGuard)
  async incrementView(@Param('postId') postId: string, @Req() req) {
    const userId = req.user.sub || req.user.userId;
    if (!userId) {
      throw new UnauthorizedException('User ID not found in token');
    }
    return this.postService.incrementViews(postId, userId);
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @Req() req) {
    try {
      const userId = req.user.sub || req.user.userId;
      const tenantId = req.user.tenantId;

      if (!tenantId) throw new ForbiddenException('Access denied: Missing tenant context.');

      const post = await this.postService.findOne(id);
      if (!post) {
        throw new NotFoundException('Post not found');
      }

      const userIdObj = new (require('mongoose').Types.ObjectId)(userId);
      const tenantIdObj = new (require('mongoose').Types.ObjectId)(tenantId);

      if (!post.authorId.equals(userIdObj)) {
        throw new ForbiddenException('You do not have permission to delete this post');
      }

      if (!post.tenantId.equals(tenantIdObj)) {
        throw new ForbiddenException('You do not have permission to delete this post');
      }

      if (post?.thumbnailPublicId) {
        try {
          await this.cloudinaryService.deleteImage(post.thumbnailPublicId);
          this.logger.log(`Successfully deleted thumbnail: ${post.thumbnailPublicId}`);
        } catch (e) {
          this.logger.warn(`Failed to delete thumbnail: ${e.message}`);
        }
      }

      await this.postService.remove(id, userId, tenantId);

      return { success: true, message: 'Post deleted successfully' };
    } catch (error) {
      this.logger.error('Delete Post Error:', error.message, error.stack);
      throw error;
    }
  }
}