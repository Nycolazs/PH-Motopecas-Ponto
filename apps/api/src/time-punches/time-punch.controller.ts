import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiHeader,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';

import { CurrentUser, Roles } from '../auth/auth.decorators.js';
import { ClientContextService } from '../auth/client-context.service.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { IdempotencyKeyPipe } from '../idempotency/idempotency-key.pipe.js';
import {
  AdminTimePunchMutationResponseDto,
  EmptyTimePunchDto,
  ManualTimePunchDto,
  TimePunchMutationResponseDto,
} from './time-punch.dto.js';
import { TimePunchService } from './time-punch.service.js';
import type { MutationHttpResult } from './time-punch.types.js';

function applyReplayHeader(response: Response, replayed: boolean): void {
  if (replayed) {
    response.setHeader('Idempotency-Replayed', 'true');
  }
}

@ApiTags('Pontos')
@ApiBearerAuth()
@Controller('time-punches')
export class TimePunchController {
  public constructor(
    @Inject(TimePunchService) private readonly punches: TimePunchService,
    @Inject(ClientContextService) private readonly clientContexts: ClientContextService,
    @Inject(IdempotencyKeyPipe) private readonly idempotencyKeys: IdempotencyKeyPipe,
  ) {}

  @Post()
  @Roles('EMPLOYEE')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Registra o próximo ponto do funcionário autenticado' })
  @ApiHeader({ name: 'Idempotency-Key', required: true, description: 'UUID da ação.' })
  @ApiBody({ type: EmptyTimePunchDto })
  @ApiCreatedResponse({ type: TimePunchMutationResponseDto })
  public async createOwn(
    @CurrentUser() actor: AuthenticatedUser,
    @Headers('idempotency-key') rawIdempotencyKey: string | undefined,
    @Body() _input: EmptyTimePunchDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<TimePunchMutationResponseDto> {
    const idempotencyKey = this.idempotencyKeys.transform(rawIdempotencyKey);
    const result = await this.punches.createEmployeePunch(actor, idempotencyKey);
    applyReplayHeader(response, result.replayed);
    return result.body;
  }

  @Post('manual')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Insere manualmente um ponto com histórico administrativo' })
  @ApiHeader({ name: 'Idempotency-Key', required: true, description: 'UUID da ação.' })
  @ApiBody({ type: ManualTimePunchDto })
  @ApiCreatedResponse({ type: AdminTimePunchMutationResponseDto })
  public async insertManual(
    @CurrentUser() actor: AuthenticatedUser,
    @Headers('idempotency-key') rawIdempotencyKey: string | undefined,
    @Body() input: ManualTimePunchDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AdminTimePunchMutationResponseDto> {
    const idempotencyKey = this.idempotencyKeys.transform(rawIdempotencyKey);
    const result: MutationHttpResult<AdminTimePunchMutationResponseDto> =
      await this.punches.insertManualPunch(
        actor,
        input,
        idempotencyKey,
        this.clientContexts.fromRequest(request),
      );
    applyReplayHeader(response, result.replayed);
    return result.body;
  }
}
