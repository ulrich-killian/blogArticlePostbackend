import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Post, PostDocument } from './post.schema';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { NotificationService } from '../notifications/notification.service';
import { EventEmitter2 } from '@nestjs/event-emitter';


@Injectable()
export class PostService {
  constructor(
    @InjectModel(Post.name) private postModel: Model<PostDocument>,
    private notificationService: NotificationService,
  private eventEmitter: EventEmitter2,
  ) {}

  private normalizeCategories(categories: string[]): string[] {
    if (!Array.isArray(categories)) return [];
    
    return categories
      .map(cat => String(cat).toLowerCase().trim())
      .filter(cat => cat.length > 0)
      .filter((cat, index, self) => self.indexOf(cat) === index);
  }

  async create(
    createPostDto: CreatePostDto,
    userId: string,
    tenantId: string
  ): Promise<PostDocument> {
    let slug = createPostDto.slug;
    if (!slug) {
      slug = createPostDto.title
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '');
    }

    let uniqueSlug = slug;
    let counter = 1;

    while (await this.postModel.findOne({
      slug: uniqueSlug,
      tenantId: new Types.ObjectId(tenantId)
    })) {
      uniqueSlug = `${slug}-${counter}`;
      counter++;
    }

    let excerpt = createPostDto.excerpt;
    if (!excerpt) {
      excerpt = createPostDto.content
        .substring(0, 200)
        .replace(/<[^>]*>/g, '')
        .trim();
    }

    let seoDescription = createPostDto.seoDescription;
    if (!seoDescription) {
      seoDescription = createPostDto.content
        .substring(0, 160)
        .replace(/<[^>]*>/g, '')
        .trim();
    }

    const post = new this.postModel({
      ...createPostDto,
      slug: uniqueSlug,
      commentsCount: 0,
      views: 0,
      commentIds: [],
      excerpt,
      seoDescription,
      categories: this.normalizeCategories(createPostDto.categories || []),
      authorId: new Types.ObjectId(userId),
      tenantId: new Types.ObjectId(tenantId),
      publishedAt: createPostDto.status === 'published' ? new Date() : undefined,
    });

    return post.save();
  }

  // RESTORED: findOne
  async findOne(id: string): Promise<PostDocument | null> {
    if (!Types.ObjectId.isValid(id)) return null;
    return this.postModel.findById(id)
      .populate('authorId', 'username email profilePicture')
      .exec();
  }

  // RESTORED: findBySlugPublic
  async findBySlugPublic(slug: string): Promise<PostDocument | null> {
    return this.postModel.findOne({ slug, status: 'published' })
      .populate('authorId', 'username displayName profilePicture bio')
      .populate('tenantId', 'name slug')
      .exec();
  }

  // RESTORED: countAllPublished
  async countAllPublished(): Promise<number> {
    return this.postModel.countDocuments({ status: 'published' }).exec();
  }

  // RESTORED: countPublishedByTenant
  async countPublishedByTenant(tenantId: string): Promise<number> {
    if (!Types.ObjectId.isValid(tenantId)) return 0;
    return this.postModel.countDocuments({
      tenantId: new Types.ObjectId(tenantId),
      status: 'published'
    }).exec();
  }

  // RESTORED: getCategories
  async getCategories(tenantId: string): Promise<string[]> {
    if (!Types.ObjectId.isValid(tenantId)) return [];
    return this.postModel.distinct('categories', {
      tenantId: new Types.ObjectId(tenantId),
      status: 'published'
    });
  }

