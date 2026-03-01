import {
  Controller,
  Post,
  Get,
  Patch,
  Param,
  Body,
  Req,
  UseGuards,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
  Delete,
  Query,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { BlogsService } from './blogs.service';
import { CreateBlogDto } from './dto/create-blog.dto';
import type { AuthRequest } from 'src/auth/type/auth-request.type';
import { FileInterceptor } from '@nestjs/platform-express';
import { SetMetadata } from '@nestjs/common';
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
import { UpdateBlogDto }from './dto/update-blog.dto'
@Controller('blogs')
export class BlogsController {
  constructor(private readonly blogsService: BlogsService) {}

  // --- PUBLIC ROUTES ---

  @Public()
  @Get('public/:slug')
  async getPublicBlog(@Param('slug') slug: string) {
    return this.blogsService.getBlogBySlug(slug);
  }

  @Public()
  @Get()
  async getAllBlogs() {
    return this.blogsService.findAllPublished();
  }

  @Public()
  @Get('popular/all')
  async getPopularBlogs(@Query('limit') limit?: string) {
    const limitNum = limit ? parseInt(limit) : 10;
    return this.blogsService.getPopularBlogs(limitNum);
  }


  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getMyBlog(@Req() req: AuthRequest) {
    const blog = await this.blogsService.getBlogByTenant(req.user.tenantId);
    return { blog: blog ?? null };
  }

  @UseGuards(JwtAuthGuard)
  @Patch('me')
  async updateMyBlog(@Req() req: AuthRequest, @Body() dto: UpdateBlogDto) {
    return this.blogsService.updateMyBlog(req.user.tenantId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  async createBlog(@Body() body: CreateBlogDto, @Req() req: AuthRequest) {
    const authorName = req.user.username || body.authorName || 'Anonymous';
    return this.blogsService.createBlog(
      { ...body, authorName },
      req.user.tenantId,
      req.user.userId,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  async deleteBlog(@Param('id') id: string, @Req() req: AuthRequest) {
    return this.blogsService.deleteBlog(id, req.user.tenantId);
  }

  // --- MEDIA & SETTINGS ---

  @UseGuards(JwtAuthGuard)
  @Post('images')
  @UseInterceptors(FileInterceptor('file'))
  async uploadBlogImage(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file uploaded');
    return this.blogsService.uploadBlogImage(file);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/notification-preferences')
  async updateNotificationPreferences(
    @Param('id') id: string,
    @Body() body: { newPosts?: boolean; comments?: boolean; likes?: boolean },
    @Req() req: AuthRequest,
  ) {
    return this.blogsService.updateNotificationPreferences(id, req.user.userId, body);
  }



  @UseGuards(JwtAuthGuard)
  @Post(':id/subscribe')
  async subscribe(@Param('id') id: string, @Req() req: AuthRequest) {
    return this.blogsService.subscribe(id, req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id/subscribe')
  async unsubscribe(@Param('id') id: string, @Req() req: AuthRequest) {
    return this.blogsService.unsubscribe(id, req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/subscription-status')
  async getSubscriptionStatus(@Param('id') id: string, @Req() req: AuthRequest) {
    return this.blogsService.getSubscriptionStatus(id, req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('user/subscriptions')
  async getUserSubscriptions(@Req() req: AuthRequest) {
    return this.blogsService.getUserSubscriptions(req.user.userId);
  }
}