import { Controller, Post, Body, UseGuards, Req, Get, BadRequestException, Inject } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TenantService } from './tenant.service';
import { CreateTenantDto } from './tenant.dto';
import { UsersService } from '../users/users.service';

@Controller('tenants')
export class TenantController {
  constructor(
    private tenantService: TenantService,
    private jwtService: JwtService,
    @Inject(UsersService) private usersService: UsersService,
  ) {}

  @Post('create')
  @UseGuards(JwtAuthGuard)
  async createBlog(
    @Body() dto: CreateTenantDto,
    @Req() req,
  ) {
    const userId = req.user.userId || req.user.sub;

    const existingBlog = await this.tenantService.findByOwner(userId);
    if (existingBlog) {
      throw new BadRequestException('You already have a blog!');
    }

    const existingSlug = await this.tenantService.findBySlug(dto.slug);
    if (existingSlug) {
      throw new BadRequestException(`Blog URL "${dto.slug}" is already taken`);
    }

    const blog = await this.tenantService.createTenant(dto, userId);


    try {
      await this.usersService.updateTenant(userId, blog._id.toString());
    } catch (err) {
    }

    const newToken = this.jwtService.sign({
      sub: req.user.sub,
      userId: req.user.userId,
      email: req.user.email,
      username: req.user.username,
      role: 'author',
      hasBlog: true,
      tenantId: blog._id.toString(),
    });

    return {
      message: 'Blog created! You can now write posts.',
      blog: {
        id: blog._id,
        name: blog.name,
        slug: blog.slug,
        description: blog.description,
      },
      accessToken: newToken,
    };
  }

  @Get('check')
  @UseGuards(JwtAuthGuard)
  async checkBlogStatus(@Req() req) {
    const userId = req.user.userId || req.user.sub;
    const blog = await this.tenantService.findByOwner(userId);

    return {
      hasBlog: !!blog,
      blog: blog ? {
        id: blog._id,
        name: blog.name,
        slug: blog.slug,
      } : null,
      canCreateBlog: !blog,
    };
  }
}