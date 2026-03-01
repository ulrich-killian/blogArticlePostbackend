import {
    Controller,
    Post,
    UseInterceptors,
    UploadedFile,
    UseGuards,
    BadRequestException,
  } from '@nestjs/common';
  import { FileInterceptor } from '@nestjs/platform-express';
  import { JwtAuthGuard } from '../auth/jwt-auth.guard';
  import { CloudinaryService } from '../cloudinary/cloudinary.service';
  
  @Controller('upload')
  @UseGuards(JwtAuthGuard)
  export class ImageUploadController {
    constructor(private readonly cloudinaryService: CloudinaryService) {}
  
    @Post('image')
    @UseInterceptors(FileInterceptor('file'))
    async uploadImage(@UploadedFile() file: Express.Multer.File) {
      if (!file) {
        throw new BadRequestException('No file uploaded');
      }
  
      const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
      if (!allowedMimeTypes.includes(file.mimetype)) {
        throw new BadRequestException('Invalid file type. Only images are allowed.');
      }
  
      const maxSize = 5 * 1024 * 1024;
      if (file.size > maxSize) {
        throw new BadRequestException('File too large. Maximum size is 5MB.');
      }
  
      const { url, publicId } = await this.cloudinaryService.uploadImage(file);
  
      return {
        success: true,
        url,
        publicId,
        fileName: file.originalname,
        fileSize: file.size,
        message: 'Image uploaded successfully',
      };
    }
  }