import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { EventEmitterModule } from '@nestjs/event-emitter';
import * as Joi from 'joi';

import { AppController } from './app.controller';
import { AppService } from './app.service';

import { AuthModule } from './auth/auth.module';
import { TenantModule } from './tenants/tenant.module';
import { BlogsModule } from './blogs/blogs.module';
import { PostModule } from './post/post.module';
import { CloudinaryModule } from './cloudinary/cloudinary.module';
import { UploadModule } from './uploads/upload.module';
import { CommentsModule } from './comments/comments.module';
import { UsersModule } from './users/users.module';
import { SearchModule } from './search/search.module';

@Module({
  imports: [
    EventEmitterModule.forRoot({
      wildcard: false,
      delimiter: '.',
      maxListeners: 10,
      verboseMemoryLeak: true,
      ignoreErrors: false,
    }),
    
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: `.env.${process.env.NODE_ENV || 'development'}`,
      validationSchema: Joi.object({
        GOOGLE_CALLBACK_URL: Joi.string().uri().required(),
        MONGO_URI: Joi.string().required(),
        JWT_SECRET: Joi.string().required().min(10).messages({
        'string.min': 'JWT_SECRET should be at least 10 characters long (you have {#length})',
        'any.required': 'JWT_SECRET is required'
        }),
        
        PORT: Joi.number().default(4000),
        NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
        NEXT_PUBLIC_API_URL: Joi.string().uri().optional(),
        
      
        EMAIL_HOST: Joi.string().optional(),
        EMAIL_PORT: Joi.number().optional(),
        EMAIL_USER: Joi.string().optional(),
        EMAIL_PASS: Joi.string().optional(),
      }),
      validationOptions: {
        abortEarly: false, 
        allowUnknown: true,
      },
    }),

    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        return {
          uri: configService.get<string>('MONGO_URI'),

          connectionFactory: (connection) => {

            if (configService.get('NODE_ENV') === 'development') {
              console.log('MongoDB connected successfully');
            }
            return connection;
          },
        };
      },
    }),
    
    AuthModule,
    TenantModule,
    BlogsModule,
    PostModule,
    CloudinaryModule,
    UploadModule,
    CommentsModule,
    UsersModule,
    SearchModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}