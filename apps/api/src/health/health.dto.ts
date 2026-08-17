import { ApiProperty } from '@nestjs/swagger';
import type { HealthResponse, HealthStatus } from '@ph-ponto/shared';

export class HealthResponseDto implements HealthResponse {
  @ApiProperty({ enum: ['ok', 'degraded'], example: 'ok' })
  public status!: HealthStatus;

  @ApiProperty({ enum: ['api'], example: 'api' })
  public service!: 'api';

  @ApiProperty({ format: 'date-time', example: '2026-08-14T20:00:00.000Z' })
  public timestamp!: string;
}
