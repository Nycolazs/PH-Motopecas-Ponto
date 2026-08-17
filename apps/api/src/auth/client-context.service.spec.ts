import type { Request } from 'express';
import { describe, expect, it } from 'vitest';

import type { AuthConfiguration } from './auth.types.js';
import { ClientContextService } from './client-context.service.js';

const configuration = {
  refreshSecret: 'test-refresh-secret-with-at-least-32-characters',
} as AuthConfiguration;

describe('ClientContextService', () => {
  const service = new ClientContextService(configuration);

  it('uses trusted Express IP, hashes it, sanitizes user agent, and retains safe request IDs', () => {
    const request = {
      ip: '203.0.113.8',
      requestId: 'desktop.login:attempt-1',
      socket: { remoteAddress: '127.0.0.1' },
      header: (name: string): string | undefined =>
        name === 'user-agent' ? '  PH-Ponto\u0000 Desktop  ' : undefined,
    } as unknown as Request;

    const context = service.fromRequest(request);

    expect(context).toMatchObject({
      requestId: 'desktop.login:attempt-1',
      userAgent: 'PH-Ponto Desktop',
    });
    expect(context.ipHash).toMatch(/^[a-f0-9]{64}$/);
    expect(context.ipHash).not.toContain('203.0.113.8');
  });

  it('domain-separates throttle buckets', () => {
    const value = 'same-value';
    expect(service.hashLoginBucket(value)).not.toBe(service.hashIpBucket(value));
  });
});
