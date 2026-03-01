import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Tenant } from '../../tenants/tenant.schema';

@Injectable()
export class HasBlogGuard implements CanActivate {
  constructor(
    @InjectModel(Tenant.name) private tenantModel: Model<Tenant>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('Authentication required');
    }

    const userId = user.userId || user.sub;
    
    const tenant = await this.tenantModel.findOne({
      $or: [
        { owner: userId },
        { userId: userId }
      ]
    });

    if (!tenant) {
      throw new ForbiddenException(
        "**Blog Required**\n\n" +
        "You need to create a blog before you can post.\n\n" +
        "**Action Required:**\n" +
        "1. Go to: POST /tenants\n" +
        "2. Create your blog\n" +
        "3. Come back here to post!\n\n" +
        "Without a blog, you can only:\n" +
        "• Read other blogs\n" +
        "• Comment on posts\n" +
        "• Share posts"
      );
    }

    // Ensure token contains tenantId and it matches the tenant owned by this user
    const tokenTenantId = user.tenantId;
    if (!tokenTenantId) {
      throw new ForbiddenException('Access denied: token is missing tenantId. Please obtain a new token after creating your blog.');
    }

    if (tenant._id.toString() !== tokenTenantId) {
      throw new ForbiddenException('Token tenantId does not match your blog. Access denied.');
    }

    request.tenant = tenant;

    return true;
  }
}