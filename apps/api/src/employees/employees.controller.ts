import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
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
  ApiNoContentResponse,
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
  CreateManagedUserDto,
  ListUsersQueryDto,
  ResetUserPasswordDto,
  UpdateManagedUserDto,
  UpdateUserStatusDto,
} from '../users/user.dto.js';
import { UserListViewDto, UserViewDto } from '../users/user.view.js';
import { EmployeesService } from './employees.service.js';

@ApiTags('Funcionários')
@ApiBearerAuth()
@Roles('ADMIN')
@Controller('employees')
export class EmployeesController {
  public constructor(
    @Inject(EmployeesService) private readonly employees: EmployeesService,
    @Inject(ClientContextService) private readonly clientContext: ClientContextService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Cria um funcionário' })
  @ApiBody({ type: CreateManagedUserDto })
  @ApiCreatedResponse({ type: UserViewDto })
  public create(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() input: CreateManagedUserDto,
    @Req() request: Request,
  ): Promise<UserViewDto> {
    return this.employees.create(actor, input, this.clientContext.fromRequest(request));
  }

  @Get()
  @ApiOperation({ summary: 'Lista funcionários' })
  @ApiQuery({ type: ListUsersQueryDto })
  @ApiOkResponse({ type: UserListViewDto })
  public list(@Query() query: ListUsersQueryDto): Promise<UserListViewDto> {
    return this.employees.list(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Consulta um funcionário' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: UserViewDto })
  @ApiNotFoundResponse({ description: 'Funcionário não encontrado.' })
  public get(@Param('id', new ParseUUIDPipe()) employeeId: string): Promise<UserViewDto> {
    return this.employees.get(employeeId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualiza um funcionário' })
  @ApiBody({ type: UpdateManagedUserDto })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: UserViewDto })
  public update(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) employeeId: string,
    @Body() input: UpdateManagedUserDto,
    @Req() request: Request,
  ): Promise<UserViewDto> {
    return this.employees.update(actor, employeeId, input, this.clientContext.fromRequest(request));
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Ativa ou desativa um funcionário' })
  @ApiBody({ type: UpdateUserStatusDto })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: UserViewDto })
  public updateStatus(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) employeeId: string,
    @Body() input: UpdateUserStatusDto,
    @Req() request: Request,
  ): Promise<UserViewDto> {
    return this.employees.updateStatus(
      actor,
      employeeId,
      input.isActive,
      this.clientContext.fromRequest(request),
    );
  }

  @Post(':id/password-reset')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Redefine a senha de um funcionário' })
  @ApiBody({ type: ResetUserPasswordDto })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiNoContentResponse()
  public async resetPassword(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) employeeId: string,
    @Body() input: ResetUserPasswordDto,
    @Req() request: Request,
  ): Promise<void> {
    await this.employees.resetPassword(
      actor,
      employeeId,
      input.password,
      this.clientContext.fromRequest(request),
    );
  }
}
