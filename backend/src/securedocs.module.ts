import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { MulterModule } from '@nestjs/platform-express';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { memoryStorage } from 'multer';
import { AuditController } from './audit/audit.controller';
import { AuditService } from './audit/audit.service';
import { AccessGuard } from './auth/access.guard';
import { AuthController } from './auth/auth.controller';
import { AuthService } from './auth/auth.service';
import { MfaService } from './auth/mfa.service';
import { SessionService } from './auth/session.service';
import { AUTH_LIMIT_KEY } from './common/rate-limit';
import { KeyService } from './crypto/key.service';
import { ENTITIES } from './database/entities';
import { DocumentCryptoService } from './documents/document-crypto.service';
import { DocumentsController } from './documents/documents.controller';
import { DocumentsService } from './documents/documents.service';
import { StorageService } from './documents/storage.service';
import { ReportsController } from './reports/reports.controller';
import { UsersController } from './users/users.controller';
import { UsersService } from './users/users.service';

/**
 * Funcionalidad que depende de MySQL y de las claves. Solo se carga con
 * DB_ENABLED=true (ver AppModule); sin ella la API expone únicamente salud.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature(ENTITIES),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [
          {
            name: 'default',
            ttl: 60_000,
            limit: config.getOrThrow<number>('RATE_LIMIT_PER_MINUTE'),
          },
          {
            name: 'auth',
            ttl: 60_000,
            limit: config.getOrThrow<number>('AUTH_RATE_LIMIT_PER_MINUTE'),
            // Solo en rutas marcadas con @AuthRateLimit().
            skipIf: (ctx) =>
              !Reflect.getMetadata(AUTH_LIMIT_KEY, ctx.getHandler()),
          },
        ],
      }),
    }),
    MulterModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        storage: memoryStorage(),
        limits: {
          fileSize: config.getOrThrow<number>('UPLOAD_MAX_BYTES'),
          files: 1,
          fields: 4,
          fieldSize: 1024,
          parts: 6,
          headerPairs: 50,
        },
      }),
    }),
  ],
  controllers: [
    AuthController,
    UsersController,
    DocumentsController,
    AuditController,
    ReportsController,
  ],
  providers: [
    KeyService,
    AuditService,
    SessionService,
    MfaService,
    AuthService,
    UsersService,
    StorageService,
    DocumentCryptoService,
    DocumentsService,
    // Orden: límite de solicitudes antes que autenticación/autorización.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: AccessGuard },
  ],
  exports: [StorageService],
})
export class SecureDocsModule {}
