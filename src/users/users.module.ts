import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from './user.schema';
import { UsersService } from './users.service';
import { DashboardController } from './users.dashboard.controller';
import {  AuthModule} from '../auth/auth.module';
import { TenantModule } from 'src/tenants/tenant.module';
import { CloudinaryModule } from 'src/cloudinary/cloudinary.module';
import { NotificationModule } from '../notifications/notification.module';  

@Module({
  imports: [
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
    forwardRef(() => AuthModule),
    forwardRef(() => TenantModule),
    CloudinaryModule,
    NotificationModule,
  ],
  controllers: [DashboardController],
  providers: [UsersService],
  exports: [UsersService, MongooseModule],
})
export class UsersModule {}