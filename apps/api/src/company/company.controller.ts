import { Body, Controller, Get, HttpCode, HttpStatus, Inject, Put, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';

import { CurrentUser, Roles } from '../auth/auth.decorators.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { ClientContextService } from '../auth/client-context.service.js';
import { UserRole } from '../generated/prisma/client.js';
import {
  CompanyResponseDto,
  SetupStatusResponseDto,
  type UpdateCompanyRequestDto,
} from './company.dto.js';
import { CompanyService } from './company.service.js';

@ApiTags('Empresa')
@ApiBearerAuth()
@Roles(UserRole.ADMIN)
@Controller('company')
export class CompanyController {
  public constructor(
    @Inject(CompanyService) private readonly companyService: CompanyService,
    @Inject(ClientContextService) private readonly clientContexts: ClientContextService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Consultar dados cadastrais da empresa' })
  @ApiOkResponse({ type: CompanyResponseDto })
  public getCompany(): Promise<CompanyResponseDto> {
    return this.companyService.getCompany();
  }

  @Put()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Atualizar dados cadastrais da empresa' })
  @ApiOkResponse({ type: CompanyResponseDto })
  public updateCompany(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() input: UpdateCompanyRequestDto,
    @Req() request: Request,
  ): Promise<CompanyResponseDto> {
    return this.companyService.updateCompany(
      actor.id,
      input,
      this.clientContexts.fromRequest(request),
    );
  }

  @Get('setup-status')
  @ApiOperation({ summary: 'Consultar progresso de implantação da empresa' })
  @ApiOkResponse({ type: SetupStatusResponseDto })
  public getSetupStatus(): Promise<SetupStatusResponseDto> {
    return this.companyService.getSetupStatus();
  }
}
