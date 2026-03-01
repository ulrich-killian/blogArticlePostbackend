import {
  IsString,
  MinLength,
  IsOptional,
  IsInt,
  Max,
  Min,
  IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SEARCH_TYPES } from '../search.types';
import type { SearchType } from '../search.types';

export class SearchQueryDto {
  @ApiProperty({
    description: 'Search query (minimum 2 characters)',
    example: 'john',
    minLength: 2,
  })
  @IsString()
  @MinLength(2)
  q: string;

  @ApiPropertyOptional({
    description: 'Maximum number of results (1-20)',
    example: 10,
    default: 5,
    minimum: 1,
    maximum: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  limit = 5;

  @ApiPropertyOptional({
    description: 'Filter by content type',
    enum: SEARCH_TYPES,
    example: 'user',
  })
  @IsOptional()
  @IsIn(SEARCH_TYPES)
  type?: SearchType;

  @ApiPropertyOptional({
    description: 'Include additional metadata in results',
    example: true,
    default: false,
  })
  @IsOptional()
  @Type(() => Boolean)
  includeMeta?: boolean = false;
}