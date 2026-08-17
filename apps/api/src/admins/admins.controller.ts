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
import { AdminsService } from './admins.service.js';

@ApiTags('Administradores')
@ApiBearerAuth()
@Roles('ADMIN')
@Controller('admins')
export class AdminsController {
  public constructor(
    @Inject(AdminsService) private readonly admins: AdminsService,
    @Inject(ClientContextService) private readonly clientContext: ClientContextService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Cria um administrador' })
  @ApiBody({ type: CreateManagedUserDto })
  @ApiCreatedResponse({ type: UserViewDto })
  public create(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() input: CreateManagedUserDto,
    @Req() request: Request,
  ): Promise<UserViewDto> {
    return this.admins.create(actor, input, this.clientContext.fromRequest(request));
  }

  @Get()
  @ApiOperation({ summary: 'Lista administradores' })
  @ApiQuery({ type: ListUsersQueryDto })
  @ApiOkResponse({ type: UserListViewDto })
  public list(@Query() query: ListUsersQueryDto): Promise<UserListViewDto> {
    return this.admins.list(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Consulta um administrador' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: UserViewDto })
  @ApiNotFoundResponse({ description: 'Administrador não encontrado.' })
  public get(@Param('id', new ParseUUIDPipe()) adminId: string): Promise<UserViewDto> {
    return this.admins.get(adminId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualiza um administrador' })
  @ApiBody({ type: UpdateManagedUserDto })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: UserViewDto })
  public update(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) adminId: string,
    @Body() input: UpdateManagedUserDto,
    @Req() request: Request,
  ): Promise<UserViewDto> {
    return this.admins.update(actor, adminId, input, this.clientContext.fromRequest(request));
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Ativa ou desativa um administrador' })
  @ApiBody({ type: UpdateUserStatusDto })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: UserViewDto })
  public updateStatus(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) adminId: string,
    @Body() input: UpdateUserStatusDto,
    @Req() request: Request,
  ): Promise<UserViewDto> {
    return this.admins.updateStatus(
      actor,
      adminId,
      input.isActive,
      this.clientContext.fromRequest(request),
    );
  }

  @Post(':id/password-reset')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Redefine a senha de um administrador' })
  @ApiBody({ type: ResetUserPasswordDto })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiNoContentResponse()
  public async resetPassword(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) adminId: string,
    @Body() input: ResetUserPasswordDto,
    @Req() request: Request,
  ): Promise<void> {
    await this.admins.resetPassword(
      actor,
      adminId,
      input.password,
      this.clientContext.fromRequest(request),
    );
  }
}
