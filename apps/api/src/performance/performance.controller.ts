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
  ListPerformanceReviewsQueryDto,
  PerformanceCriteriaResponseDto,
  PerformanceReviewResponseDto,
  SupersedePerformanceReviewDto,
} from './performance.dto.js';
import { PerformanceService } from './performance.service.js';

@ApiTags('Avaliações de Desempenho')
@ApiBearerAuth()
@Roles(UserRole.ADMIN)
@Controller('performance')
export class PerformanceController {
  public constructor(
    @Inject(PerformanceService) private readonly performanceService: PerformanceService,
    @Inject(ClientContextService) private readonly clientContexts: ClientContextService,
  ) {}

  @Get('criteria')
  @ApiOperation({
    summary: 'Consultar critérios de avaliação de desempenho vigentes',
    description: 'Retorna a versão ativa contendo os 8 critérios canônicos de desempenho.',
  })
  @ApiOkResponse({ type: PerformanceCriteriaResponseDto })
  public async getCriteria(
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<PerformanceCriteriaResponseDto> {
    return this.performanceService.getCriteria(currentUser.id);
  }

  @Get('reviews')
  @ApiOperation({ summary: 'Listar avaliações de desempenho com filtros' })
  @ApiOkResponse({ type: [PerformanceReviewResponseDto] })
  public async listReviews(
    @Query() query: ListPerformanceReviewsQueryDto,
  ): Promise<PerformanceReviewResponseDto[]> {
    return this.performanceService.listReviews(query);
  }

  @Get('reviews/:id')
  @ApiOperation({ summary: 'Consultar detalhes de uma avaliação de desempenho' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: PerformanceReviewResponseDto })
  public async getReviewById(
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<PerformanceReviewResponseDto> {
    return this.performanceService.getReviewById(id);
  }

  @Get('employees/:employeeId/latest')
  @ApiOperation({ summary: 'Consultar a avaliação mais recente ativa de um colaborador' })
  @ApiParam({ name: 'employeeId', format: 'uuid' })
  @ApiOkResponse({ type: PerformanceReviewResponseDto })
  public async getLatestReviewForEmployee(
    @Param('employeeId', new ParseUUIDPipe()) employeeId: string,
  ): Promise<PerformanceReviewResponseDto | null> {
    return this.performanceService.getLatestReviewForEmployee(employeeId);
  }

  @Post('reviews/:id/supersede')
  @ApiOperation({
    summary: 'Substituir formalmente uma avaliação de desempenho com justificativa auditada',
    description:
      'Marca a avaliação como substituída, preservando o histórico imutável para auditoria.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiBody({ type: SupersedePerformanceReviewDto })
  @ApiOkResponse({ type: PerformanceReviewResponseDto })
  public async supersedeReview(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() input: SupersedePerformanceReviewDto,
    @CurrentUser() currentUser: AuthenticatedUser,
    @Req() request: Request,
  ): Promise<PerformanceReviewResponseDto> {
    const context = this.clientContexts.fromRequest(request);
    return this.performanceService.supersedeReview(id, currentUser.id, input, context);
  }
}
