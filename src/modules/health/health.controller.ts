import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import {
  HealthCheck,
  HealthCheckService,
  PrismaHealthIndicator,
} from '@nestjs/terminus';
import { PrismaService } from '../../database/prisma.service';
import { Public } from '../../common/decorators';

@ApiTags('Health')
@Controller()
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private prismaHealth: PrismaHealthIndicator,
    private prisma: PrismaService,
  ) {}

  @Public()
  @Get('health')
  @HealthCheck()
  @ApiOperation({ summary: 'Health check endpoint' })
  check() {
    return this.health.check([
      () => this.prismaHealth.pingCheck('database', this.prisma),
    ]).then((result) => ({
      status: result.status === 'ok' ? 'ok' : 'error',
      service: 'ticket-api',
      database: result.details?.database?.status === 'up' ? 'connected' : 'disconnected',
      timestamp: new Date().toISOString(),
    }));
  }

  @Public()
  @Get('api/v1/health')
  @HealthCheck()
  @ApiOperation({ summary: 'Versioned health check endpoint' })
  checkV1() {
    return this.check();
  }
}
