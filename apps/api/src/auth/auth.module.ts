import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';

import { AuditModule } from '../audit/audit.module.js';
import { AccessTokenGuard } from './access-token.guard.js';
import { AuthController } from './auth.controller.js';
import { authConfigurationProvider } from './auth.config.js';
import { authClockProvider } from './clock.js';
import { AuthService } from './auth.service.js';
import { ClientContextService } from './client-context.service.js';
import { CurrentUserService } from './current-user.service.js';
import { LoginRateLimiterService } from './login-rate-limiter.service.js';
import { PasswordService } from './password.service.js';
import { RolesGuard } from './roles.guard.js';
import { SessionRevocationService } from './session-revocation.service.js';
import { TokenService } from './token.service.js';

@Global()
@Module({
  imports: [JwtModule.register({}), AuditModule],
  controllers: [AuthController],
  providers: [
    authConfigurationProvider,
    authClockProvider,
    AuthService,
    ClientContextService,
    CurrentUserService,
    LoginRateLimiterService,
    PasswordService,
    SessionRevocationService,
    TokenService,
    { provide: APP_GUARD, useClass: AccessTokenGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
  exports: [
    ClientContextService,
    CurrentUserService,
    PasswordService,
    SessionRevocationService,
    TokenService,
  ],
})
export class AuthModule {}
