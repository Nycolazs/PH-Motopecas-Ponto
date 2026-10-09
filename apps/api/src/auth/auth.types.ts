import type { UserRole } from '@ph-ponto/shared';

export interface AuthConfiguration {
  accessSecret: string;
  refreshSecret: string;
  issuer: string;
  audience: string;
  accessTtlSeconds: number;
  refreshIdleTtlSeconds: number;
  refreshAbsoluteTtlSeconds: number;
  loginWindowSeconds: number;
  loginMaxAttempts: number;
  /** Failed attempts tolerated from one client IP (a whole store may share one). */
  loginIpMaxAttempts: number;
  loginBlockSeconds: number;
}

export interface AuthenticatedUser {
  id: string;
  name: string;
  login: string;
  role: UserRole;
  sessionId: string;
}

export interface AccessTokenClaims {
  sub: string;
  role: UserRole;
  sid: string;
  type: 'access';
  iss?: string;
  aud?: string | string[];
  iat?: number;
  exp?: number;
}

export interface ClientContext {
  ipHash: string;
  userAgent?: string;
  requestId?: string;
}

export interface SessionTokens {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresInSeconds: number;
}

export interface PublicAuthUser {
  id: string;
  name: string;
  login: string;
  role: UserRole;
}

export interface AuthResponse extends SessionTokens {
  user: PublicAuthUser;
}
