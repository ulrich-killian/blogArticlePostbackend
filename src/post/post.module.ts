import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PostController } from './post.controller';
import { PublicPostController } from './public-post.controller';
import { CommentsController } from '../comments/comments.controller'; 
import { PostService } from './post.service';
import { CommentsService } from '../comments/comments.service'; 
import { Post, PostSchema } from './post.schema';
import { Comment, CommentSchema } from '../comments/comment.schema'; 
import { UsersModule } from '../users/users.module'; 
import { AuthModule } from '../auth/auth.module'; 
import { TenantModule } from '../tenants/tenant.module';
import { CloudinaryModule } from '../cloudinary/cloudinary.module' 
import { BlogsModule } from '../blogs/blogs.module';
import { PostStatsService } from '../post/post-stats.service'
import { NotificationModule } from '../notifications/notification.module'; 

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Post.name, schema: PostSchema },
      { name: Comment.name, schema: CommentSchema } 
    ]),
    UsersModule,
    AuthModule,
    TenantModule,
    CloudinaryModule,
    BlogsModule,
    NotificationModule,
  ],
  controllers: [
    PostController, 
    PublicPostController,
    CommentsController 
  ],
  providers: [
    PostService, 
    PostStatsService,
    CommentsService 
  ],
  exports: [PostService],
})
export class PostModule {}