import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class User extends Document {
  @Prop({ 
    required: true, 
    unique: true,
    validate: {
      validator: (v: string) => /\S+@\S+\.\S+/.test(v),
      message: 'Please provide a valid email address'
    }
  })
  email: string;

  @Prop({ required: true, unique: true }) 
  username: string;

  @Prop({ required: false })
  passwordHash?: string;

  @Prop({ default: 'reader', enum: ['reader', 'author', 'admin'] })
  role: string;

  @Prop({ required: false })
  tenantId?: string;

  @Prop({ default: '' })
  bio?: string;

  @Prop()
  profilePicture?: string;

  @Prop()
  profilePicturePublicId?: string;

  @Prop()
  displayName?: string;

  @Prop()
  lastLoginAt?: Date;

  @Prop()
  resetCode?: string;

  @Prop()
  resetCodeExpires?: Date;

  @Prop({ default: false })
  isEmailVerified?: boolean;

  @Prop()
  emailVerificationToken?: string;

  @Prop()
  emailVerificationExpires?: Date;

  @Prop({ default: 0 })
  loginCount?: number;
   
  @Prop({ type: Types.ObjectId, ref: 'Blog' })
  blog: Types.ObjectId;

  @Prop()
  firstName?: string;

  @Prop()
  lastName?: string;

  @Prop()
  picture?: string;
}

export type UserDocument = User & Document;
export const UserSchema = SchemaFactory.createForClass(User);

UserSchema.index({ tenantId: 1 });
UserSchema.index({ resetCodeExpires: 1 }, { expireAfterSeconds: 0 }); 
UserSchema.index({ username: 'text', displayName: 'text' });