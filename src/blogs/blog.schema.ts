import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class Blog extends Document {
  @Prop({ required: true, trim: true })
  title: string;

  @Prop({ required: true })
  slug: string;
  
  @Prop({ default: false })
  isPrivate: boolean;

  @Prop({ default: 0 })
  subscriberCount: number;

  @Prop()
  description: string;

  @Prop({ required: true, index: true })
  tenantId: string;
 
  @Prop({ required: true })
  authorId: string;

  @Prop({ required: true })
  authorName: string;

  @Prop()
  content: string;

  @Prop()
  excerpt: string;

  @Prop()
  coverImage: string;

  @Prop()
  profileImage: string;
  
  @Prop({ 
    type: [String], 
    default: [], 
    select: false,
    validate: {
      validator: function(v: string[]) {
        return v.length <= 50000;
      },
      message: 'Subscriber limit reached for this blog document.'
    }
  }) 
  subscriberIds: string[];

  @Prop({ 
    type: Object, 
    default: { 
      newPosts: true,
      comments: true,
      likes: true 
    }
  })
  notificationPreferences: {
    newPosts: boolean;
    comments: boolean;
    likes: boolean;
  };

  @Prop({ type: [String], default: [] })
  categories: string[];

  @Prop({ type: Date, index: true })
  publishedAt: Date;

  @Prop()
  metaTitle: string;

  @Prop()
  metaDescription: string;
}

export const BlogSchema = SchemaFactory.createForClass(Blog);


BlogSchema.index({ title: 'text', description: 'text', excerpt: 'text' });
BlogSchema.index({ tenantId: 1, slug: 1 }, { unique: true });
BlogSchema.index({ categories: 1 });
BlogSchema.index({ tenantId: 1, categories: 1, subscriberCount: -1 });
BlogSchema.index({ 'notificationPreferences.newPosts': 1 });