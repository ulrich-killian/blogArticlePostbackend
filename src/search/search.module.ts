import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { MongooseModule } from '@nestjs/mongoose';

import { SearchController } from './search.controller';
import { SearchService } from './search.service';
import { SearchIndexService } from './search.index';

import { User, UserSchema } from '../users/user.schema';
import { Post, PostSchema } from '../post/post.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Post.name, schema: PostSchema },
    ]),
    CacheModule.register({
      ttl: 30,
      max: 100,
    }),
  ],
  controllers: [SearchController],
  providers: [SearchService, SearchIndexService],
  exports: [SearchService],
})
export class SearchModule {}