import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Post, PostDocument } from './post.schema';

@Injectable()
export class PostStatsService {
  constructor(
    @InjectModel(Post.name) private postModel: Model<PostDocument>,
  ) {}

  async incrementViews(postId: string): Promise<void> {
    await this.postModel.findByIdAndUpdate(
      postId,
      { $inc: { views: 1 } },
      { new: true }
    );
  }

  async updateCommentsCount(postId: string, increment: boolean = true): Promise<void> {
    const change = increment ? 1 : -1;
    await this.postModel.findByIdAndUpdate(
      postId,
      { $inc: { commentsCount: change } },
      { new: true }
    );
  }

  async getPostStats(postId: string): Promise<{ views: number; commentsCount: number }> {
    const post = await this.postModel.findById(postId).select('views commentsCount');
    return {
      views: post?.views || 0,
      commentsCount: post?.commentsCount || 0
    };
  }
}