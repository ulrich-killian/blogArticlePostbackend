import { 
  IsString, 
  IsNotEmpty, 
  IsOptional, 
  IsEnum, 
  IsUrl, 
  MinLength, 
  MaxLength, 
  IsArray,
  IsNumber 
} from 'class-validator';
import { Transform } from 'class-transformer';

export class CreatePostDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(200)
  title: string;

  @IsString()
  @IsOptional()
  @Transform(({ value, obj }) => {
    if (!value && obj.title) {
      return obj.title
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '');
    }
    return value?.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  })
  slug?: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(10)
  content: string;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }
    return value;
  })
  @IsUrl({ require_protocol: true }, { 
    message: 'Thumbnail must be a valid URL' 
  })
  thumbnail?: string;

  @IsOptional()
  @IsString()
  thumbnailPublicId?: string;

  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' && value.trim().length === 0
      ? undefined
      : value
  )
  @IsString()
  @MinLength(10)
  @MaxLength(500)
  excerpt?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      try {
        return JSON.parse(value);
      } catch {
        return value.split(',').map((item: string) => item.trim()).filter(Boolean);
      }
    }
    
    if (Array.isArray(value)) {
      return value;
    }
    
    return [];
  })
  @Transform(({ value }) => {
    if (Array.isArray(value)) {
      const normalized = value
        .map(cat => cat.toString().toLowerCase().trim())
        .filter(cat => cat.length > 0)
        .filter((cat, index, self) => self.indexOf(cat) === index)
        .slice(0, 10); 
      
      return normalized;
    }
    return [];
  })
  categories?: string[];

  @IsOptional()
  @IsString()
  authorId?: string; 

  @IsOptional()
  @IsString()
  @MinLength(20)
  @MaxLength(160)
  seoDescription?: string;

  @IsOptional()
  @IsNumber()
  commentsCount?: number; 

  @IsOptional()
  @IsNumber()
  views?: number; 

  @IsOptional()
  @IsEnum(['draft', 'published'])
  status?: 'draft' | 'published' = 'published';
}