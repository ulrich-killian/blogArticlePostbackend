import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { SearchService } from './search.service';
import { SearchQueryDto } from './dto/search-query.dto';

@ApiTags('search')
@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get('suggestions')
  @ApiOperation({ summary: 'Get search suggestions' })
  @ApiResponse({ 
    status: 200, 
    description: 'Returns search suggestions with relevance scoring' 
  })
  async getSuggestions(@Query() query: SearchQueryDto) {
    return this.searchService.getSuggestions(query.q, query.limit, query.type);
  }

  @Get('quick')
  @ApiOperation({ summary: 'Quick search for instant results' })
  @ApiResponse({ 
    status: 200, 
    description: 'Returns top 5 most relevant search results' 
  })
  async quickSearch(@Query('q') query: string) {
    return this.searchService.quickSearch(query);
  }

  @Get('popular')
  @ApiOperation({ summary: 'Get popular search queries' })
  @ApiResponse({ 
    status: 200, 
    description: 'Returns most frequently searched queries' 
  })
  async getPopularSearches(@Query('limit') limit: number = 10) {
    return this.searchService.getPopularSearches(limit);
  }

  @Get('analytics')
  @ApiOperation({ summary: 'Get search analytics data' })
  @ApiResponse({ 
    status: 200, 
    description: 'Returns daily search analytics for the specified number of days' 
  })
  async getSearchAnalytics(@Query('days') days: number = 7) {
    return this.searchService.getSearchAnalytics(days);
  }
}