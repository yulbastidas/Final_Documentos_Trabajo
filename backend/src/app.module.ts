import { Module } from '@nestjs/common';
import { ConditionalModule, ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { envValidationSchema } from './config/env.validation';
import { typeormOptions } from './database/typeorm.options';
import { HealthModule } from './health/health.module';
import { SecureDocsModule } from './securedocs.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      validationSchema: envValidationSchema,
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        ...typeormOptions({
          host: config.getOrThrow<string>('DB_HOST'),
          port: config.getOrThrow<number>('DB_PORT'),
          username: config.getOrThrow<string>('DB_USER'),
          password: config.get<string>('DB_PASSWORD'),
          database: config.getOrThrow<string>('DB_NAME'),
        }),
        retryAttempts: 0,
        manualInitialization: !config.getOrThrow<boolean>('DB_ENABLED'),
      }),
    }),
    HealthModule,
    // Autenticación, usuarios, documentos, auditoría y reportes requieren MySQL.
    ConditionalModule.registerWhen(
      SecureDocsModule,
      (env) => String(env.DB_ENABLED).toLowerCase() === 'true',
    ),
  ],
})
export class AppModule {}
