import { Controller, Get, Inject, Param, ParseUUIDPipe } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';

import { Roles } from '../auth/auth.decorators.js';
import { UserRole } from '../generated/prisma/client.js';
import {
  CompanyRegulationResponseDto,
  CompanyRegulationVersionResponseDto,
} from './regulations.dto.js';
import { RegulationsService } from './regulations.service.js';

@ApiTags('Regimento Interno')
@ApiBearerAuth()
@Roles(UserRole.ADMIN)
@Controller('regulations')
export class RegulationsController {
  public constructor(
    @Inject(RegulationsService) private readonly regulationsService: RegulationsService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Consultar regimento interno e histórico de versões publicadas' })
  @ApiOkResponse({ type: CompanyRegulationResponseDto })
  public async getRegulations(): Promise<CompanyRegulationResponseDto> {
    return this.regulationsService.getRegulations();
  }

  @Get('versions')
  @ApiOperation({ summary: 'Listar todas as versões publicadas do regimento interno' })
  @ApiOkResponse({ type: [CompanyRegulationVersionResponseDto] })
  public async listVersions(): Promise<CompanyRegulationVersionResponseDto[]> {
    return this.regulationsService.listVersions();
  }

  @Get('versions/:id')
  @ApiOperation({ summary: 'Consultar versão específica do regimento interno por ID' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: CompanyRegulationVersionResponseDto })
  public async getVersion(
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<CompanyRegulationVersionResponseDto> {
    return this.regulationsService.getVersion(id);
  }
}
