import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
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
import { UserRole } from '../generated/prisma/client.js';
import {
  CreateJobRoleDto,
  CreateJobRoleVersionDto,
  JobRoleResponseDto,
  JobRoleVersionResponseDto,
  UpdateJobRoleDto,
} from './job-roles.dto.js';
import { JobRolesService } from './job-roles.service.js';

@ApiTags('Cargos e Funções')
@ApiBearerAuth()
@Roles(UserRole.ADMIN)
@Controller('job-roles')
export class JobRolesController {
  public constructor(
    @Inject(JobRolesService) private readonly jobRolesService: JobRolesService,
    @Inject(ClientContextService) private readonly clientContexts: ClientContextService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Listar cargos da empresa' })
  @ApiQuery({ name: 'includeInactive', required: false, type: Boolean })
  @ApiOkResponse({ type: [JobRoleResponseDto] })
  public listRoles(
    @Query('includeInactive') includeInactive?: string,
  ): Promise<JobRoleResponseDto[]> {
    return this.jobRolesService.listRoles(includeInactive === 'true');
  }

  @Post()
  @ApiOperation({ summary: 'Criar um novo cargo com sua versão inicial' })
  @ApiBody({ type: CreateJobRoleDto })
  @ApiCreatedResponse({ type: JobRoleResponseDto })
  public createRole(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() input: CreateJobRoleDto,
    @Req() request: Request,
  ): Promise<JobRoleResponseDto> {
    return this.jobRolesService.createRole(
      actor.id,
      input,
      this.clientContexts.fromRequest(request),
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Consultar cargo por ID com histórico de versões' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: JobRoleResponseDto })
  public getRole(@Param('id', new ParseUUIDPipe()) id: string): Promise<JobRoleResponseDto> {
    return this.jobRolesService.getRole(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualizar dados cadastrais de um cargo' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiBody({ type: UpdateJobRoleDto })
  @ApiOkResponse({ type: JobRoleResponseDto })
  public updateRole(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() input: UpdateJobRoleDto,
    @Req() request: Request,
  ): Promise<JobRoleResponseDto> {
    return this.jobRolesService.updateRole(
      actor.id,
      id,
      input,
      this.clientContexts.fromRequest(request),
    );
  }

  @Post(':id/versions')
  @ApiOperation({ summary: 'Publicar uma nova versão imutável para o cargo' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiBody({ type: CreateJobRoleVersionDto })
  @ApiCreatedResponse({ type: JobRoleVersionResponseDto })
  public publishVersion(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() input: CreateJobRoleVersionDto,
    @Req() request: Request,
  ): Promise<JobRoleVersionResponseDto> {
    return this.jobRolesService.publishVersion(
      actor.id,
      id,
      input,
      this.clientContexts.fromRequest(request),
    );
  }
}
