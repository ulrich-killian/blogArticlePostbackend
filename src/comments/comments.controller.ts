import { Controller, Post, Get, Param, Body, UseGuards, Req, Delete } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CommentsService } from './comments.service';

@Controller('posts/:postId')
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {
   }

  @Post('comments')
  @UseGuards(JwtAuthGuard)
  async addComment(
    @Param('postId') postId: string,
    @Body() body: { content: string, parentCommentId?: string },
    @Req() req,
  ) {
    const userId = req.user.sub || req.user.userId;
    const username = req.user.displayName || req.user.username || req.user.name || "Anonymous";
    const userRole = req.user.role || 'reader';

    return this.commentsService.create({
      content: body.content,
      postId,
      parentCommentId: body.parentCommentId,
      userId,
      authorName: username,
      authorRole: userRole,
    });
  }

@Get('comments')  
async getComments(@Param('postId') postId: string, @Req() req: any) {
  const authHeader = req.headers.authorization;

  let userId: string | undefined = undefined; 

  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const token = authHeader.split(' ')[1];
      const decoded: any = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
      userId = decoded.sub || decoded.userId;
    } catch (e) {
      userId = undefined;
    }
  }

  return this.commentsService.findByPost(postId, userId);
}

  @Post('like')
  @UseGuards(JwtAuthGuard)
  async toggleLike(@Param('postId') postId: string, @Req() req) {
    const userId = req.user.sub || req.user.userId;
    return this.commentsService.toggleLike(postId, userId);
  }

  @Delete('comments/:commentId')
  @UseGuards(JwtAuthGuard)
  async deleteComment(
    @Param('postId') postId: string,
    @Param('commentId') commentId: string,
    @Req() req,
  ) {
    const userId = req.user.sub || req.user.userId;
    const userRole = req.user.role || 'reader';
    
    return this.commentsService.deleteComment(commentId, postId, userId, userRole);
  }

  @Post('comments/:commentId/like')
  @UseGuards(JwtAuthGuard)
  async toggleCommentLike(
    @Param('commentId') commentId: string,
    @Req() req,
  ) {
    const userId = req.user.sub || req.user.userId;
    return this.commentsService.toggleCommentLike(commentId, userId);
  }
}