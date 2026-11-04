import { Controller, Get, Module } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
@ApiTags('health')
@Controller('health')
class HealthController {
  @Get()
  @ApiOkResponse({
    description: 'Liveness de la API; no comprueba base de datos.',
    schema: {
      type: 'object',
      required: ['status', 'service', 'version'],
      properties: {
        status: { type: 'string', enum: ['ok'] },
        service: { type: 'string', enum: ['securedocs-api'] },
        version: { type: 'string', enum: ['0.0.0'] },
      },
    },
  })
  getHealth() {
    return { status: 'ok', service: 'securedocs-api', version: '0.0.0' };
  }
}
@Module({ controllers: [HealthController] })
export class HealthModule {}
