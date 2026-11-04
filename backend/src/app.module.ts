import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import * as Joi from 'joi';
import { HealthModule } from './health/health.module';
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      validationSchema: Joi.object({
        NODE_ENV: Joi.string()
          .valid('development', 'test', 'production')
          .default('development'),
        PORT: Joi.number().port().default(4000),
        FRONTEND_ORIGIN: Joi.string().uri().default('http://localhost:3000'),
        DB_ENABLED: Joi.boolean().default(false),
        DB_HOST: Joi.string().default('localhost'),
        DB_PORT: Joi.number().port().default(3306),
        DB_USER: Joi.string().default('securedocs_app'),
        DB_NAME: Joi.string().default('securedocs'),
        DB_PASSWORD: Joi.when('DB_ENABLED', {
          is: true,
          then: Joi.string().required(),
          otherwise: Joi.string().allow('').optional(),
        }),
      }),
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'mysql' as const,
        host: config.getOrThrow<string>('DB_HOST'),
        port: config.getOrThrow<number>('DB_PORT'),
        username: config.getOrThrow<string>('DB_USER'),
        password: config.get<string>('DB_PASSWORD'),
        database: config.getOrThrow<string>('DB_NAME'),
        entities: [],
        synchronize: false,
        dropSchema: false,
        logging: false,
        retryAttempts: 0,
        manualInitialization: !config.getOrThrow<boolean>('DB_ENABLED'),
      }),
    }),
    HealthModule,
  ],
})
export class AppModule {}
