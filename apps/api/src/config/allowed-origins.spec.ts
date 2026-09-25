import type { ConfigService } from '@nestjs/config';
import { describe, expect, it } from 'vitest';

import { webAllowedOrigins } from './allowed-origins.js';
import type { EnvironmentVariables } from './environment.js';

describe('webAllowedOrigins', () => {
  it('expands loopback variants in non-production environments', () => {
    const config = {
      get: (key: string) => {
        if (key === 'NODE_ENV') return 'development';
        if (key === 'DESKTOP_DEV_ORIGIN') return 'http://localhost:5173';
        if (key === 'API_BASE_URL') return 'http://localhost:3000';
        return undefined;
      },
    } as unknown as ConfigService<EnvironmentVariables, true>;

    const origins = webAllowedOrigins(config);

    expect(origins.has('http://localhost:5173')).toBe(true);
    expect(origins.has('http://127.0.0.1:5173')).toBe(true);
    expect(origins.has('http://[::1]:5173')).toBe(true);
    expect(origins.has('http://localhost:3000')).toBe(true);
    expect(origins.has('http://127.0.0.1:3000')).toBe(true);
    expect(origins.has('http://[::1]:3000')).toBe(true);
  });

  it('restricts origins strictly to configured ADMIN_WEB_ORIGIN in production', () => {
    const config = {
      get: (key: string) => {
        if (key === 'NODE_ENV') return 'production';
        if (key === 'ADMIN_WEB_ORIGIN') return 'https://ponto.phmotopecas.com.br';
        if (key === 'DESKTOP_DEV_ORIGIN') return 'http://localhost:5173';
        if (key === 'API_BASE_URL') return 'http://localhost:3000';
        return undefined;
      },
    } as unknown as ConfigService<EnvironmentVariables, true>;

    const origins = webAllowedOrigins(config);

    expect(origins.has('https://ponto.phmotopecas.com.br')).toBe(true);
    expect(origins.has('http://localhost:5173')).toBe(false);
    expect(origins.has('http://127.0.0.1:5173')).toBe(false);
    expect(origins.has('http://localhost:3000')).toBe(false);
  });
});
