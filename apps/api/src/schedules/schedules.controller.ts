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
  CreateBusinessScheduleDto,
  ListBusinessSchedulesQueryDto,
  ResolveBusinessScheduleQueryDto,
} from './schedule.dto.js';
import { ScheduleResolverService } from './schedule-resolver.service.js';
import {
  BusinessScheduleListViewDto,
  BusinessScheduleViewDto,
  ResolvedBusinessScheduleViewDto,
} from './schedule.view.js';
import { SchedulesService } from './schedules.service.js';

@ApiTags('Horários de trabalho')
@ApiBearerAuth()
@Roles('ADMIN')
@Controller('schedules')
export class SchedulesController {
  public constructor(
    @Inject(SchedulesService) private readonly schedules: SchedulesService,
    @Inject(ScheduleResolverService) private readonly resolver: ScheduleResolverService,
    @Inject(ClientContextService) private readonly clientContext: ClientContextService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Cria uma nova versão imutável do horário' })
  @ApiBody({ type: CreateBusinessScheduleDto })
  @ApiCreatedResponse({ type: BusinessScheduleViewDto })
  public create(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() input: CreateBusinessScheduleDto,
    @Req() request: Request,
  ): Promise<BusinessScheduleViewDto> {
    return this.schedules.create(actor, input, this.clientContext.fromRequest(request));
  }

  @Get()
  @ApiOperation({ summary: 'Lista as versões do horário' })
  @ApiQuery({ type: ListBusinessSchedulesQueryDto })
  @ApiOkResponse({ type: BusinessScheduleListViewDto })
  public list(@Query() query: ListBusinessSchedulesQueryDto): Promise<BusinessScheduleListViewDto> {
    return this.schedules.list(query);
  }

  @Get('current')
  @ApiOperation({ summary: 'Resolve o horário vigente em uma data' })
  @ApiQuery({ type: ResolveBusinessScheduleQueryDto })
  @ApiOkResponse({ type: ResolvedBusinessScheduleViewDto })
  public resolveCurrent(
    @Query() query: ResolveBusinessScheduleQueryDto,
  ): Promise<ResolvedBusinessScheduleViewDto> {
    return this.resolver.resolveForDate(query.businessDate);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Consulta uma versão do horário' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: BusinessScheduleViewDto })
  @ApiNotFoundResponse({ description: 'Horário de trabalho não encontrado.' })
  public get(
    @Param('id', new ParseUUIDPipe()) scheduleId: string,
  ): Promise<BusinessScheduleViewDto> {
    return this.schedules.get(scheduleId);
  }
}
