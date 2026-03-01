import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Comment } from './comment.schema';
import { Post } from '../post/post.schema';
import { NotificationService } from '../notifications/notification.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Injectable()
export class CommentsService {
  constructor(
    @InjectModel(Comment.name) private commentModel: Model<Comment>,
    @InjectModel(Post.name) private readonly postModel: Model<Post>,
    private notificationService: NotificationService,
    private eventEmitter: EventEmitter2,
  ) {}

  async create(commentData: any) {
    const postObjectId = new Types.ObjectId(commentData.postId);
    const userObjectId = new Types.ObjectId(commentData.userId);
    const parentObjectId = commentData.parentCommentId
      ? new Types.ObjectId(commentData.parentCommentId)
      : null;

    const comment = new this.commentModel({
      ...commentData,
      postId: postObjectId,
      userId: userObjectId,
      parentCommentId: parentObjectId,
    });

    const savedComment = await comment.save();

    await this.postModel.findByIdAndUpdate(postObjectId, {
      $inc: { commentsCount: 1 },
      $push: { commentIds: savedComment._id },
    });

    if (parentObjectId) {
      await this.commentModel.findByIdAndUpdate(parentObjectId, {
        $inc: { replyCount: 1 },
      });
    }

    const post = await this.postModel.findById(postObjectId).lean();

    if (post && post.authorId.toString() !== commentData.userId) {
      await this.notificationService.createNotification({
        recipientId: post.authorId.toString(),
        actorId: commentData.userId,
        type: 'comment',
        postId: commentData.postId,
        commentId: savedComment._id.toString(),
        content: `commented on your post: "${commentData.content?.substring(0, 40)}..."`,
      });
    }

    if (parentObjectId) {
      const parentComment = await this.commentModel
        .findById(parentObjectId)
        .lean();

      if (
        parentComment &&
        parentComment.userId.toString() !== commentData.userId
      ) {
        await this.notificationService.createNotification({
          recipientId: parentComment.userId.toString(),
          actorId: commentData.userId,
          type: 'reply',
          postId: commentData.postId,
          commentId: savedComment._id.toString(),
          parentCommentId: commentData.parentCommentId,
          content: `replied to your comment`,
        });
      }
    }

    return savedComment;
  }

  async findByPost(postId: string, userId?: string) {
    const comments = await this.commentModel
      .find({ postId: new Types.ObjectId(postId) })
      .sort({ createdAt: -1 })
      .lean()
      .exec();

    return comments.map((comment) => {
      const isLikedByMe = userId
        ? comment.likedBy?.some((id) => id.toString() === userId)
        : false;

      return {
        ...comment,
        isLikedByMe,
        likesCount: comment.likedBy?.length || 0,
      };
    });
  }
  async toggleCommentLike(commentId: string, userId: string) {
    const comment = await this.commentModel.findById(commentId);

    if (!comment) {
      throw new Error('Comment not found');
    }

    const userObjectId = new Types.ObjectId(userId);
    const userIndex = comment.likedBy.findIndex((id) =>
      id.equals(userObjectId),
    );
    const wasLiked = userIndex !== -1;

    if (userIndex === -1) {
      comment.likedBy.push(userObjectId);
    } else {
      comment.likedBy.splice(userIndex, 1);
    }

    comment.likes = comment.likedBy.length;
    await comment.save();

    if (!wasLiked && comment.userId.toString() !== userId) {
      const post = await this.postModel.findById(comment.postId);
      await this.notificationService.createNotification({
        recipientId: comment.userId.toString(),
        actorId: userId,
        type: 'like',
        postId: comment.postId?.toString(),
        commentId: commentId,
        content: `liked your comment`,
      });
    }

    return {
      liked: userIndex === -1,
      likes: comment.likes,
    };
  }

  async deleteComment(commentId: string, postId: string, userId: string, userRole: string) {
    const comment = await this.commentModel.findById(commentId);
    
    if (!comment) {
      throw new NotFoundException('Comment not found');
    }

    // Check if user is authorized to delete (owner, admin, or author)
    const isOwner = comment.userId.toString() === userId;
    const isAdmin = userRole === 'admin';
    const isModerator = userRole === 'moderator';

    if (!isOwner && !isAdmin && !isModerator) {
      throw new ForbiddenException('You do not have permission to delete this comment');
    }

    // Start a session for transaction
    const session = await this.commentModel.db.startSession();
    session.startTransaction();

    try {
      // If this is a parent comment with replies, delete all replies first
      if (!comment.parentCommentId) {
        await this.commentModel.deleteMany({ 
          parentCommentId: commentId 
        }).session(session);
      }

      // Delete the comment
      await comment.deleteOne({ session });

      // Update post's comment count
      const replyCount = comment.parentCommentId ? 0 : 1; // Only decrement for parent comments
      const repliesToDecrement = comment.parentCommentId ? 0 : await this.commentModel.countDocuments({ 
        parentCommentId: commentId 
      });

      await this.postModel.findByIdAndUpdate(
        postId,
        { 
          $inc: { 
            commentsCount: -(1 + repliesToDecrement) 
          } 
        },
        { session }
      );

      // If this was a reply, update parent comment's reply count
      if (comment.parentCommentId) {
        await this.commentModel.findByIdAndUpdate(
          comment.parentCommentId,
          { $inc: { replyCount: -1 } },
          { session }
        );
      }

      await session.commitTransaction();

      // Emit socket event for real-time deletion
      this.eventEmitter.emit('comment.deleted', {
        commentId,
        postId,
        parentCommentId: comment.parentCommentId
      });

      return { 
        success: true, 
        message: 'Comment deleted successfully',
        deletedCommentId: commentId,
        parentCommentId: comment.parentCommentId
      };
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  async toggleLike(postId: string, userId: string) {
    const post = await this.postModel.findById(postId);

    if (!post) {
      throw new Error('Post not found');
    }

    const userIndex = post.likedBy.indexOf(userId);
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

    // Delete notification on unlike
    if (wasLiked && post.authorId.toString() !== userId) {
      await this.notificationService.deleteNotification({
        recipientId: post.authorId.toString(),
        actorId: userId,
        type: 'like',
        postId: postId,
      });
    }

    return {
      liked: !wasLiked,
      likes: post.likes,
    };
  }
}
