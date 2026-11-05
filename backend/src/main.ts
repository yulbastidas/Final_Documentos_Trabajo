import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  configureApp(app);
  const config = app.get(ConfigService);
  await app.listen(config.getOrThrow<number>('PORT'), '0.0.0.0');
}
bootstrap().catch((e: unknown) => {
  // Solo el tipo y el mensaje de configuración; nunca valores de variables.
  const message = e instanceof Error ? e.message.split('\n')[0] : '';
  console.error(
    'No se pudo iniciar la API. Revisar configuración local.',
    message.slice(0, 200),
  );
  process.exitCode = 1;
});
