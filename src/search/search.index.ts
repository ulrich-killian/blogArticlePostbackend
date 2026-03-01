import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../users/user.schema';
import { Post, PostDocument } from '../post/post.schema';

@Injectable()
export class SearchIndexService implements OnApplicationBootstrap {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(Post.name) private readonly postModel: Model<PostDocument>,
  ) {
    console.log('SearchIndexService constructor called');
  }

  async onApplicationBootstrap() {
    console.log('onApplicationBootstrap() called - creating indexes');
    await this.createIndexes();
  }

  async createIndexes() {
    try {
      console.log('Starting search index creation...');

      const postIndexes = await this.postModel.collection.indexes();
      console.log('EXISTING POST INDEXES:', postIndexes.map(idx => ({
        name: idx.name,
        type: idx.textIndexVersion ? 'text' : 'regular'
      })));

      const hasPostTextIndex = postIndexes.some(idx => 
        idx.name === 'post_search_text' || 
        (idx.weights && Object.keys(idx.weights).length > 0)
      );

      if (hasPostTextIndex) {
        console.log('Post text index already exists');
        console.log('Details:', postIndexes.find(idx => idx.name === 'post_search_text' || idx.weights));
      } else {
        console.log('Creating post text index...');
        
        // CREATE POST TEXT INDEX
        const result = await this.postModel.collection.createIndex(
          { title: 'text', excerpt: 'text', tags: 'text' },
          { 
            name: 'post_search_text', 
            weights: { title: 3, tags: 2, excerpt: 1 } 
          }
        );
        console.log('Post text index created:', result);
      }

      console.log('Search index creation completed');
      
    } catch (error) {
      console.error('Failed to create search indexes:');
      console.error('   Message:', error.message);
      console.error('   Code:', error.code);
      console.error('   CodeName:', error.codeName);
      
      if (error.code === 85 || error.codeName === 'IndexOptionsConflict') {
        console.log('Index already exists with different options');
      }
    }
  }
}