async toggleLike(postId: string, userId: string) {
  const post = await this.postModel.findById(postId);
  
  if (!post) {
    throw new NotFoundException('Post not found');
  }

  // 1. Ensure the array exists
  if (!post.likedBy) {
    post.likedBy = [];
  }

  const userIndex = post.likedBy.findIndex(id => id.toString() === userId.toString());
  const wasLiked = userIndex !== -1;

  if (!wasLiked) {
    post.likedBy.push(userId);
  } else {
    post.likedBy.splice(userIndex, 1);
  }

  post.likes = post.likedBy.length;
  
  await post.save();

  if (!wasLiked && post.authorId.toString() !== userId) {
    await this.notificationService.createNotification({
      recipientId: post.authorId.toString(),
      actorId: userId,
      type: 'like',
      postId: postId,
      content: `liked your post "${post.title?.substring(0, 30)}..."`,
    });
  }

  return {
    liked: !wasLiked,
    likes: post.likes,
  };
}

  // RESTORED: search
  async search(query: string, tenantId: string, skip = 0, limit = 10): Promise<PostDocument[]> {
    if (!Types.ObjectId.isValid(tenantId)) return [];
    const searchRegex = new RegExp(query, 'i');
    return this.postModel.find({
      tenantId: new Types.ObjectId(tenantId),
      status: 'published',
      $or: [
        { title: searchRegex }, 
        { content: searchRegex }, 
        { categories: searchRegex }
      ]
    })
    .sort({ publishedAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate('authorId', 'username email profilePicture displayName bio')
    .populate('tenantId', 'name slug')
    .exec();
  }

  async searchCount(query: string, tenantId: string): Promise<number> {
    if (!Types.ObjectId.isValid(tenantId)) return 0;
    const searchRegex = new RegExp(query, 'i');
    return this.postModel.countDocuments({
      tenantId: new Types.ObjectId(tenantId),
      status: 'published',
      $or: [{ title: searchRegex }, { content: searchRegex }]
    }).exec();
  }

  async incrementViews(postId: string, userId?: string): Promise<any> {
    try {
      if (!Types.ObjectId.isValid(postId)) {
        throw new BadRequestException('Invalid post ID format');
      }

      const post = await this.postModel.findById(postId);
      if (!post) {
        throw new NotFoundException('Post not found');
      }
      
      if (!userId) {
        post.views += 1;
        await post.save();
        return { 
          success: true, 
          views: post.views, 
          isNewView: true,
          message: 'View counted (anonymous user)' 
        };
      }
      
      if (!Types.ObjectId.isValid(userId)) {
        throw new BadRequestException('Invalid user ID format');
      }
      
      const userObjectId = new Types.ObjectId(userId);
      const authorObjectId = post.authorId;
      
      if (userObjectId.equals(authorObjectId)) {
        return { 
          success: true, 
          views: post.views, 
          isNewView: false,
          message: 'Author viewing own post - view not counted' 
        };
      }
      
      const hasViewed = post.viewedBy.some(viewerId => 
        viewerId && viewerId.equals(userObjectId)
      );
      
      if (hasViewed) {
        return { 
          success: true, 
          views: post.views, 
          isNewView: false,
          message: 'User already viewed this post' 
        };
      }
      
      post.viewedBy.push(userObjectId);
      post.views += 1;
      await post.save();
      
      return { 
        success: true, 
        views: post.views, 
        isNewView: true,
        message: 'View counted successfully' 
      };
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(`Failed to increment views: ${error.message}`);
    }
  }

  async update(
    id: string,
    updatePostDto: UpdatePostDto,
    userId: string,
    tenantId: string
  ): Promise<PostDocument> {
    const post = await this.postModel.findById(id);

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    const userIdObj = new Types.ObjectId(userId);
    const tenantIdObj = new Types.ObjectId(tenantId);

    if (!post.authorId.equals(userIdObj)) {
      throw new ForbiddenException('You do not have permission to update this post');
    }
    
    if (!post.tenantId.equals(tenantIdObj)) {
      throw new ForbiddenException('You do not have permission to update this post');
    }

    if (updatePostDto.title && updatePostDto.title !== post.title && !updatePostDto.slug) {
      const newSlug = updatePostDto.title
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '');

      let uniqueSlug = newSlug;
      let counter = 1;

      while (await this.postModel.findOne({
        slug: uniqueSlug,
        tenantId: post.tenantId,
        _id: { $ne: new Types.ObjectId(id) }
      })) {
        uniqueSlug = `${newSlug}-${counter}`;
        counter++;
      }

      updatePostDto.slug = uniqueSlug;
    }

    if (updatePostDto.content && !updatePostDto.excerpt) {
      updatePostDto.excerpt = updatePostDto.content
        .substring(0, 200)
        .replace(/<[^>]*>/g, '')
        .trim();
    }

    if (updatePostDto.content && !updatePostDto.seoDescription) {
      updatePostDto.seoDescription = updatePostDto.content
        .substring(0, 160)
        .replace(/<[^>]*>/g, '')
        .trim();
    }

    if (updatePostDto.categories !== undefined) {
      updatePostDto.categories = this.normalizeCategories(updatePostDto.categories);
    }

    const updateData: any = { ...updatePostDto };

    if (updatePostDto.status === 'published' && post.status !== 'published') {
      updateData.publishedAt = new Date();
    } else if (updatePostDto.status === 'draft') {
      updateData.publishedAt = null;
    }

    const updatedPost = await this.postModel.findByIdAndUpdate(
      id,
      updateData,
      { new: true }
    );

    if (!updatedPost) {
      throw new NotFoundException('Post not found after update');
    }

    return updatedPost;
  }

  async findAllByTenant(tenantId: string): Promise<PostDocument[]> {
    if (!Types.ObjectId.isValid(tenantId)) return [];
    return this.postModel
      .find({ tenantId: new Types.ObjectId(tenantId) })
      .sort({ createdAt: -1 })
      .populate('authorId', 'username email profilePicture')
      .exec();
  }

  async findPublishedByTenant(tenantId: string, skip = 0, limit = 10): Promise<PostDocument[]> {
    if (!Types.ObjectId.isValid(tenantId)) return [];
    return this.postModel
      .find({
        tenantId: new Types.ObjectId(tenantId),
        status: 'published'
      })
      .sort({ publishedAt: -1 })
      .skip(Math.max(0, skip))
      .limit(Math.min(Math.max(1, limit), 100))
      .populate('authorId', 'username email profilePicture displayName bio')
      .populate('tenantId', 'name slug')
      .exec();
  }

  async findAllPublished(skip = 0, limit = 10): Promise<PostDocument[]> {
    return this.postModel
      .find({ status: 'published' })
      .sort({ publishedAt: -1 })
      .skip(Math.max(0, skip))
      .limit(Math.min(Math.max(1, limit), 100))
      .populate('authorId', 'username email profilePicture displayName bio')
      .populate('tenantId', 'name slug')
      .exec();
  }

  async findBySlugAndTenant(slug: string, tenantId: string): Promise<PostDocument | null> {
    if (!Types.ObjectId.isValid(tenantId)) return null;
    return this.postModel
      .findOne({
        slug,
        tenantId: new Types.ObjectId(tenantId),
        status: 'published'
      })
      .populate('authorId', 'username email profilePicture displayName bio')
      .populate('tenantId', 'name slug')
      .exec();
  }

async findByCategory(
  category: string,
  tenantId?: string, 
  page: number = 1,  
  limit: number = 10
): Promise<{ posts: PostDocument[]; total: number; totalPages: number }> {
  
  const query: any = {
    status: 'published',
    categories: category.toLowerCase().trim()
  };

  if (tenantId && Types.ObjectId.isValid(tenantId)) {
    query.tenantId = new Types.ObjectId(tenantId);
  }

  const total = await this.postModel.countDocuments(query);
  const validatedLimit = Math.min(Math.max(1, limit), 50);
  
  const posts = await this.postModel
    .find(query)
    .sort({ publishedAt: -1 })
    .skip((Math.max(1, page) - 1) * validatedLimit)
    .limit(validatedLimit)
    .populate('authorId', 'username email profilePicture displayName bio')
    .populate('tenantId', 'name slug')
    .exec();

  return { posts, total, totalPages: Math.ceil(total / validatedLimit) };
}

  async remove(id: string, userId: string, tenantId: string): Promise<void> {
    const post = await this.postModel.findById(id);
    if (!post) throw new NotFoundException('Post not found');
    if (!post.authorId.equals(new Types.ObjectId(userId)) || !post.tenantId.equals(new Types.ObjectId(tenantId))) {
      throw new ForbiddenException('Permission denied');
    }
    await this.postModel.deleteOne({ _id: id });
  }

async findByIdOrSlug(identifier: string, userId?: string): Promise<any> {
  const query = /^[0-9a-fA-F]{24}$/.test(identifier) 
    ? { _id: new Types.ObjectId(identifier) } 
    : { slug: identifier };

  const post = await this.postModel.findOne(query).lean().exec();

  if (!post) return null;

  return {
    ...post,
    isLikedByMe: userId ? post.likedBy?.some(id => id.toString() === userId) : false,
    likesCount: post.likedBy?.length || 0
  };
}

  async getPopularPosts(limit: number = 5) {
    return this.postModel
      .find({ status: 'published' }) 
      .sort({ likes: -1 })           
      .limit(Math.min(Math.max(1, limit), 20))
      .populate('authorId', 'username displayName profilePicture')
      .populate('tenantId', 'name slug')
      .exec();
  }

  async getEditorsPicks(limit: number = 3) {
    return this.postModel
      .find({ 
        status: 'published', 
        isFeatured: true 
      })
      .populate('authorId', 'username displayName profilePicture')
      .populate('tenantId', 'name slug')
      .sort({ createdAt: -1 })
      .limit(Math.min(Math.max(1, limit), 10))
      .exec();
  }
}