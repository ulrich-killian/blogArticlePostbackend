import { Module } from '@nestjs/common';
import { ImageUploadController } from './image-upload.controller';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule], 
  controllers: [ImageUploadController],
  providers: [CloudinaryService],
})
export class UploadModule {}