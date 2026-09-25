import { Controller, Get, Inject, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { Roles } from '../auth/auth.decorators.js';
import { UserRole } from '../generated/prisma/client.js';
import {
  AcknowledgmentStatusSummaryResponseDto,
  type ListAcknowledgmentsQueryDto,
  PaginatedAcknowledgmentsResponseDto,
} from './acknowledgments.dto.js';
import { AcknowledgmentsService } from './acknowledgments.service.js';

@ApiTags('Termos de Ciência')
@ApiBearerAuth()
@Roles(UserRole.ADMIN)
@Controller('acknowledgments')
export class AcknowledgmentsController {
  public constructor(
    @Inject(AcknowledgmentsService) private readonly acknowledgmentsService: AcknowledgmentsService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Listar termos de ciência gerados para colaboradores' })
  @ApiOkResponse({ type: PaginatedAcknowledgmentsResponseDto })
  public async listAcknowledgments(
    @Query() query: ListAcknowledgmentsQueryDto,
  ): Promise<PaginatedAcknowledgmentsResponseDto> {
    return this.acknowledgmentsService.listAcknowledgments(query);
  }

  @Get('status')
  @ApiOperation({
    summary: 'Obter resumo de conformidade dos termos de ciência (regimento e cargos)',
  })
  @ApiOkResponse({ type: AcknowledgmentStatusSummaryResponseDto })
  public async getAcknowledgmentStatus(): Promise<AcknowledgmentStatusSummaryResponseDto> {
    return this.acknowledgmentsService.getAcknowledgmentStatus();
  }
}
