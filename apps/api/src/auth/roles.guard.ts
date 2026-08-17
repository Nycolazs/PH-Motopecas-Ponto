import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { UserRole } from '@ph-ponto/shared';

import { REQUIRED_ROLES_KEY } from './auth.constants.js';
import type { AuthenticatedRequest } from './auth.decorators.js';

@Injectable()
export class RolesGuard implements CanActivate {
  public constructor(@Inject(Reflector) private readonly reflector: Reflector) {}

  public canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<readonly UserRole[]>(REQUIRED_ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (roles === undefined || roles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Partial<AuthenticatedRequest>>();
    if (request.user !== undefined && roles.includes(request.user.role)) {
      return true;
    }

    throw new ForbiddenException({
      code: 'FORBIDDEN',
      message: 'Você não tem permissão para esta ação.',
    });
  }
}
