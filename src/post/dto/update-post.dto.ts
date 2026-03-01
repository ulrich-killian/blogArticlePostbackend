import { PartialType } from '@nestjs/mapped-types';
import { CreatePostDto } from './create-post.dto';
import { IsOptional, IsDate, IsBoolean, IsString } from 'class-validator';

export class UpdatePostDto extends PartialType(CreatePostDto) {
  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;

 @IsOptional()
 @IsDate()
 publishedAt?: Date;

  @IsOptional()
  @IsString()
  thumbnailPublicId?: string;
}