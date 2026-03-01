import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class PasswordReset extends Document {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ required: true, index: true })
  email: string;

  @Prop({ required: true })
  resetCode: string; 

  @Prop({ required: true, index: true })
  expiresAt: Date; 

  @Prop({ default: false })
  isUsed: boolean; 
}

export const PasswordResetSchema = SchemaFactory.createForClass(PasswordReset);


PasswordResetSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });


PasswordResetSchema.index({ email: 1, resetCode: 1, isUsed: 1 });