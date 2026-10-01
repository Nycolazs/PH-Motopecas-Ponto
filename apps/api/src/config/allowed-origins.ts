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

export function isLocalOrPrivateNetworkOrigin(originStr?: string): boolean {
  if (!originStr?.trim()) return false;
  try {
    const url = new URL(originStr.trim());
    const hostname = url.hostname;
    // Loopback
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]') {
      return true;
    }
    // IPv4 Private Networks (RFC 1918)
    if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)) return true;
    if (/^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/.test(hostname)) return true;
    if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname)) return true;
    if (hostname.endsWith('.local')) return true;
    return false;
  } catch {
    return false;
  }
}

export function webAllowedOrigins(config: ConfigService<EnvironmentVariables, true>): Set<string> {
  const origins = new Set<string>();
  const configured = config.get('ADMIN_WEB_ORIGIN', { infer: true });
  if (configured !== undefined) {
    for (const origin of configured.split(',')) {
      if (origin.trim()) {
        try {
          origins.add(new URL(origin.trim()).origin);
        } catch {
          // Ignore invalid URL
        }
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
