import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BlogsController } from './blogs.controller';
import { BlogsService } from './blogs.service';
import { Blog, BlogSchema } from './blog.schema';
import { AuthModule } from '../auth/auth.module'; 
import { Post, PostSchema } from '../post/post.schema';
import { NotificationModule } from '../notifications/notification.module';  

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Blog.name, schema: BlogSchema },
      { name: Post.name, schema: PostSchema }, 
    ]),
    AuthModule,
    NotificationModule,
  ],
  controllers: [BlogsController],
  providers: [BlogsService],
  exports: [BlogsService, MongooseModule],
})
export class BlogsModule {}