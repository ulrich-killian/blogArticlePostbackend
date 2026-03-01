import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CommentsController } from './comments.controller';
import { CommentsService } from './comments.service';
import { Comment, CommentSchema } from './comment.schema';
import { AuthModule } from '../auth/auth.module';
import { Post, PostSchema } from '../post/post.schema'; 
import { NotificationModule } from '../notifications/notification.module';  

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Comment.name, schema: CommentSchema },
      { name: 'Post', schema: PostSchema }, 
    ]),
    AuthModule,
    NotificationModule,
  ],
  controllers: [CommentsController],
  providers: [CommentsService],
  exports: [CommentsService],
})
export class CommentsModule {}