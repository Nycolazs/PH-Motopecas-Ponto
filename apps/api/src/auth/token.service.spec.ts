import { JwtService } from '@nestjs/jwt';
import { describe, expect, it } from 'vitest';

import type { AuthConfiguration } from './auth.types.js';
import { TokenService } from './token.service.js';

const configuration: AuthConfiguration = {
  accessSecret: 'test-access-secret-with-at-least-32-characters',
  refreshSecret: 'test-refresh-secret-with-at-least-32-characters',
  issuer: 'ph-ponto-api',
  audience: 'ph-ponto-desktop',
  accessTtlSeconds: 300,
  refreshIdleTtlSeconds: 604_800,
  refreshAbsoluteTtlSeconds: 2_592_000,
  loginWindowSeconds: 900,
  loginMaxAttempts: 5,
  loginBlockSeconds: 900,
};

describe('TokenService', () => {
  const jwt = new JwtService();
  const service = new TokenService(jwt, configuration);

  it('issues an HS256 access token with required identity claims', async () => {
    const accessToken = await service.signAccessToken({
      userId: '487d962c-c34d-486b-83be-c1aac9772f9d',
      role: 'ADMIN',
      sessionId: '23144362-e369-49e4-9241-1920b05e32f7',
    });

    await expect(service.verifyAccessToken(accessToken)).resolves.toMatchObject({
      sub: '487d962c-c34d-486b-83be-c1aac9772f9d',
      role: 'ADMIN',
      sid: '23144362-e369-49e4-9241-1920b05e32f7',
      type: 'access',
      iss: configuration.issuer,
      aud: configuration.audience,
    });
  });

  it('rejects tokens signed with an unconfigured algorithm', async () => {
    const wrongAlgorithm = await jwt.signAsync(
      {
        role: 'ADMIN',
        sid: '23144362-e369-49e4-9241-1920b05e32f7',
        type: 'access',
      },
      {
        algorithm: 'HS384',
        secret: configuration.accessSecret,
        subject: '487d962c-c34d-486b-83be-c1aac9772f9d',
        issuer: configuration.issuer,
        audience: configuration.audience,
        expiresIn: 300,
      },
    );

    await expect(service.verifyAccessToken(wrongAlgorithm)).rejects.toMatchObject({ status: 401 });
  });

  it('rejects an otherwise valid signature without a bounded expiry', async () => {
    const missingExpiry = await jwt.signAsync(
      {
        role: 'ADMIN',
        sid: '23144362-e369-49e4-9241-1920b05e32f7',
        type: 'access',
      },
      {
        algorithm: 'HS256',
        secret: configuration.accessSecret,
        subject: '487d962c-c34d-486b-83be-c1aac9772f9d',
        issuer: configuration.issuer,
        audience: configuration.audience,
      },
    );

    await expect(service.verifyAccessToken(missingExpiry)).rejects.toMatchObject({ status: 401 });
  });

  it('issues opaque high-entropy refresh values and parses only the strict format', () => {
    const issued = service.issueRefreshToken('23144362-e369-49e4-9241-1920b05e32f7');

    expect(issued.value).toMatch(/^23144362-e369-49e4-9241-1920b05e32f7\.[A-Za-z0-9_-]{43}$/);
    expect(issued.hash).toMatch(/^[a-f0-9]{64}$/);
    expect(service.parseRefreshToken(issued.value)).toEqual({
      sessionId: issued.sessionId,
      hash: issued.hash,
    });
    expect(service.parseRefreshToken(`${issued.value}extra`)).toBeUndefined();
    expect(issued.hash).not.toContain(issued.value);
  });
});
