import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiOkResponse } from '@nestjs/swagger';

@ApiTags('health')
@Controller()
export class AppController {
  @Get('health')
  @ApiOperation({ summary: 'Vérifier l\'état de l\'API', description: 'Endpoint de health check utilisé par Docker et les outils de monitoring.' })
  @ApiOkResponse({ description: 'API en bonne santé', schema: { example: { status: 'ok', timestamp: '2026-01-15T03:00:00.000Z', version: '1.0.0', name: 'Bazario API' } } })
  healthCheck() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      name: 'Bazario API',
    };
  }
}
