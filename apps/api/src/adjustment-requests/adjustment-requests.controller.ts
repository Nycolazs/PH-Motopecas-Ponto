import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';

import { CurrentUser, Roles } from '../auth/auth.decorators.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { ClientContextService } from '../auth/client-context.service.js';
import { IdempotencyKeyPipe } from '../idempotency/idempotency-key.pipe.js';
import {
  CreateAdjustmentRequestDto,
  ListAdjustmentRequestsQueryDto,
  ReviewAdjustmentRequestDto,
} from './adjustment-request.dto.js';
import {
  AdjustmentRequestListViewDto,
  AdjustmentRequestViewDto,
  PendingCountViewDto,
  ReviewAdjustmentResponseDto,
} from './adjustment-request.view.js';
import { AdjustmentRequestsService } from './adjustment-requests.service.js';

@ApiTags('Solicitações de Ajuste')
@ApiBearerAuth()
@Controller('adjustment-requests')
export class AdjustmentRequestsController {
  public constructor(
    @Inject(AdjustmentRequestsService)
    private readonly service: AdjustmentRequestsService,
    @Inject(ClientContextService)
    private readonly clientContexts: ClientContextService,
    @Inject(IdempotencyKeyPipe)
    private readonly idempotencyKeys: IdempotencyKeyPipe,
  ) {}

  @Post()
  @Roles('EMPLOYEE')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Funcionário solicita o ajuste de um ponto registrado incorretamente' })
  @ApiBody({ type: CreateAdjustmentRequestDto })
  @ApiCreatedResponse({ type: AdjustmentRequestViewDto })
  public create(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() input: CreateAdjustmentRequestDto,
    @Req() request: Request,
  ): Promise<AdjustmentRequestViewDto> {
    return this.service.create(actor, input, this.clientContexts.fromRequest(request));
  }

  @Get('my')
  @Roles('EMPLOYEE')
  @ApiOperation({ summary: 'Funcionário lista suas próprias solicitações de ajuste' })
  @ApiQuery({ type: ListAdjustmentRequestsQueryDto })
  @ApiOkResponse({ type: AdjustmentRequestListViewDto })
  public listMine(
    @CurrentUser() actor: AuthenticatedUser,
    @Query() query: ListAdjustmentRequestsQueryDto,
  ): Promise<AdjustmentRequestListViewDto> {
    return this.service.listMine(actor, query);
  }

  @Get()
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Admin lista todas as solicitações de ajuste de ponto' })
  @ApiQuery({ type: ListAdjustmentRequestsQueryDto })
  @ApiOkResponse({ type: AdjustmentRequestListViewDto })
  public listAll(
    @Query() query: ListAdjustmentRequestsQueryDto,
  ): Promise<AdjustmentRequestListViewDto> {
    return this.service.listAll(query);
  }

  @Get('pending-count')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Retorna a quantidade de solicitações de ajuste pendentes' })
  @ApiOkResponse({ type: PendingCountViewDto })
  public getPendingCount(): Promise<PendingCountViewDto> {
    return this.service.getPendingCount();
  }

  @Post(':id/approve')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Admin aprova a solicitação e efetiva a correção do ponto' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiHeader({ name: 'Idempotency-Key', required: true, description: 'UUID da ação.' })
  @ApiBody({ type: ReviewAdjustmentRequestDto })
  @ApiOkResponse({ type: ReviewAdjustmentResponseDto })
  public approve(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) requestId: string,
    @Headers('idempotency-key') rawIdempotencyKey: string | undefined,
    @Body() input: ReviewAdjustmentRequestDto,
    @Req() request: Request,
  ): Promise<ReviewAdjustmentResponseDto> {
    const idempotencyKey = this.idempotencyKeys.transform(rawIdempotencyKey);
    return this.service.approve(
      actor,
      requestId,
      input,
      idempotencyKey,
      this.clientContexts.fromRequest(request),
    );
  }

  @Post(':id/reject')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Admin rejeita a solicitação de ajuste com parecer' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiBody({ type: ReviewAdjustmentRequestDto })
  @ApiOkResponse({ type: ReviewAdjustmentResponseDto })
  public reject(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) requestId: string,
    @Body() input: ReviewAdjustmentRequestDto,
    @Req() request: Request,
  ): Promise<ReviewAdjustmentResponseDto> {
    return this.service.reject(actor, requestId, input, this.clientContexts.fromRequest(request));
  }
}
