import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User, UserDocument } from '../users/user.schema';
import { Post, PostDocument } from '../post/post.schema';
import { SearchType } from './search.types';

export interface SearchResult {
  type: SearchType;
  text: string;
  score: number;
  data: Record<string, unknown>;
}

interface LeanUser {
  _id: Types.ObjectId;
  username: string;
  displayName?: string;
  email?: string;
  bio?: string;
  avatar?: string;
  followersCount?: number;
  lastActive?: Date;
  isVerified?: boolean;
  createdAt?: Date;
  score?: number
}

interface LeanPost {
  _id: Types.ObjectId;
  title: string;
  slug?: string;
  excerpt?: string;
  content?: string;
  tags?: string[];
  category?: string;
  views?: number;
  likesCount?: number;
  commentsCount?: number;
  createdAt: Date;
  isFeatured?: boolean;
  featuredImage?: string;
  readingTime?: number;
  score?: number
}

export interface DailySearchAnalytics {
  date: string;
  queries: Record<string, number>;
}

/* ---------------------------------- */
/* Service */
/* ---------------------------------- */

@Injectable()
export class SearchService {
  private searchAnalytics = new Map<
    string,
    { queries: Record<string, number> }
  >();

  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(Post.name) private readonly postModel: Model<PostDocument>,
  ) {}


