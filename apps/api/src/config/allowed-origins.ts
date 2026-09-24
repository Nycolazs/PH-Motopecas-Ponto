import type { ConfigService } from '@nestjs/config';

import type { EnvironmentVariables } from './environment.js';

export function webAllowedOrigins(config: ConfigService<EnvironmentVariables, true>): Set<string> {
  const origins = new Set<string>();
  const configured = config.get('ADMIN_WEB_ORIGIN', { infer: true });
  if (configured !== undefined) {
    for (const origin of configured.split(',')) origins.add(new URL(origin.trim()).origin);
  }
  if (config.get('NODE_ENV', { infer: true }) !== 'production') {
    origins.add(new URL(config.get('DESKTOP_DEV_ORIGIN', { infer: true })).origin);
    origins.add(new URL(config.get('API_BASE_URL', { infer: true })).origin);
  }
  return origins;
}
