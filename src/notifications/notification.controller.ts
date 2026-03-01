import { Controller, Get, Post, Patch, Param, Body, Req, UseGuards, Query } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { NotificationService } from './notification.service';
import type { AuthRequest } from '../auth/type/auth-request.type';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationController {
  constructor(private notificationService: NotificationService) {}

  @Get()
  async getMyNotifications(
    @Req() req: AuthRequest,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.notificationService.getUserNotifications(req.user.userId, +page, +limit);
  }

  @Get('unread-count')
  async getUnreadCount(@Req() req: AuthRequest) {
    const count = await this.notificationService.getUnreadCount(req.user.userId);
    return { unreadCount: count };
  }

  @Patch('read')
  async markAsRead(
    @Req() req: AuthRequest,
    @Body() body: { notificationIds: string[] },
  ) {
    return this.notificationService.markAsRead(req.user.userId, body.notificationIds);
  }

  @Post('read-all')
  async markAllAsRead(@Req() req: AuthRequest) {
    return this.notificationService.markAllAsRead(req.user.userId);
  }
}