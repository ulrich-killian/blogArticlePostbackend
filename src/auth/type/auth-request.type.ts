import type { Request } from 'express';

export interface AuthRequest extends Request {
  user: {
    sub: string;          
    userId: string;     
    tenantId: string;
    email?: string;
    username?: string;
    role?: string;
    hasBlog?: boolean;
  };
}
