import {
  INestApplication,
  ValidationError,
  ValidationPipe,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import type { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import { CSRF_HEADER } from './auth/access.guard';
import { Errors } from './common/api-error';
import { HttpExceptionFilter } from './common/http-exception.filter';
import { requestIdMiddleware } from './common/request-context';
import { API_VERSION } from './health/health.module';

function flatten(
  errors: ValidationError[],
  prefix = '',
): { field: string; message: string }[] {
  return errors.flatMap((e) => {
    const field = prefix ? `${prefix}.${e.property}` : e.property;
    const own = Object.values(e.constraints ?? {}).map((message) => ({
      field,
      message,
    }));
    return [...own, ...flatten(e.children ?? [], field)];
  });
}

/** Configuración común para main.ts y las pruebas e2e. */
export function configureApp(app: INestApplication) {
  const config = app.get(ConfigService);
  const express = app as NestExpressApplication;
  express.set('trust proxy', config.getOrThrow<number>('TRUST_PROXY'));
  express.disable('x-powered-by');
  app.setGlobalPrefix('api/v1');
  app.use(requestIdMiddleware);

  const apiHelmet = helmet({
    contentSecurityPolicy: {
      directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] },
    },
    crossOriginResourcePolicy: { policy: 'same-site' },
  });
  const docsHelmet = helmet({ contentSecurityPolicy: false });
  app.use((req: Request, res: Response, next: NextFunction) =>
    req.path.startsWith('/api/docs')
      ? docsHelmet(req, res, next)
      : apiHelmet(req, res, next),
  );
  app.use(cookieParser());
  app.enableCors({
    origin: new URL(config.getOrThrow<string>('FRONTEND_ORIGIN')).origin,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Accept', 'X-CSRF-Token', 'X-Request-Id'],
    exposedHeaders: [
      'X-Request-Id',
      'Content-Disposition',
      'X-Document-SHA256',
    ],
    maxAge: 600,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      stopAtFirstError: false,
      exceptionFactory: (errors) => Errors.validation(flatten(errors)),
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());

  if (config.get('NODE_ENV') !== 'production') {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('SecureDocs API')
        .setDescription(
          'Contrato v' +
            API_VERSION +
            '. Sesión por cookie HttpOnly (sd_session; __Host-sd_session con HTTPS). ' +
            'Operaciones POST/PUT/PATCH/DELETE autenticadas requieren el encabezado X-CSRF-Token. ' +
            'Errores: {code, message, requestId, details?}. Ver docs/api.md.',
        )
        .setVersion(API_VERSION)
        .addCookieAuth('sd_session')
        .addApiKey({ type: 'apiKey', in: 'header', name: CSRF_HEADER }, 'csrf')
        .build(),
    );
    SwaggerModule.setup('api/docs', app, document);
  }
  app.enableShutdownHooks();
  return app;
}
