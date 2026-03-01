import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type PostDocument = Post & Document;

@Schema({ timestamps: true })
export class Post {
  @Prop({ type: Types.ObjectId, ref: 'Tenant', required: true, index: true })
  tenantId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  authorId: Types.ObjectId;

  @Prop({ required: true, trim: true })
  title: string;

  @Prop({ required: true, trim: true })
  slug: string;

  @Prop({ required: true })
  content: string;

  @Prop({ type: String, default: null })
  thumbnail?: string | null;

  @Prop({ trim: true, minlength: 10, maxlength: 500 })
  excerpt?: string;

  @Prop({ type: [String], default: ["General"] })
  categories?: string[];

  @Prop({ trim: true, minlength: 10, maxlength: 1000 })
  seoDescription?: string;

  @Prop({ type: String })
  thumbnailPublicId?: string;

  @Prop({ type: String, default: null })
  ogImagePublicId?: string; 

  @Prop({ type: Boolean, default: false })
  ogGenerated?: boolean; 

  @Prop({ type: String, default: null })
  ogImage?: string;

  @Prop({ default: 'draft', enum: ['draft', 'published'] })
  status: 'draft' | 'published';

  @Prop({ type: Date })
  publishedAt?: Date;

  @Prop({ default: 0 })
  likes: number;

  @Prop({ default: 0 })
  commentsCount: number;

@Prop({ default: 0 })
views: number;

@Prop({ type: [Types.ObjectId], ref: 'User', default: [] }) 
viewedBy: Types.ObjectId[];

@Prop({ type: [Types.ObjectId], ref: 'Comment', default: [] })
commentIds?: Types.ObjectId[];

  @Prop({ type: [String], default: [] })
  likedBy: string[];
}

export const PostSchema = SchemaFactory.createForClass(Post);

PostSchema.index({ slug: 1, tenantId: 1 }, { unique: true });
PostSchema.index({ categories: 1, tenantId: 1 }); 
PostSchema.index({ status: 1, tenantId: 1 });
PostSchema.index({ authorId: 1, tenantId: 1 });

PostSchema.pre('save', function () {
  const doc = this as any;

  if (doc.isModified('status') && doc.status === 'published' && !doc.publishedAt) {
    doc.publishedAt = new Date();
  }

  if (doc.isModified('status') && doc.status === 'draft') {
    doc.publishedAt = undefined;
  }
});