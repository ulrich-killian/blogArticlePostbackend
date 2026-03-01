import {
  Injectable,
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import slugify from 'slugify';

import { Blog } from './blog.schema';
import { CreateBlogDto } from './dto/create-blog.dto';

import { v2 as cloudinary } from 'cloudinary';
import { Readable } from 'stream';
import { Types } from 'mongoose';
import { NotificationService } from '../notifications/notification.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { UpdateBlogDto } from './dto/update-blog.dto';
@Injectable()
export class BlogsService {
  constructor(
    @InjectModel(Blog.name)
    private readonly blogModel: Model<Blog>,
    @InjectModel('Post')
    private readonly postModel: Model<any>,
    private notificationService: NotificationService, 
  private eventEmitter: EventEmitter2,
  ) {}

  async createBlog(
    dto: CreateBlogDto & { authorName: string },
    tenantId: string,
    authorId: string,
  ) {
    try {
      if (!tenantId || tenantId === 'null') {
        throw new BadRequestException('Invalid Tenant ID. Please re-login.');
      }
      
      const existingBlog = await this.blogModel.findOne({ tenantId });
      if (existingBlog) {
        throw new BadRequestException('You already have a blog');
      }

      const slug = slugify(dto.title, { lower: true, strict: true });
      const slugExists = await this.blogModel.findOne({
        tenantId,
        slug,
      });
      if (slugExists) {
        throw new BadRequestException('Blog slug already exists');
      }

      const blog = new this.blogModel({
        ...dto,
        slug,
        tenantId,
        authorId,
      });

      return await blog.save();
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      console.error(error);
      throw new InternalServerErrorException('Failed to create blog');
    }
  }

  async getBlogByTenant(tenantId: string): Promise<Blog | null> {
    return this.blogModel.findOne({ tenantId }).exec();
  }

  async findAllPublished() {
    return this.blogModel.find().sort({ createdAt: -1 }).exec();
  }

  async getBlogBySlug(identifier: string) {
    const blog = await this.blogModel.findOne({
      $or: [
        { slug: identifier },
        { authorName: identifier }
      ]
    }).lean();
  
    if (!blog) {
      throw new NotFoundException(`Blog or User "${identifier}" not found`);
    }  
    const tenantObjectId = new Types.ObjectId(blog.tenantId);
  
    const posts = await this.postModel
      .find({
        tenantId: tenantObjectId,
        status: 'published',
      })
      .sort({ createdAt: -1 })
      .lean();
  
    return {
      ...blog,
      posts: posts || [],
    };
  }

  async getPostsByCategory(slug: string, category: string) {
    const blog = await this.blogModel.findOne({ slug }).lean();

    if (!blog) {
      throw new NotFoundException(`Blog with slug "${slug}" not found`);
    }

    const tenantObjectId = new Types.ObjectId(blog.tenantId);

    const posts = await this.postModel
      .find({
        tenantId: tenantObjectId,
        status: 'published',
        categories: category,
      })
      .sort({ createdAt: -1 })
      .lean();

    return {
      blog: {
        title: blog.title,
        slug: blog.slug,
        categories: blog.categories,
      },
      category,
      posts: posts || [],
      count: posts.length,
    };
  }

  async getBlogCategories(slug: string) {
    const blog = await this.blogModel.findOne({ slug }).lean();

    if (!blog) {
      throw new NotFoundException(`Blog with slug "${slug}" not found`);
    }

    const tenantObjectId = new Types.ObjectId(blog.tenantId);

    const categoryStats = await this.postModel.aggregate([
      {
        $match: {
          tenantId: tenantObjectId,
          status: 'published',
          categories: { $exists: true, $ne: [] },
        },
      },
      { $unwind: '$categories' },
      {
        $group: {
          _id: '$categories',
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
    ]);

    return {
      blogTitle: blog.title,
      categories: categoryStats.map((stat) => ({
        name: stat._id,
        postCount: stat.count,
      })),
    };
  }

  async updateBlogImages(
    tenantId: string,
    data: {
      coverImage?: string;
      profileImage?: string;
    },
  ) {
    const blog = await this.blogModel.findOne({ tenantId });

    if (!blog) {
      throw new BadRequestException('Blog not found');
    }

    if (data.coverImage !== undefined) {
      blog.coverImage = data.coverImage;
    }

    if (data.profileImage !== undefined) {
      blog.profileImage = data.profileImage;
    }

    return blog.save();
  }

  async deleteBlog(id: string, tenantId: string) {
    const result = await this.blogModel.deleteOne({ _id: id, tenantId }).exec();

    if (result.deletedCount === 0) {
      throw new NotFoundException(
        'Blog not found or you do not have permission to delete it',
      );
    }

    return { success: true, message: 'Blog deleted successfully' };
  }

  async uploadBlogImage(file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    try {
      const uploadResult = await new Promise<any>((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          { folder: 'blogs' },
          (error, result) => {
            if (error) return reject(error);
            resolve(result);
          },
        );

        Readable.from(file.buffer).pipe(uploadStream);
      });

      return {
        success: true,
        data: {
          url: uploadResult.secure_url,
        },
      };
    } catch (error) {
      console.error(error);
      throw new InternalServerErrorException('Image upload failed');
    }
  }

  async subscribe(blogId: string, userId: string) {
    const updatedBlog = await this.blogModel.findOneAndUpdate(
      {
        _id: blogId,
        subscriberIds: { $ne: userId },
      },
      {
        $addToSet: { subscriberIds: userId },
        $inc: { subscriberCount: 1 },
      },
      { new: true, runValidators: true },
    );

    if (!updatedBlog) {
      const blogExists = await this.blogModel.exists({ _id: blogId });
      if (!blogExists) {
        throw new NotFoundException('Blog not found');
      }
      throw new BadRequestException('Already subscribed');
    }
    if (updatedBlog.authorId !== userId) {
      await this.notificationService.createNotification({
        recipientId: updatedBlog.authorId.toString(),
        actorId: userId,
        type: 'subscribe',
        blogId: blogId,
        content: `started following your blog "${updatedBlog.title}"`,
      });
      
      this.eventEmitter.emit('notification.created', {
        recipientId: updatedBlog.authorId.toString(),
        actorId: userId,
        type: 'subscribe',
        blogId,
      });
    }

    return {
      success: true,
      message: 'Successfully subscribed to blog',
      subscriberCount: updatedBlog.subscriberCount,
      isSubscribed: true,
    };
  }

  async notifySubscribersAboutNewPost(blogId: string, newPost: any) {
    const blog = await this.blogModel
      .findById(blogId)
      .select('+subscriberIds authorId');
  
    if (!blog || !blog.subscriberIds || blog.subscriberIds.length === 0) {
      return;
    }
  
    await Promise.all(
      blog.subscriberIds.map((subscriberId) =>
        this.notificationService.createNotification({
          recipientId: subscriberId,
          actorId: blog.authorId,
          type: 'post',
          blogId: blog._id.toString(),
          postId: newPost._id.toString(),
          content: `published a new post: "${newPost.title}"`,
        }),
      ),
    );
  }
  

  async updateNotificationPreferences(
    blogId: string,
    authorId: string,
    preferences: { newPosts?: boolean; comments?: boolean; likes?: boolean }
  ) {
    const blog = await this.blogModel.findOne({ _id: blogId, authorId });
    
    if (!blog) {
      throw new NotFoundException('Blog not found');
    }
    
    blog.notificationPreferences = {
      ...blog.notificationPreferences,
      ...preferences
    };
    
    await blog.save();
    
    return {
      message: 'Notification preferences updated',
      preferences: blog.notificationPreferences
    };
  }

  async getNotificationPreferences(blogId: string, authorId: string) {
    const blog = await this.blogModel
      .findOne({ _id: blogId, authorId })
      .select('notificationPreferences');
    
    if (!blog) {
      throw new NotFoundException('Blog not found');
    }
    
    return {
      preferences: blog.notificationPreferences || {
        newPosts: true,
        comments: true,
        likes: true
      }
    };
  }

  async unsubscribe(blogId: string, userId: string) {
    const updatedBlog = await this.blogModel.findOneAndUpdate(
      {
        _id: blogId,
        subscriberIds: userId,
        subscriberCount: { $gt: 0 }, 
      },
      {
        $pull: { subscriberIds: userId },
        $inc: { subscriberCount: -1 },
      },
      { new: true },
    );

    if (!updatedBlog) {
      throw new BadRequestException('Not subscribed or blog not found');
    }

    return {
      success: true,
      message: 'Successfully unsubscribed from blog',
      subscriberCount: updatedBlog.subscriberCount,
      isSubscribed: false,
    };
  }

  async getSubscriptionStatus(blogId: string, userId: string) {
    const blog = await this.blogModel
      .findById(blogId)
      .select('+subscriberIds subscriberCount');

    if (!blog) {
      throw new NotFoundException('Blog not found');
    }

    return {
      isSubscribed: blog.subscriberIds.includes(userId),
      subscriberCount: blog.subscriberCount,
    };
  }

  async getSubscriberCount(blogId: string) {
    const blog = await this.blogModel
      .findById(blogId)
      .select('subscriberCount');

    if (!blog) {
      throw new NotFoundException('Blog not found');
    }

    return {
      subscriberCount: blog.subscriberCount,
    };
  }

  async getPopularBlogs(limit: number = 10) {
    return this.blogModel
      .find({ isPrivate: false })
      .sort({ subscriberCount: -1 })
      .limit(limit)
      .select('title slug description coverImage subscriberCount authorName')
      .lean()
      .exec();
  }

  async getUserSubscriptions(userId: string) {
    const blogs = await this.blogModel
      .find({ subscriberIds: userId })
      .select('title slug description coverImage subscriberCount authorName')
      .sort({ createdAt: -1 })
      .lean()
      .exec();

    return {
      subscriptions: blogs,
      total: blogs.length,
    };
  }

  async updateMyBlog(tenantId: string, dto: UpdateBlogDto) {
    const blog = await this.blogModel.findOne({ tenantId });
    if (!blog) throw new NotFoundException('Blog not found');
  

    if (!dto.slug && !dto.title) {
      dto.slug = blog.slug;
    }
  

    if (dto.slug && dto.slug !== blog.slug) {
      const slugExists = await this.blogModel.findOne({ 
        slug: dto.slug,
        _id: { $ne: blog._id } 
      });
      if (slugExists) throw new BadRequestException('This URL slug is already taken');
    }
  
    if (dto.title && !dto.slug) {
      const newSlug = slugify(dto.title, { lower: true, strict: true });
      const slugExists = await this.blogModel.findOne({ slug: newSlug, _id: { $ne: blog._id } });
      dto.slug = slugExists ? `${newSlug}-${Date.now()}` : newSlug;
    }
  

    Object.assign(blog, dto);
    

    if (!blog.slug) {
      blog.slug = slugify(blog.title, { lower: true, strict: true });
    }
  
    return await blog.save();
  }
}

