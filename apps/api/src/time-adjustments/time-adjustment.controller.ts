import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  ParseUUIDPipe,
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
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';

import { CurrentUser, Roles } from '../auth/auth.decorators.js';
import { ClientContextService } from '../auth/client-context.service.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { IdempotencyKeyPipe } from '../idempotency/idempotency-key.pipe.js';
import { AdminTimePunchMutationResponseDto } from '../time-punches/time-punch.dto.js';
import { CorrectTimePunchDto } from './time-adjustment.dto.js';
import { TimeAdjustmentService } from './time-adjustment.service.js';

@ApiTags('Correções de ponto')
@ApiBearerAuth()
@Roles('ADMIN')
@Controller('time-punches')
export class TimeAdjustmentController {
  public constructor(
    @Inject(TimeAdjustmentService) private readonly adjustments: TimeAdjustmentService,
    @Inject(ClientContextService) private readonly clientContexts: ClientContextService,
    @Inject(IdempotencyKeyPipe) private readonly idempotencyKeys: IdempotencyKeyPipe,
  ) {}

  @Post(':punchId/adjustments')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Corrige um horário preservando o histórico original' })
  @ApiParam({ name: 'punchId', format: 'uuid' })
  @ApiHeader({ name: 'Idempotency-Key', required: true, description: 'UUID da ação.' })
  @ApiBody({ type: CorrectTimePunchDto })
  @ApiCreatedResponse({ type: AdminTimePunchMutationResponseDto })
  public async correct(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('punchId', new ParseUUIDPipe()) punchId: string,
    @Headers('idempotency-key') rawIdempotencyKey: string | undefined,
    @Body() input: CorrectTimePunchDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AdminTimePunchMutationResponseDto> {
    const idempotencyKey = this.idempotencyKeys.transform(rawIdempotencyKey);
    const result = await this.adjustments.correct(
      actor,
      punchId,
      input,
      idempotencyKey,
      this.clientContexts.fromRequest(request),
    );
    if (result.replayed) {
      response.setHeader('Idempotency-Replayed', 'true');
    }
    return result.body;
  }
}
