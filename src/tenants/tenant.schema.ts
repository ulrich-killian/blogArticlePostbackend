import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class Tenant extends Document {
  @Prop({ required: true })
  name: string;
  
  @Prop({ default: '' })
  description: string;

  @Prop({ required: true, unique: true })
  slug: string;

  @Prop({ required: true })
  userId: string;

  @Prop({ type: String, required: true })
  owner: string;

  @Prop()
  logo?: string;

  @Prop()
  coverImage?: string;

  createdAt: Date;
  updatedAt: Date;
}

export const TenantSchema = SchemaFactory.createForClass(Tenant);


export type TenantDocument = Tenant & Document & {
  createdAt: Date;
  updatedAt: Date;
};