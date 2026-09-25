import type { ConfigService } from '@nestjs/config';

import type { EnvironmentVariables } from './environment.js';

function addOriginWithLoopbacks(origins: Set<string>, originStr?: string): void {
  if (!originStr?.trim()) return;
  try {
    const url = new URL(originStr.trim());
    origins.add(url.origin);
    const loopbacks = ['localhost', '127.0.0.1', '[::1]'];
    if (loopbacks.includes(url.hostname)) {
      const portPart = url.port ? `:${url.port}` : '';
      for (const host of loopbacks) {
        origins.add(`${url.protocol}//${host}${portPart}`);
      }
    }
  } catch {
    // Ignore invalid origin strings gracefully
  }
}

export function webAllowedOrigins(config: ConfigService<EnvironmentVariables, true>): Set<string> {
  const origins = new Set<string>();
  const configured = config.get('ADMIN_WEB_ORIGIN', { infer: true });
  if (configured !== undefined) {
    for (const origin of configured.split(',')) {
      if (origin.trim()) {
        origins.add(new URL(origin.trim()).origin);
      }
    }
  }
  if (config.get('NODE_ENV', { infer: true }) !== 'production') {
    addOriginWithLoopbacks(origins, config.get('DESKTOP_DEV_ORIGIN', { infer: true }));
    addOriginWithLoopbacks(origins, config.get('API_BASE_URL', { infer: true }));
    addOriginWithLoopbacks(origins, 'http://localhost:5173');
    addOriginWithLoopbacks(origins, 'http://localhost:3000');
  }
  return origins;
}

