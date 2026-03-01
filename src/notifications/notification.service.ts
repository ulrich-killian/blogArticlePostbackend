import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Notification } from './schemas/notification.schema';
import { NotificationGateway } from './notification.gateway';

interface NotificationPayload {
  recipientId: string;
  actorId: string;
  type: string;
  postId?: string;
  blogId?: string;
  commentId?: string;
  parentCommentId?: string;
  content?: string;
}

@Injectable()
export class NotificationService {
  constructor(
    @InjectModel(Notification.name) private notificationModel: Model<Notification>,
    private eventEmitter: EventEmitter2,
    private notificationGateway: NotificationGateway,
  ) {}

  async createNotification(data: NotificationPayload) {
    const existing = await this.notificationModel.findOne({
      recipientId: new Types.ObjectId(data.recipientId),
      actorId: new Types.ObjectId(data.actorId),
      type: data.type,
      postId: data.postId ? new Types.ObjectId(data.postId) : undefined,
      isRead: false,
    }).sort({ createdAt: -1 });

    if (existing && (data.type === 'like' || data.type === 'subscribe')) {
      existing.count += 1;
      await existing.save();

      this.notificationGateway.sendNotificationToUser(data.recipientId, {
        ...existing.toObject(),
        aggregated: true,
      });

      return existing;
    }

    const notification = new this.notificationModel({
      recipientId: new Types.ObjectId(data.recipientId),
      actorId: new Types.ObjectId(data.actorId),
      type: data.type,
      postId: data.postId ? new Types.ObjectId(data.postId) : undefined,
      blogId: data.blogId ? new Types.ObjectId(data.blogId) : undefined,
      commentId: data.commentId
        ? new Types.ObjectId(data.commentId)
        : undefined,
      parentCommentId: data.parentCommentId
        ? new Types.ObjectId(data.parentCommentId)
        : undefined,
      content: data.content,
      count: 1,
    });

    await notification.save();

    const populated = await notification.populate(
      'actorId',
      'username profilePicture',
    );

    this.notificationGateway.sendNotificationToUser(
      data.recipientId,
      populated,
    );

    this.eventEmitter.emit('notification.created', populated);

    return populated;
  }

  async getUserNotifications(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [notifications, total] = await Promise.all([
      this.notificationModel
        .find({ recipientId: new Types.ObjectId(userId) })
        .populate('actorId', 'username profileImage displayName')
        .populate('postId', 'title slug')
        .populate('blogId', 'title slug')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      this.notificationModel.countDocuments({
        recipientId: new Types.ObjectId(userId),
      }),
    ]);

    return {
      notifications,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      unreadCount: await this.getUnreadCount(userId),
    };
  }

  async markAsRead(userId: string, notificationIds: string[]) {
    await this.notificationModel.updateMany(
      {
        _id: { $in: notificationIds.map(id => new Types.ObjectId(id)) },
        recipientId: new Types.ObjectId(userId),
      },
      { $set: { isRead: true } },
    );

    this.notificationGateway.sendNotificationToUser(userId, {
      type: 'read-update',
      notificationIds,
    });

    return { success: true };
  }

  async markAllAsRead(userId: string) {
    await this.notificationModel.updateMany(
      { recipientId: new Types.ObjectId(userId), isRead: false },
      { $set: { isRead: true } },
    );

    this.notificationGateway.sendNotificationToUser(userId, {
      type: 'all-read',
    });

    return { success: true };
  }

  async getUnreadCount(userId: string): Promise<number> {
    return this.notificationModel.countDocuments({
      recipientId: new Types.ObjectId(userId),
      isRead: false,
    });
  }

  async deleteNotification(data: NotificationPayload) {
    const query: any = {
      recipientId: new Types.ObjectId(data.recipientId),
      actorId: new Types.ObjectId(data.actorId),
      type: data.type,
      isRead: false,
    };

    if (data.postId) {
      query.postId = new Types.ObjectId(data.postId);
    }

    if (data.blogId) {
      query.blogId = new Types.ObjectId(data.blogId);
    }

    if (data.commentId) {
      query.commentId = new Types.ObjectId(data.commentId);
    }

    if (data.parentCommentId) {
      query.parentCommentId = new Types.ObjectId(data.parentCommentId);
    }

    const notification = await this.notificationModel
      .findOne(query)
      .sort({ createdAt: -1 });

    if (!notification) {
      return { success: false };
    }

    if (notification.count > 1) {
      notification.count -= 1;
      await notification.save();

      this.notificationGateway.sendNotificationToUser(
        data.recipientId,
        notification,
      );

      return { success: true, decremented: true };
    }

    await notification.deleteOne();

    this.notificationGateway.sendNotificationToUser(data.recipientId, {
      type: 'deleted',
      notificationId: notification._id,
    });

    return { success: true, deleted: true };
  }
}
