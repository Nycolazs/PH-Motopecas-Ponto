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
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { CurrentUser, Roles } from '../auth/auth.decorators.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { ClientContextService } from '../auth/client-context.service.js';
import { UserRole } from '../generated/prisma/client.js';
import {
  DisciplinaryActionResponseDto,
  DisciplinaryProgressionSummaryResponseDto,
  ListDisciplinaryActionsQueryDto,
  VoidDisciplinaryActionDto,
} from './discipline.dto.js';
import { DisciplineService } from './discipline.service.js';

@ApiTags('Procedimentos Disciplinares')
@ApiBearerAuth()
@Roles(UserRole.ADMIN)
@Controller('discipline')
export class DisciplineController {
  public constructor(
    @Inject(DisciplineService) private readonly disciplineService: DisciplineService,
    @Inject(ClientContextService) private readonly clientContexts: ClientContextService,
  ) {}

  @Get('employees/:employeeId/summary')
  @ApiOperation({
    summary: 'Consultar resumo da progressão disciplinar do colaborador',
    description:
      'Retorna contadores ativos de advertência verbal, escrita e suspensão, total de dias, estágio atual e sugestão de progressão. Medidas anuladas são estritamente excluídas da progressão ativa.',
  })
  @ApiParam({ name: 'employeeId', format: 'uuid' })
  @ApiOkResponse({ type: DisciplinaryProgressionSummaryResponseDto })
  public async getProgressionSummary(
    @Param('employeeId', new ParseUUIDPipe()) employeeId: string,
  ): Promise<DisciplinaryProgressionSummaryResponseDto> {
    return this.disciplineService.getProgressionSummary(employeeId);
  }

  @Get('employees/:employeeId/actions')
  @ApiOperation({ summary: 'Listar histórico de medidas disciplinares de um colaborador' })
  @ApiParam({ name: 'employeeId', format: 'uuid' })
  @ApiOkResponse({ type: [DisciplinaryActionResponseDto] })
  public async listEmployeeActions(
    @Param('employeeId', new ParseUUIDPipe()) employeeId: string,
  ): Promise<DisciplinaryActionResponseDto[]> {
    return this.disciplineService.listActions({ employeeId });
  }

  @Get('actions')
  @ApiOperation({ summary: 'Listar medidas disciplinares com filtros' })
  @ApiOkResponse({ type: [DisciplinaryActionResponseDto] })
  public async listActions(
    @Query() query: ListDisciplinaryActionsQueryDto,
  ): Promise<DisciplinaryActionResponseDto[]> {
    return this.disciplineService.listActions(query);
  }

  @Get('actions/:id')
  @ApiOperation({ summary: 'Consultar detalhes de uma medida disciplinar' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: DisciplinaryActionResponseDto })
  public async getActionById(
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<DisciplinaryActionResponseDto> {
    return this.disciplineService.getActionById(id);
  }

  @Post('actions/:id/void')
  @ApiOperation({
    summary: 'Anular formalmente uma medida disciplinar com justificativa auditada',
    description:
      'Registra a anulação da medida e do documento associado, excluindo-a da contagem de progressão ativa, mas mantendo a trilha no histórico.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiBody({ type: VoidDisciplinaryActionDto })
  @ApiOkResponse({ type: DisciplinaryActionResponseDto })
  public async voidAction(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() input: VoidDisciplinaryActionDto,
    @CurrentUser() currentUser: AuthenticatedUser,
    @Req() request: Request,
  ): Promise<DisciplinaryActionResponseDto> {
    const context = this.clientContexts.fromRequest(request);
    return this.disciplineService.voidAction(id, currentUser.id, input, context);
  }
}
