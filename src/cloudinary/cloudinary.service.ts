import { Injectable, BadRequestException } from '@nestjs/common';
import { v2 as cloudinary } from 'cloudinary';

@Injectable()
export class CloudinaryService {
  async uploadImage(
    file: Express.Multer.File,
    folder: string = 'blog-app'
  ): Promise<{ url: string; publicId: string }> {
    try {

      const b64 = Buffer.from(file.buffer).toString('base64');
      const dataURI = `data:${file.mimetype};base64,${b64}`;

      const result = await cloudinary.uploader.upload(dataURI, {
        folder,
        resource_type: 'auto',
        transformation: [
          { width: 1200, crop: 'limit' },
          { quality: 'auto' },
          { fetch_format: 'auto' },
        ],
      });

      return {
        url: result.secure_url,
        publicId: result.public_id,
      };
    } catch (error) {
      throw new BadRequestException(`Image upload failed: ${error.message}`);
    }
  }

  async uploadOgImage(
    buffer: Buffer,
    publicId: string
  ): Promise<{ url: string; publicId: string }> {
    return new Promise((resolve, reject) => {
      cloudinary.uploader.upload_stream(
        {
          folder: 'blog-og-images',
          public_id: publicId,
          format: 'png',
        },
        (error, result) => {
          if (error) return reject(error);
  
          if (!result?.secure_url || !result?.public_id) {
            return reject(new Error('Cloudinary upload failed'));
          }
  
          resolve({
            url: result.secure_url,
            publicId: result.public_id,
          });
        }
      ).end(buffer);
    });
  }
  
  

  async deleteImage(publicId: string): Promise<void> {
    try {
      await cloudinary.uploader.destroy(publicId);
    } catch (error) {
      console.error('Failed to delete image:', error);
    }
  }
}