private async searchUsersWithText(
    query: string,
    limit: number,
  ): Promise<SearchResult[]> {
    // 1. Create a safe regex from the query
    const safeQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // Escapes special characters
    const searchRegex = new RegExp(safeQuery, 'i');

    // 2. Use find with $or to check both username and displayName
    const users = await this.userModel
      .find({
        $or: [
          { username: searchRegex },
          { displayName: searchRegex }
        ]
      })
      .limit(limit)
      .populate('blog', 'slug') // This ensures we get 'funny-guy'
      .lean<any[]>();

    return users.map(user => ({
      type: 'user',
      text: user.displayName ?? user.username,
      score: 1, 
      data: {
        id: user._id.toString(),
        username: user.username,
        // ✅ This sends 'funny-guy' to your frontend
        slug: user.blog?.slug || user.username,
        avatar: user.avatar,
        followersCount: user.followersCount ?? 0,
        isVerified: user.isVerified ?? false,
        bio: user.bio,
      },
    }));
  }

  private async searchPostsWithText(
    query: string,
    limit: number,
  ): Promise<SearchResult[]> {
    const posts = await this.postModel
      .find(
        { 
          status: "published",
          $text: { $search: query } 
        },
        { score: { $meta: "textScore" } }
      )
      .sort({ score: { $meta: "textScore" } })
      .limit(limit * 2)
      .lean<LeanPost[]>();

    return posts.map(post => ({
      type: 'post',
      text: post.title,
      score: post.score || 1,
      data: {
        id: post._id.toString(),
        slug: post.slug,
        title: post.title,
        excerpt: post.excerpt,
        category: post.category,
        tags: post.tags || [],
        views: post.views ?? 0,
        likesCount: post.likesCount ?? 0,
        commentsCount: post.commentsCount ?? 0,
        createdAt: post.createdAt,
        featuredImage: post.featuredImage,
        readingTime: post.readingTime,
      },
    }));
  }

  private async searchCategoriesWithText(
    query: string,
    limit: number,
  ): Promise<SearchResult[]> {
    // Aggregate to find categories matching the search
    const categories = await this.postModel.aggregate([
      { 
        $match: { 
          status: "published",
          category: { $regex: query, $options: 'i' }
        }
      },
      {
        $group: {
          _id: '$category',
          postCount: { $sum: 1 },
          tags: { $addToSet: '$tags' },
          latestPostDate: { $max: '$createdAt' }
        }
      },
      { $sort: { postCount: -1 } },
      { $limit: limit }
    ]);

    return categories.map(cat => ({
      type: 'category',
      text: cat._id,
      score: 1, // Simple scoring for categories
      data: {
        name: cat._id,
        postCount: cat.postCount,
        // Flatten tags from all posts in this category
        relatedTags: [...new Set(cat.tags.flat())].slice(0, 10),
        latestPostDate: cat.latestPostDate,
      },
    }));
  }

  private async searchTagsWithText(
    query: string,
    limit: number,
  ): Promise<SearchResult[]> {
    // Aggregate to find tags matching the search
    const tags = await this.postModel.aggregate([
      { 
        $match: { 
          status: "published",
          tags: { $regex: query, $options: 'i' }
        }
      },
      { $unwind: '$tags' },
      { 
        $match: { 
          tags: { $regex: query, $options: 'i' }
        }
      },
      {
        $group: {
          _id: '$tags',
          postCount: { $sum: 1 },
          categories: { $addToSet: '$category' },
          latestPostDate: { $max: '$createdAt' }
        }
      },
      { $sort: { postCount: -1 } },
      { $limit: limit }
    ]);

    return tags.map(tag => ({
      type: 'tag',
      text: tag._id,
      score: 1, 
      data: {
        name: tag._id,
        postCount: tag.postCount,
        relatedCategories: tag.categories.filter(Boolean),
        latestPostDate: tag.latestPostDate,
      },
    }));
  }

  async getSuggestions(
    query: string,
    limit = 10,
    type?: SearchType,
  ): Promise<{ suggestions: SearchResult[] }> {
    const q = query.trim();
    if (q.length < 2) return { suggestions: [] };

    this.recordSearch(q);
    let results: SearchResult[] = [];

    switch (type) {
      case 'user':
        results = await this.searchUsersWithText(q, limit);
        break;
      
      case 'post':
        results = await this.searchPostsWithText(q, limit);
        break;
      
      case 'category':
        results = await this.searchCategoriesWithText(q, limit);
        break;
      
      case 'tag':
        results = await this.searchTagsWithText(q, limit);
        break;
      
      default: 
        const [users, posts, categories, tags] = await Promise.all([
          this.searchUsersWithText(q, Math.ceil(limit / 4)),
          this.searchPostsWithText(q, Math.ceil(limit / 4)),
          this.searchCategoriesWithText(q, Math.ceil(limit / 4)),
          this.searchTagsWithText(q, Math.ceil(limit / 4)),
        ]);
        results = [...users, ...posts, ...categories, ...tags];
        break;
    }

    return {
      suggestions: results
        .sort((a, b) => b.score - a.score)
        .slice(0, limit),
    };
  }

  async quickSearch(
    query: string,
  ): Promise<{ results: SearchResult[] }> {
    const { suggestions } = await this.getSuggestions(query, 5);
    return { results: suggestions };
  }

  async getPopularSearches(
    limit = 10,
  ): Promise<{ query: string; count: number }[]> {
    const counts: Record<string, number> = {};

    for (const day of this.searchAnalytics.values()) {
      for (const [q, c] of Object.entries(day.queries)) {
        counts[q] = (counts[q] ?? 0) + c;
      }
    }

    return Object.entries(counts)
      .map(([query, count]) => ({ query, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  async getSearchAnalytics(days = 7): Promise<DailySearchAnalytics[]> {
    const out: DailySearchAnalytics[] = [];
    const now = new Date();

    for (let i = 0; i < days; i++) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const key = `analytics:search:${d.toISOString().split('T')[0]}`;
      const day = this.searchAnalytics.get(key);
      if (day) {
        out.push({
          date: d.toISOString().split('T')[0],
          queries: day.queries,
        });
      }
    }

    return out;
  }

  private recordSearch(query: string): void {
    const key = `analytics:search:${new Date().toISOString().split('T')[0]}`;
    const day =
      this.searchAnalytics.get(key) ?? { queries: {} };

    day.queries[query] = (day.queries[query] ?? 0) + 1;
    this.searchAnalytics.set(key, day);
  }
}