import { type FactoryProvider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { EnvironmentVariables } from '../config/environment.js';
import { AUTH_CONFIGURATION } from './auth.constants.js';
import type { AuthConfiguration } from './auth.types.js';

export const authConfigurationProvider: FactoryProvider<AuthConfiguration> = {
  provide: AUTH_CONFIGURATION,
  inject: [ConfigService],
  useFactory: (config: ConfigService<EnvironmentVariables, true>): AuthConfiguration => ({
    accessSecret: config.get('JWT_SECRET', { infer: true }),
    refreshSecret: config.get('JWT_REFRESH_SECRET', { infer: true }),
    issuer: config.get('JWT_ISSUER', { infer: true }),
    audience: config.get('JWT_AUDIENCE', { infer: true }),
    accessTtlSeconds: config.get('JWT_ACCESS_TTL_SECONDS', { infer: true }),
    refreshIdleTtlSeconds: config.get('REFRESH_IDLE_TTL_SECONDS', { infer: true }),
    refreshAbsoluteTtlSeconds: config.get('REFRESH_ABSOLUTE_TTL_SECONDS', { infer: true }),
    loginWindowSeconds: config.get('AUTH_LOGIN_WINDOW_SECONDS', { infer: true }),
    loginMaxAttempts: config.get('AUTH_LOGIN_MAX_ATTEMPTS', { infer: true }),
    loginBlockSeconds: config.get('AUTH_LOGIN_BLOCK_SECONDS', { infer: true }),
  }),
};
