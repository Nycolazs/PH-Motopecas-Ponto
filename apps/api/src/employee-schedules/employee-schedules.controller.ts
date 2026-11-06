import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';

import { CurrentUser, Roles } from '../auth/auth.decorators.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { ClientContextService } from '../auth/client-context.service.js';
import {
  CreateScheduleAdjustmentDto,
  EmployeeScheduleDraftDto,
  MoveRestDayDto,
  PublishEmployeeScheduleDto,
  RevokeScheduleOverrideDto,
  ScheduleRangeQueryDto,
  UpdateWorkRegimeDto,
} from './employee-schedule.dto.js';
import { EmployeeSchedulesService } from './employee-schedules.service.js';

@ApiTags('Escalas (5x2)')
@ApiBearerAuth()
@Controller('employee-schedules')
export class EmployeeSchedulesController {
  public constructor(
    @Inject(EmployeeSchedulesService) private readonly schedules: EmployeeSchedulesService,
    @Inject(ClientContextService) private readonly clientContext: ClientContextService,
  ) {}

  @Get('settings')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Regras de jornada da empresa (acordo coletivo, domingo, mínimo)' })
  public getSettings() {
    return this.schedules.getSettings();
  }

  @Put('settings')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Atualiza as regras de jornada da empresa' })
  public updateSettings(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() input: UpdateWorkRegimeDto,
    @Req() request: Request,
  ) {
    return this.schedules.updateSettings(actor, input, this.clientContext.fromRequest(request));
  }

  @Get('team')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Grade da equipe: quem trabalha e quem folga em cada dia' })
  public team(@Query() query: ScheduleRangeQueryDto) {
    return this.schedules.getTeam(query.from, query.to);
  }

  @Get('me')
  @Roles('EMPLOYEE')
  @ApiOperation({ summary: 'Minha escala nas próximas semanas' })
  public mine(@CurrentUser() actor: AuthenticatedUser) {
    return this.schedules.getMine(actor.id);
  }

  @Post('overrides/adjustment')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Muda a escala de um colaborador em um único dia' })
  public adjust(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() input: CreateScheduleAdjustmentDto,
    @Req() request: Request,
  ) {
    return this.schedules.createAdjustment(actor, input, this.clientContext.fromRequest(request));
  }

  @Post('overrides/move-rest-day')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Troca de folga: a folga vai para outro dia' })
  public moveRestDay(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() input: MoveRestDayDto,
    @Req() request: Request,
  ) {
    return this.schedules.moveRestDay(actor, input, this.clientContext.fromRequest(request));
  }

  @Post('overrides/:id/revoke')
  @Roles('ADMIN')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({ summary: 'Cancela uma troca ou ajuste de escala' })
  public revoke(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() input: RevokeScheduleOverrideDto,
    @Req() request: Request,
  ) {
    return this.schedules.revokeOverride(
      actor,
      id,
      input.reason,
      this.clientContext.fromRequest(request),
    );
  }

  @Get(':employeeId')
  @Roles('ADMIN', 'EMPLOYEE')
  @ApiParam({ name: 'employeeId', format: 'uuid' })
  @ApiOperation({ summary: 'Escala de um colaborador: dias, histórico e trocas' })
  public employee(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('employeeId', new ParseUUIDPipe()) employeeId: string,
    @Query() query: ScheduleRangeQueryDto,
  ) {
    if (actor.role === 'EMPLOYEE' && actor.id !== employeeId) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Você só pode consultar a sua própria escala.',
      });
    }
    return this.schedules.getEmployeeOverview(employeeId, query.from, query.to);
  }

  @Post(':employeeId/preview')
  @Roles('ADMIN')
  @ApiParam({ name: 'employeeId', format: 'uuid' })
  @ApiOperation({ summary: 'Simula uma escala (nada é salvo) e aponta problemas de jornada' })
  public preview(
    @Param('employeeId', new ParseUUIDPipe()) employeeId: string,
    @Body() input: EmployeeScheduleDraftDto,
  ) {
    return this.schedules.preview(employeeId, input);
  }

  @Post(':employeeId/versions')
  @Roles('ADMIN')
  @ApiParam({ name: 'employeeId', format: 'uuid' })
  @ApiOperation({ summary: 'Publica a escala do colaborador a partir de uma data' })
  public publish(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('employeeId', new ParseUUIDPipe()) employeeId: string,
    @Body() input: PublishEmployeeScheduleDto,
    @Req() request: Request,
  ) {
    return this.schedules.publish(
      actor,
      employeeId,
      input,
      this.clientContext.fromRequest(request),
    );
  }
}
