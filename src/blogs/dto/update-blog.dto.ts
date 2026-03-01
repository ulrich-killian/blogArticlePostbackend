import { PartialType } from '@nestjs/mapped-types';
import { IsString, IsOptional, IsBoolean, IsArray } from 'class-validator';
import { CreateBlogDto } from './create-blog.dto';

export class UpdateBlogDto extends PartialType(CreateBlogDto) {
  @IsString()
  @IsOptional()
  slug?: string;


  @IsString()
  @IsOptional()
  profileImage?: string;
  
  @IsBoolean()
  @IsOptional()
  isPrivate?: boolean;

  @IsArray()
  @IsOptional()
  @IsString({ each: true })
  subscriberIds?: string[];

  @IsOptional()
  notificationPreferences?: {
    newPosts?: boolean;
    comments?: boolean;
    likes?: boolean;
  };
}