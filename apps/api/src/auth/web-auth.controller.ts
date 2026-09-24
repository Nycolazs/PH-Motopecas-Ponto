import {
  Body,
  Controller,
  ForbiddenException,
  HttpCode,
  Inject,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApiBody,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  OmitType,
} from '@nestjs/swagger';
import type { CookieOptions, Request, Response } from 'express';

import { webAllowedOrigins } from '../config/allowed-origins.js';
import type { EnvironmentVariables } from '../config/environment.js';
import { Public } from './auth.decorators.js';
import { AuthService } from './auth.service.js';
import type { AuthResponse } from './auth.types.js';
import { ClientContextService } from './client-context.service.js';
import { AuthResponseDto } from './dto/auth-response.dto.js';
import { LoginDto } from './dto/login.dto.js';

export const WEB_REFRESH_COOKIE = 'ph_ponto_web_session';
export class WebAuthResponseDto extends OmitType(AuthResponseDto, ['refreshToken'] as const) {}

/** No cookie parser is needed: only this bounded, generated credential is accepted. */
function readRefreshCookie(request: Request): string | undefined {
  const values = (request.headers.cookie ?? '')
    .split(';')
    .map((part) => part.trim())
    .filter((part) => part.startsWith(`${WEB_REFRESH_COOKIE}=`));
  if (values.length !== 1) return undefined;
  const value = values[0]!.slice(WEB_REFRESH_COOKIE.length + 1);
  return value.length <= 256 && /^[a-zA-Z0-9_.-]+$/.test(value) ? value : undefined;
}

@ApiTags('Sessão web')
@Controller('auth/web')
export class WebAuthController {
  public constructor(
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(ClientContextService) private readonly contexts: ClientContextService,
    @Inject(ConfigService) private readonly config: ConfigService<EnvironmentVariables, true>,
  ) {}

  @Public()
  @Post('login')
  @HttpCode(200)
  @ApiOperation({ summary: 'Entrar como administrador no navegador' })
  @ApiBody({ type: LoginDto })
  @ApiOkResponse({ type: WebAuthResponseDto })
  public async login(
    @Body() input: LoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<WebAuthResponseDto> {
    this.assertBrowserRequest(request);
    const result = await this.auth.login(input, this.contexts.fromRequest(request), 'ADMIN');
    return this.setSession(response, result);
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  @ApiOperation({ summary: 'Renovar a sessão web por cookie protegido' })
  @ApiOkResponse({ type: WebAuthResponseDto })
  public async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<WebAuthResponseDto> {
    this.assertBrowserRequest(request);
    const token = readRefreshCookie(request);
    if (token === undefined)
      throw new UnauthorizedException({
        code: 'AUTHENTICATION_REQUIRED',
        message: 'Entre novamente para continuar.',
      });
    try {
      const result = await this.auth.refresh(token, this.contexts.fromRequest(request), 'ADMIN');
      return this.setSession(response, result);
    } catch (error) {
      if (error instanceof UnauthorizedException)
        response.clearCookie(WEB_REFRESH_COOKIE, this.cookieOptions());
      throw error;
    }
  }

  @Public()
  @Post('logout')
  @HttpCode(204)
  @ApiOperation({ summary: 'Revogar a sessão web e remover o cookie' })
  @ApiNoContentResponse()
  public async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    this.assertBrowserRequest(request);
    await this.auth.logoutWithRefresh(
      readRefreshCookie(request),
      this.contexts.fromRequest(request),
    );
    response.clearCookie(WEB_REFRESH_COOKIE, this.cookieOptions());
    response.setHeader('Cache-Control', 'no-store');
  }

  private assertBrowserRequest(request: Request): void {
    // Exact Origin plus a non-simple custom header prevents form/login CSRF and untrusted sibling origins.
    if (
      !webAllowedOrigins(this.config).has(request.get('origin') ?? '') ||
      request.get('X-CSRF-Protection') !== '1' ||
      !request.is('application/json')
    ) {
      throw new ForbiddenException({
        code: 'CSRF_REJECTED',
        message: 'Origem da solicitação não permitida. Reabra o aplicativo.',
      });
    }
  }

  private cookieOptions(): CookieOptions {
    return {
      httpOnly: true,
      secure: this.config.get('NODE_ENV', { infer: true }) === 'production',
      sameSite: 'strict',
      path: '/',
    };
  }

  private setSession(response: Response, result: AuthResponse): WebAuthResponseDto {
    response.cookie(WEB_REFRESH_COOKIE, result.refreshToken, {
      ...this.cookieOptions(),
      maxAge: this.config.get('REFRESH_IDLE_TTL_SECONDS', { infer: true }) * 1000,
    });
    response.setHeader('Cache-Control', 'no-store');
    return {
      accessToken: result.accessToken,
      accessTokenExpiresInSeconds: result.accessTokenExpiresInSeconds,
      user: result.user,
    };
  }
}
