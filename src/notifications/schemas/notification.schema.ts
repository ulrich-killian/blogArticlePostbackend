import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type NotificationType = 'like' | 'comment' | 'post' | 'subscribe' | 'mention' | 'reply';

@Schema ({ timestamps: true })

export class Notification extends Document {
    @Prop({ required: true, type: Types.ObjectId, ref: 'User', index: true })
    recipientId: Types.ObjectId;  
  
    @Prop({ required: true, type: Types.ObjectId, ref: 'User' })
    actorId: Types.ObjectId;     
  
    @Prop({ required: true, enum: ['like', 'comment', 'post', 'subscribe', 'mention', 'reply'] })
    type: NotificationType;
  
    @Prop({ type: Types.ObjectId, ref: 'Post' })
    postId?: Types.ObjectId;  
  
    @Prop({ type: Types.ObjectId, ref: 'Blog' })
    blogId?: Types.ObjectId;   
  
    @Prop()
    content?: string;            
  
    @Prop({ default: false })
    isRead: boolean;
  
    @Prop({ default: false })
    isClicked: boolean;
  

    @Prop({ default: 1 })
    count: number;
  

    @Prop({ default: false })
    delivered: boolean;
  }
  
  export const NotificationSchema = SchemaFactory.createForClass(Notification);
  
 
  NotificationSchema.index({ recipientId: 1, createdAt: -1 });
  NotificationSchema.index({ recipientId: 1, isRead: 1 });
  NotificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 2592000 });