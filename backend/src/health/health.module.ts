import { Controller, Get, Module, Res } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import {
  ApiOkResponse,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { DataSource } from 'typeorm';
import { Public } from '../authz/decorators';
import { StorageService } from '../documents/storage.service';

export const API_VERSION = '0.1.0';

type Check = 'up' | 'down' | 'disabled';

const readinessSchema = {
  type: 'object',
  required: ['status', 'checks'],
  properties: {
    status: { type: 'string', enum: ['ready', 'not_ready'] },
    checks: {
      type: 'object',
      properties: {
        database: { type: 'string', enum: ['up', 'down', 'disabled'] },
        storage: { type: 'string', enum: ['up', 'down', 'disabled'] },
      },
    },
  },
};

@ApiTags('health')
@Controller('health')
class HealthController {
  constructor(
    private readonly dataSource: DataSource,
    private readonly moduleRef: ModuleRef,
  ) {}

  @Get()
  @Public()
  @ApiOkResponse({
    description: 'Liveness: el proceso responde. No comprueba dependencias.',
    schema: {
      type: 'object',
      required: ['status', 'service', 'version'],
      properties: {
        status: { type: 'string', enum: ['ok'] },
        service: { type: 'string', enum: ['securedocs-api'] },
        version: { type: 'string', example: API_VERSION },
      },
    },
  })
  getHealth() {
    return { status: 'ok', service: 'securedocs-api', version: API_VERSION };
  }

  @Get('ready')
  @Public()
  @ApiOkResponse({
    description: 'Readiness: MySQL y almacenamiento disponibles',
    schema: readinessSchema,
  })
  @ApiServiceUnavailableResponse({
    description: 'Alguna dependencia no está disponible',
    schema: readinessSchema,
  })
  async ready(@Res({ passthrough: true }) res: Response) {
    let database: Check = 'disabled';
    if (this.dataSource.isInitialized) {
      try {
        await Promise.race([
          this.dataSource.query('SELECT 1'),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('timeout')), 2000),
          ),
        ]);
        database = 'up';
      } catch {
        database = 'down';
      }
    }
    let storage: Check = 'disabled';
    try {
      const svc = this.moduleRef.get(StorageService, { strict: false });
      storage = (await svc.probe()) ? 'up' : 'down';
    } catch {
      storage = 'disabled';
    }
    const ok = database === 'up' && storage === 'up';
    res.status(ok ? 200 : 503);
    return {
      status: ok ? 'ready' : 'not_ready',
      checks: { database, storage },
    };
  }
}

@Module({ controllers: [HealthController] })
export class HealthModule {}
