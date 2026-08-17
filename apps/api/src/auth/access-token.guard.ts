import {
  type CanActivate,
  type ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { IS_PUBLIC_KEY } from './auth.constants.js';
import type { AuthenticatedRequest } from './auth.decorators.js';
import { CurrentUserService } from './current-user.service.js';
import { TokenService } from './token.service.js';

function readBearerToken(request: AuthenticatedRequest): string {
  const authorization = request.header('authorization');
  const match = authorization === undefined ? null : /^Bearer ([^\s]{1,4096})$/.exec(authorization);

  if (match === null) {
    throw new UnauthorizedException({
      code: 'AUTHENTICATION_REQUIRED',
      message: 'Autenticação necessária.',
    });
  }

  return match[1]!;
}

@Injectable()
export class AccessTokenGuard implements CanActivate {
  public constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(TokenService) private readonly tokens: TokenService,
    @Inject(CurrentUserService) private readonly currentUsers: CurrentUserService,
  ) {}

  public async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic === true) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const claims = await this.tokens.verifyAccessToken(readBearerToken(request));
    request.user = await this.currentUsers.resolve(claims);
    return true;
  }
}
