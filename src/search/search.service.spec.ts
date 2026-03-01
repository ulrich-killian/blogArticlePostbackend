import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { SearchService } from './search.service';
import { User } from '../users/user.schema';
import { Post } from '../post/post.schema';

const mockUserModel = {
  find: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  lean: jest.fn().mockResolvedValue([]),
};

const mockPostModel = {
  find: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  lean: jest.fn().mockResolvedValue([]),
};

describe('SearchService', () => {
  let service: SearchService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SearchService,
        {
          provide: getModelToken(User.name),
          useValue: mockUserModel,
        },
        {
          provide: getModelToken(Post.name),
          useValue: mockPostModel,
        },
      ],
    }).compile();

    service = module.get<SearchService>(SearchService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('escapeRegex', () => {
    it('should escape regex special characters', () => {
      const input = 'test.*+?^${}()|[]\\';
      const escaped = (service as any).escapeRegex(input);
      expect(escaped).toBe('test\\.\\*\\+\\?\\^\\$\\{\\}\\(\\)\\|\\[\\]\\\\');
    });

    it('should return normal string unchanged', () => {
      const input = 'normal text';
      const escaped = (service as any).escapeRegex(input);
      expect(escaped).toBe(input);
    });
  });

  describe('getSuggestions', () => {
    it('should search users when type is user', async () => {
      const mockUsers = [
        { _id: '1', username: 'john', displayName: 'John Doe', email: 'john@example.com' },
      ];
      
      mockUserModel.lean.mockResolvedValueOnce(mockUsers);
      
      const result = await service.getSuggestions('john', 5, 'user');
      
      expect(mockUserModel.find).toHaveBeenCalled();
      expect(result.type).toBe('user');
      expect(result.suggestions).toHaveLength(1);
      expect(result.suggestions[0].type).toBe('user');
    });

    it('should search posts when type is post', async () => {
      const mockPosts = [
        { _id: '1', title: 'Test Post', slug: 'test-post', category: 'tech' },
      ];
      
      mockPostModel.lean.mockResolvedValueOnce(mockPosts);
      
      const result = await service.getSuggestions('test', 5, 'post');
      
      expect(mockPostModel.find).toHaveBeenCalled();
      expect(result.type).toBe('post');
      expect(result.suggestions).toHaveLength(1);
      expect(result.suggestions[0].type).toBe('post');
    });

    it('should search both users and posts when no type specified', async () => {
      mockUserModel.lean.mockResolvedValueOnce([]);
      mockPostModel.lean.mockResolvedValueOnce([]);
      
      const result = await service.getSuggestions('test', 5);
      
      expect(mockUserModel.find).toHaveBeenCalled();
      expect(mockPostModel.find).toHaveBeenCalled();
      expect(result.suggestions).toBeDefined();
    });

    it('should handle regex special characters safely', async () => {
      const result = await service.getSuggestions('test.*', 5);
      expect(result.query).toBe('test.*');
    });
  });

  describe('quickSearch', () => {
    it('should search posts and users', async () => {
      mockPostModel.lean.mockResolvedValueOnce([]);
      mockUserModel.lean.mockResolvedValueOnce([]);
      
      const result = await service.quickSearch('test');
      
      expect(mockPostModel.find).toHaveBeenCalled();
      expect(mockUserModel.find).toHaveBeenCalled();
      expect(result).toHaveProperty('posts');
      expect(result).toHaveProperty('users');
    });
  });
});