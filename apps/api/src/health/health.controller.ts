import { Controller, Get, HttpStatus, Inject, Res } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { HealthResponse } from '@ph-ponto/shared';
import type { Response } from 'express';

import { Public } from '../auth/auth.decorators.js';
import { HealthResponseDto } from './health.dto.js';
import { HealthService } from './health.service.js';

@ApiTags('Saúde')
@Public()
@Controller('health')
export class HealthController {
  public constructor(@Inject(HealthService) private readonly healthService: HealthService) {}

  @Get()
  @ApiOperation({ summary: 'Verifica se o processo da API está ativo' })
  @ApiResponse({ status: HttpStatus.OK, type: HealthResponseDto })
  public liveness(): HealthResponse {
    return this.healthService.liveness();
  }

  @Get('ready')
  @ApiOperation({ summary: 'Verifica se a API, o PostgreSQL e o armazenamento estão prontos' })
  @ApiResponse({ status: HttpStatus.OK, type: HealthResponseDto })
  @ApiResponse({
    status: HttpStatus.SERVICE_UNAVAILABLE,
    type: HealthResponseDto,
    description: 'O PostgreSQL ou o armazenamento não está disponível.',
  })
  public async readiness(@Res({ passthrough: true }) response: Response): Promise<HealthResponse> {
    const health = await this.healthService.readiness();

    if (health.status === 'degraded') {
      response.status(HttpStatus.SERVICE_UNAVAILABLE);
    }

    return health;
  }
}
