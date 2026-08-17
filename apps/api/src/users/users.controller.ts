import { Body, Controller, Get, HttpCode, HttpStatus, Inject, Post, Req } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';

import type { AuthenticatedUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/auth.decorators.js';
import { ClientContextService } from '../auth/client-context.service.js';
import { ChangeOwnPasswordDto } from './user.dto.js';
import { UserViewDto } from './user.view.js';
import { UsersService } from './users.service.js';

@ApiTags('Usuários')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  public constructor(
    @Inject(UsersService) private readonly usersService: UsersService,
    @Inject(ClientContextService) private readonly clientContexts: ClientContextService,
  ) {}

  @Get('me')
  @ApiOperation({ summary: 'Consulta o próprio perfil' })
  @ApiOkResponse({ type: UserViewDto })
  public getOwnProfile(@CurrentUser() user: AuthenticatedUser): Promise<UserViewDto> {
    return this.usersService.getOwnProfile(user.id);
  }

  @Post('me/change-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Alterar a própria senha' })
  @ApiBody({ type: ChangeOwnPasswordDto })
  @ApiNoContentResponse({ description: 'Senha alterada com sucesso.' })
  public changeOwnPassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body() input: ChangeOwnPasswordDto,
    @Req() request: Request,
  ): Promise<void> {
    return this.usersService.changeOwnPassword(
      user.id,
      input,
      this.clientContexts.fromRequest(request),
    );
  }
}
