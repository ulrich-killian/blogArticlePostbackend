import { IsString, IsNotEmpty, IsOptional, IsArray,  IsBoolean } from 'class-validator';
export class CreateBlogDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  content?: string;

  @IsString()
  @IsOptional()
  excerpt?: string;

  @IsString()
  @IsOptional()
  authorName?: string;

  
  @IsString()
  @IsOptional()
  coverImage?: string;

  @IsArray()
  @IsOptional()
  @IsString({ each: true })
  categories?: string[]; 

  @IsString()
  @IsOptional()
  metaTitle?: string;

  @IsString()
  @IsOptional()
  metaDescription?: string;
}
