import {
  Body,
  Controller,
  Get,
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
  ApiNotFoundResponse,
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
import {
  ListCalendarExceptionsQueryDto,
  ResolveCalendarExceptionQueryDto,
  UpsertCalendarExceptionDto,
} from './calendar-exception.dto.js';
import { CalendarExceptionResolverService } from './calendar-exception-resolver.service.js';
import {
  CalendarExceptionDetailViewDto,
  CalendarExceptionListViewDto,
  ResolvedCalendarExceptionViewDto,
} from './calendar-exception.view.js';
import { CalendarExceptionsService } from './calendar-exceptions.service.js';

@ApiTags('Exceções de calendário')
@ApiBearerAuth()
@Roles('ADMIN')
@Controller('calendar-exceptions')
export class CalendarExceptionsController {
  public constructor(
    @Inject(CalendarExceptionsService) private readonly exceptions: CalendarExceptionsService,
    @Inject(CalendarExceptionResolverService)
    private readonly resolver: CalendarExceptionResolverService,
    @Inject(ClientContextService) private readonly clientContext: ClientContextService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Adiciona uma revisão de exceção de calendário' })
  @ApiBody({ type: UpsertCalendarExceptionDto })
  @ApiCreatedResponse({ type: CalendarExceptionDetailViewDto })
  public upsert(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() input: UpsertCalendarExceptionDto,
    @Req() request: Request,
  ): Promise<CalendarExceptionDetailViewDto> {
    return this.exceptions.upsert(actor, input, this.clientContext.fromRequest(request));
  }

  @Get()
  @ApiOperation({ summary: 'Lista exceções de calendário' })
  @ApiQuery({ type: ListCalendarExceptionsQueryDto })
  @ApiOkResponse({ type: CalendarExceptionListViewDto })
  public list(
    @Query() query: ListCalendarExceptionsQueryDto,
  ): Promise<CalendarExceptionListViewDto> {
    return this.exceptions.list(query);
  }

  @Get('resolve')
  @ApiOperation({ summary: 'Resolve a exceção efetiva em uma data' })
  @ApiQuery({ type: ResolveCalendarExceptionQueryDto })
  @ApiOkResponse({ type: ResolvedCalendarExceptionViewDto, nullable: true })
  public resolve(
    @Query() query: ResolveCalendarExceptionQueryDto,
  ): Promise<ResolvedCalendarExceptionViewDto | null> {
    return this.resolver.resolveForDate(query.businessDate);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Consulta o histórico de uma exceção de calendário' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: CalendarExceptionDetailViewDto })
  @ApiNotFoundResponse({ description: 'Exceção de calendário não encontrada.' })
  public get(
    @Param('id', new ParseUUIDPipe()) exceptionId: string,
  ): Promise<CalendarExceptionDetailViewDto> {
    return this.exceptions.get(exceptionId);
  }

  @Post(':id/retract')
  @ApiOperation({ summary: 'Retrai uma exceção sem apagar seu histórico' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiCreatedResponse({ type: CalendarExceptionDetailViewDto })
  public retract(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) exceptionId: string,
    @Req() request: Request,
  ): Promise<CalendarExceptionDetailViewDto> {
    return this.exceptions.retract(actor, exceptionId, this.clientContext.fromRequest(request));
  }
}
