import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Tenant } from './tenant.schema';
import { CreateTenantDto } from './tenant.dto';

@Injectable()
export class TenantService {
  constructor(
    @InjectModel(Tenant.name) private tenantModel: Model<Tenant>,
  ) {}

  async createTenant(dto: CreateTenantDto, userId: string): Promise<Tenant> {
    const existingSlug = await this.tenantModel.findOne({ slug: dto.slug });
    if (existingSlug) {
      throw new BadRequestException('Slug already exists');
    }

    const existingUserTenant = await this.tenantModel.findOne({
      $or: [
        { owner: userId },
        { userId: userId }
      ]
    });
    
    if (existingUserTenant) {
      throw new BadRequestException('User already has a tenant/blog');
    }

    const tenant = new this.tenantModel({
      name: dto.name,
      slug: dto.slug,
      description: dto.description || '',
      owner: userId,
      userId: userId,
    });

    return tenant.save();
  }

  async findByOwner(userId: string): Promise<Tenant | null> {
    return this.tenantModel.findOne({
      $or: [
        { owner: userId },
        { userId: userId }
      ]
    }).exec();
  }

  async findByUserId(userId: string): Promise<Tenant | null> {
    return this.findByOwner(userId); 
  }

  async findAll(): Promise<Tenant[]> {
    return this.tenantModel.find().exec();
  }

  async findBySlug(slug: string): Promise<Tenant | null> {
    return this.tenantModel.findOne({ slug }).exec();
  }

  async findById(id: string): Promise<Tenant | null> {
    return this.tenantModel.findById(id).exec();
  }
}