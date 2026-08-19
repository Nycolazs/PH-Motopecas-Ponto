import {
  Body,
  Controller,
  Delete,
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
import { CreateVacationDto, ListVacationsQueryDto } from './vacation.dto.js';
import { VacationListViewDto, VacationViewDto } from './vacation.view.js';
import { VacationsService } from './vacations.service.js';

@ApiTags('Férias e Recessos')
@ApiBearerAuth()
@Controller('vacations')
export class VacationsController {
  public constructor(
    @Inject(VacationsService) private readonly vacations: VacationsService,
    @Inject(ClientContextService) private readonly clientContext: ClientContextService,
  ) {}

  @Post()
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Cadastra um período de férias para um colaborador' })
  @ApiBody({ type: CreateVacationDto })
  @ApiCreatedResponse({ type: VacationViewDto })
  public create(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() input: CreateVacationDto,
    @Req() request: Request,
  ): Promise<VacationViewDto> {
    return this.vacations.create(actor, input, this.clientContext.fromRequest(request));
  }

  @Get()
  @Roles('ADMIN', 'EMPLOYEE')
  @ApiOperation({ summary: 'Lista períodos de férias cadastrados' })
  @ApiQuery({ type: ListVacationsQueryDto })
  @ApiOkResponse({ type: VacationListViewDto })
  public list(
    @CurrentUser() actor: AuthenticatedUser,
    @Query() query: ListVacationsQueryDto,
  ): Promise<VacationListViewDto> {
    // If actor is employee and didn't specify employeeId, only list own vacations
    const effectiveQuery = actor.role === 'EMPLOYEE' ? { ...query, employeeId: actor.id } : query;
    return this.vacations.list(effectiveQuery);
  }

  @Delete(':id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Remove/cancela um período de férias' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ description: 'Férias canceladas com sucesso.' })
  public delete(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) vacationId: string,
    @Req() request: Request,
  ): Promise<{ success: boolean; message: string }> {
    return this.vacations.delete(actor, vacationId, this.clientContext.fromRequest(request));
  }
}
