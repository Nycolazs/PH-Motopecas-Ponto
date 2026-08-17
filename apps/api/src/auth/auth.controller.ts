import { Body, Controller, Get, HttpCode, HttpStatus, Inject, Post, Req } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Request } from 'express';

import { AuthService } from './auth.service.js';
import { CurrentUser, Public } from './auth.decorators.js';
import type { AuthenticatedUser } from './auth.types.js';
import { ClientContextService } from './client-context.service.js';
import { AuthResponseDto, AuthUserDto } from './dto/auth-response.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { RefreshDto } from './dto/refresh.dto.js';

@ApiTags('Autenticação')
@Controller('auth')
export class AuthController {
  public constructor(
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(ClientContextService) private readonly clientContexts: ClientContextService,
  ) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Autenticar usuário' })
  @ApiBody({ type: LoginDto })
  @ApiOkResponse({ type: AuthResponseDto })
  @ApiUnauthorizedResponse({ description: 'Login ou senha inválidos.' })
  public login(@Body() input: LoginDto, @Req() request: Request): Promise<AuthResponseDto> {
    return this.auth.login(input, this.clientContexts.fromRequest(request));
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Renovar a sessão com rotação do token' })
  @ApiBody({ type: RefreshDto })
  @ApiOkResponse({ type: AuthResponseDto })
  @ApiUnauthorizedResponse({ description: 'Sessão inválida ou expirada.' })
  public refresh(@Body() input: RefreshDto, @Req() request: Request): Promise<AuthResponseDto> {
    return this.auth.refresh(input.refreshToken, this.clientContexts.fromRequest(request));
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Encerrar e revogar a sessão' })
  @ApiNoContentResponse()
  public logout(@CurrentUser() user: AuthenticatedUser, @Req() request: Request): Promise<void> {
    return this.auth.logout(user, this.clientContexts.fromRequest(request));
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Consultar a identidade autenticada' })
  @ApiOkResponse({ type: AuthUserDto })
  public me(@CurrentUser() user: AuthenticatedUser): AuthUserDto {
    return { id: user.id, name: user.name, login: user.login, role: user.role };
  }
}
