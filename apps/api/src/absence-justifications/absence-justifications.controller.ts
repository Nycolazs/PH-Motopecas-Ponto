import {
  Body,
  Controller,
  Get,
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
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';

import { CurrentUser, Roles } from '../auth/auth.decorators.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { ClientContextService } from '../auth/client-context.service.js';
import {
  CreateAbsenceJustificationDto,
  ListAbsenceJustificationsQueryDto,
  RevokeAbsenceJustificationDto,
} from './absence-justification.dto.js';
import {
  AbsenceJustificationListViewDto,
  AbsenceJustificationViewDto,
} from './absence-justification.view.js';
import { AbsenceJustificationsService } from './absence-justifications.service.js';

@ApiTags('Abonos e atestados')
@ApiBearerAuth()
@Roles('ADMIN')
@Controller('absence-justifications')
export class AbsenceJustificationsController {
  public constructor(
    @Inject(AbsenceJustificationsService)
    private readonly justifications: AbsenceJustificationsService,
    @Inject(ClientContextService) private readonly clientContext: ClientContextService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Abona um dia ou registra um atestado para justificar a falta' })
  @ApiBody({ type: CreateAbsenceJustificationDto })
  @ApiCreatedResponse({ type: AbsenceJustificationViewDto })
  public create(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() input: CreateAbsenceJustificationDto,
    @Req() request: Request,
  ): Promise<AbsenceJustificationViewDto> {
    return this.justifications.create(actor, input, this.clientContext.fromRequest(request));
  }

  @Get()
  @ApiOperation({ summary: 'Lista abonos e atestados (inclusive os cancelados)' })
  @ApiOkResponse({ type: AbsenceJustificationListViewDto })
  public list(
    @Query() query: ListAbsenceJustificationsQueryDto,
  ): Promise<AbsenceJustificationListViewDto> {
    return this.justifications.list(query);
  }

  @Post(':id/revoke')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancela um abono ou atestado, mantendo o histórico' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiBody({ type: RevokeAbsenceJustificationDto })
  @ApiOkResponse({ type: AbsenceJustificationViewDto })
  public revoke(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() input: RevokeAbsenceJustificationDto,
    @Req() request: Request,
  ): Promise<AbsenceJustificationViewDto> {
    return this.justifications.revoke(actor, id, input, this.clientContext.fromRequest(request));
  }
}
