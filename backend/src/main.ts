import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  app.setGlobalPrefix('api/v1');
  app.enableCors({ origin: config.getOrThrow<string>('FRONTEND_ORIGIN') });
  if (config.get('NODE_ENV') !== 'production') {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('SecureDocs API')
        .setDescription('Fase 0: solo salud. Contratos futuros en docs/api.md.')
        .setVersion('0.0.0')
        .build(),
    );
    SwaggerModule.setup('api/docs', app, document);
  }
  app.enableShutdownHooks();
  await app.listen(config.getOrThrow<number>('PORT'), '0.0.0.0');
}
bootstrap().catch(() => {
  console.error('No se pudo iniciar la API. Revisar configuración local.');
  process.exitCode = 1;
});
