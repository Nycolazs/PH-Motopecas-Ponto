import { createHmac, randomBytes, randomUUID } from 'node:crypto';

import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { userRoleSchema, type UserRole } from '@ph-ponto/shared';

import { ACCESS_TOKEN_ALGORITHM, ACCESS_TOKEN_TYPE, AUTH_CONFIGURATION } from './auth.constants.js';
import type { AccessTokenClaims, AuthConfiguration } from './auth.types.js';

const REFRESH_TOKEN_PATTERN =
  /^([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\.([A-Za-z0-9_-]{43})$/i;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

interface AccessIdentity {
  userId: string;
  role: UserRole;
  sessionId: string;
}

export interface IssuedRefreshToken {
  sessionId: string;
  value: string;
  hash: string;
}

function invalidSession(): UnauthorizedException {
  return new UnauthorizedException({
    code: 'AUTHENTICATION_REQUIRED',
    message: 'Sua sessão não é válida. Entre novamente.',
  });
}

@Injectable()
export class TokenService {
  public constructor(
    @Inject(JwtService) private readonly jwtService: JwtService,
    @Inject(AUTH_CONFIGURATION) private readonly configuration: AuthConfiguration,
  ) {}

  public async signAccessToken(identity: AccessIdentity): Promise<string> {
    return this.jwtService.signAsync(
      {
        role: identity.role,
        sid: identity.sessionId,
        type: ACCESS_TOKEN_TYPE,
      },
      {
        algorithm: ACCESS_TOKEN_ALGORITHM,
        secret: this.configuration.accessSecret,
        subject: identity.userId,
        issuer: this.configuration.issuer,
        audience: this.configuration.audience,
        expiresIn: this.configuration.accessTtlSeconds,
      },
    );
  }

  public async verifyAccessToken(token: string): Promise<AccessTokenClaims> {
    try {
      const claims = await this.jwtService.verifyAsync<AccessTokenClaims>(token, {
        algorithms: [ACCESS_TOKEN_ALGORITHM],
        secret: this.configuration.accessSecret,
        issuer: this.configuration.issuer,
        audience: this.configuration.audience,
        clockTolerance: 5,
      });

      if (
        claims.type !== ACCESS_TOKEN_TYPE ||
        typeof claims.sub !== 'string' ||
        typeof claims.sid !== 'string' ||
        !UUID_PATTERN.test(claims.sub) ||
        !UUID_PATTERN.test(claims.sid) ||
        !Number.isInteger(claims.iat) ||
        !Number.isInteger(claims.exp) ||
        claims.exp! <= claims.iat! ||
        claims.exp! - claims.iat! > this.configuration.accessTtlSeconds + 1 ||
        !userRoleSchema.safeParse(claims.role).success
      ) {
        throw invalidSession();
      }

      return claims;
    } catch {
      throw invalidSession();
    }
  }

  public issueRefreshToken(sessionId = randomUUID()): IssuedRefreshToken {
    const value = `${sessionId}.${randomBytes(32).toString('base64url')}`;
    return { sessionId, value, hash: this.hashRefreshToken(value) };
  }

  public parseRefreshToken(value: string): { sessionId: string; hash: string } | undefined {
    const match = REFRESH_TOKEN_PATTERN.exec(value);
    if (match === null) {
      return undefined;
    }

    return { sessionId: match[1]!.toLowerCase(), hash: this.hashRefreshToken(value) };
  }

  public hashRefreshToken(value: string): string {
    return createHmac('sha256', this.configuration.refreshSecret)
      .update('ph-ponto:refresh-token:', 'utf8')
      .update(value, 'utf8')
      .digest('hex');
  }

  public get accessTtlSeconds(): number {
    return this.configuration.accessTtlSeconds;
  }
}
