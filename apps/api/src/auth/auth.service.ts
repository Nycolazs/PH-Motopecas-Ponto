import { randomUUID, timingSafeEqual } from 'node:crypto';

import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import type { UserRole } from '@ph-ponto/shared';

import { AuditService, type AuditEvent } from '../audit/audit.service.js';
import { PrismaService } from '../database/prisma.service.js';
import {
  AuditAction,
  AuditOutcome,
  AuditTargetType,
  SessionRevocationReason,
} from '../generated/prisma/client.js';
import { AUTH_CLOCK, AUTH_CONFIGURATION } from './auth.constants.js';
import { ClientContextService } from './client-context.service.js';
import type { AuthClock } from './clock.js';
import type { LoginDto } from './dto/login.dto.js';
import { LoginRateLimiterService } from './login-rate-limiter.service.js';
import { normalizeLogin } from './login-normalization.js';
import { PasswordService } from './password.service.js';
import { withSerializableRetry } from './prisma-retry.js';
import type {
  AuthConfiguration,
  AuthenticatedUser,
  AuthResponse,
  ClientContext,
  PublicAuthUser,
} from './auth.types.js';
import { SessionRevocationService } from './session-revocation.service.js';
import { stripControlCharacters } from './text-sanitization.js';
import { TokenService } from './token.service.js';

type LoginInput = LoginDto;

type RotationResult =
  { outcome: 'SUCCESS'; response: AuthResponse } | { outcome: 'INVALID' | 'REUSE' };

function invalidCredentials(): UnauthorizedException {
  return new UnauthorizedException({
    code: 'INVALID_CREDENTIALS',
    message: 'Login ou senha inválidos.',
  });
}

function invalidSession(): UnauthorizedException {
  return new UnauthorizedException({
    code: 'AUTHENTICATION_REQUIRED',
    message: 'Sua sessão não é válida. Entre novamente.',
  });
}

function addSeconds(date: Date, seconds: number): Date {
  return new Date(date.getTime() + seconds * 1_000);
}

function earlierDate(first: Date, second: Date): Date {
  return first.getTime() <= second.getTime() ? first : second;
}

function cleanDeviceName(value: string | undefined): string | null {
  if (value === undefined) {
    return null;
  }

  const cleaned = stripControlCharacters(value.normalize('NFKC')).trim().slice(0, 120);
  return cleaned.length === 0 ? null : cleaned;
}

function equalHashes(first: string, second: string): boolean {
  const firstBuffer = Buffer.from(first, 'hex');
  const secondBuffer = Buffer.from(second, 'hex');
  return firstBuffer.length === secondBuffer.length && timingSafeEqual(firstBuffer, secondBuffer);
}

function publicUser(user: {
  id: string;
  name: string;
  login: string;
  role: UserRole;
}): PublicAuthUser {
  return { id: user.id, name: user.name, login: user.login, role: user.role };
}

function auditContext(
  context: ClientContext,
): Pick<AuditEvent, 'ipHash' | 'userAgent' | 'requestId'> {
  return {
    ipHash: context.ipHash,
    ...(context.userAgent === undefined ? {} : { userAgent: context.userAgent }),
    ...(context.requestId === undefined ? {} : { requestId: context.requestId }),
  };
}

@Injectable()
export class AuthService {
  public constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(PasswordService) private readonly passwords: PasswordService,
    @Inject(TokenService) private readonly tokens: TokenService,
    @Inject(LoginRateLimiterService) private readonly rateLimiter: LoginRateLimiterService,
    @Inject(SessionRevocationService)
    private readonly sessionRevocation: SessionRevocationService,
    @Inject(ClientContextService) private readonly clientContexts: ClientContextService,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(AUTH_CONFIGURATION) private readonly configuration: AuthConfiguration,
    @Inject(AUTH_CLOCK) private readonly clock: AuthClock,
  ) {}

  public async login(input: LoginInput, context: ClientContext): Promise<AuthResponse> {
    const normalizedLogin = normalizeLogin(input.login);
    const loginBucket = this.clientContexts.hashLoginBucket(normalizedLogin);
    const bucketHashes = [loginBucket, this.clientContexts.hashIpBucket(context.ipHash)];
    await this.rateLimiter.consume(bucketHashes);

    const user = await this.prisma.user.findUnique({
      where: { normalizedLogin },
      select: {
        id: true,
        name: true,
        login: true,
        passwordHash: true,
        role: true,
        isActive: true,
      },
    });
    const verification =
      user === null
        ? (await this.passwords.verifyUnknownLogin(input.password),
          {
            valid: false,
            needsRehash: false,
          })
        : await this.passwords.verify(input.password, user.passwordHash);

    if (user === null || !verification.valid || !user.isActive) {
      await this.audit.record({
        actorId: user?.id ?? null,
        action: AuditAction.LOGIN_FAILED,
        outcome: AuditOutcome.FAILURE,
        targetType: AuditTargetType.AUTH_SESSION,
        ...auditContext(context),
        metadata: { reason: 'invalid_credentials', loginBucket },
      });
      throw invalidCredentials();
    }

    const now = this.clock();
    const familyId = randomUUID();
    const refreshToken = this.tokens.issueRefreshToken();
    const absoluteExpiresAt = addSeconds(now, this.configuration.refreshAbsoluteTtlSeconds);
    const expiresAt = earlierDate(
      addSeconds(now, this.configuration.refreshIdleTtlSeconds),
      absoluteExpiresAt,
    );
    const accessToken = await this.tokens.signAccessToken({
      userId: user.id,
      role: user.role,
      sessionId: refreshToken.sessionId,
    });
    const replacementPasswordHash = verification.needsRehash
      ? await this.passwords.hash(input.password)
      : undefined;

    const sessionCreated = await withSerializableRetry(() =>
      this.prisma.$transaction(
        async (transaction) => {
          const currentUser = await transaction.user.findUnique({
            where: { id: user.id },
            select: { isActive: true, role: true, passwordHash: true },
          });
          if (
            currentUser === null ||
            !currentUser.isActive ||
            currentUser.role !== user.role ||
            currentUser.passwordHash !== user.passwordHash
          ) {
            await this.audit.record(
              {
                actorId: user.id,
                action: AuditAction.LOGIN_FAILED,
                outcome: AuditOutcome.FAILURE,
                targetType: AuditTargetType.AUTH_SESSION,
                ...auditContext(context),
                metadata: { reason: 'identity_changed_during_login' },
              },
              transaction,
            );
            return false;
          }

          if (replacementPasswordHash !== undefined) {
            await transaction.user.update({
              where: { id: user.id },
              data: { passwordHash: replacementPasswordHash },
            });
          }

          await transaction.refreshSession.create({
            data: {
              id: refreshToken.sessionId,
              userId: user.id,
              familyId,
              tokenHash: refreshToken.hash,
              expiresAt,
              absoluteExpiresAt,
              deviceName: cleanDeviceName(input.deviceName),
              userAgent: context.userAgent ?? null,
              ipHash: context.ipHash,
              createdAt: now,
            },
          });
          await this.audit.record(
            {
              actorId: user.id,
              action: AuditAction.LOGIN_SUCCEEDED,
              targetType: AuditTargetType.AUTH_SESSION,
              targetId: refreshToken.sessionId,
              ...auditContext(context),
            },
            transaction,
          );
          await transaction.loginThrottle.deleteMany({
            where: { keyHash: { in: bucketHashes } },
          });
          return true;
        },
        { isolationLevel: 'Serializable' },
      ),
    );
    if (!sessionCreated) {
      throw invalidCredentials();
    }

    return {
      accessToken,
      refreshToken: refreshToken.value,
      accessTokenExpiresInSeconds: this.tokens.accessTtlSeconds,
      user: publicUser(user),
    };
  }

  public async refresh(value: string, context: ClientContext): Promise<AuthResponse> {
    const parsed = this.tokens.parseRefreshToken(value);
    if (parsed === undefined) {
      throw invalidSession();
    }

    const nextToken = this.tokens.issueRefreshToken();
    const now = this.clock();
    const result = await withSerializableRetry<RotationResult>(() =>
      this.prisma.$transaction(
        async (transaction): Promise<RotationResult> => {
          const session = await transaction.refreshSession.findUnique({
            where: { id: parsed.sessionId },
            include: { user: true },
          });
          if (session === null || !equalHashes(session.tokenHash, parsed.hash)) {
            return { outcome: 'INVALID' };
          }

          if (session.revokedAt !== null) {
            return { outcome: 'INVALID' };
          }

          if (session.rotatedAt !== null) {
            await this.sessionRevocation.revokeFamily(
              session.familyId,
              SessionRevocationReason.REFRESH_REUSE,
              transaction,
              now,
            );
            await this.audit.record(
              {
                actorId: session.userId,
                action: AuditAction.REFRESH_REUSED,
                outcome: AuditOutcome.FAILURE,
                targetType: AuditTargetType.AUTH_SESSION,
                targetId: session.id,
                ...auditContext(context),
              },
              transaction,
            );
            return { outcome: 'REUSE' };
          }

          if (
            session.expiresAt.getTime() <= now.getTime() ||
            session.absoluteExpiresAt.getTime() <= now.getTime() ||
            !session.user.isActive
          ) {
            const reason = session.user.isActive
              ? SessionRevocationReason.EXPIRED
              : SessionRevocationReason.USER_DEACTIVATED;
            await this.sessionRevocation.revokeFamily(session.familyId, reason, transaction, now);
            return { outcome: 'INVALID' };
          }

          const expiresAt = earlierDate(
            addSeconds(now, this.configuration.refreshIdleTtlSeconds),
            session.absoluteExpiresAt,
          );
          const accessToken = await this.tokens.signAccessToken({
            userId: session.user.id,
            role: session.user.role,
            sessionId: nextToken.sessionId,
          });
          await transaction.refreshSession.create({
            data: {
              id: nextToken.sessionId,
              userId: session.userId,
              familyId: session.familyId,
              tokenHash: nextToken.hash,
              expiresAt,
              absoluteExpiresAt: session.absoluteExpiresAt,
              deviceName: session.deviceName,
              userAgent: context.userAgent ?? null,
              ipHash: context.ipHash,
              createdAt: now,
            },
          });
          const claimed = await transaction.refreshSession.updateMany({
            where: {
              id: session.id,
              tokenHash: parsed.hash,
              rotatedAt: null,
              revokedAt: null,
              expiresAt: { gt: now },
              absoluteExpiresAt: { gt: now },
            },
            data: {
              rotatedAt: now,
              lastUsedAt: now,
              replacedBySessionId: nextToken.sessionId,
            },
          });
          if (claimed.count !== 1) {
            await transaction.refreshSession.delete({ where: { id: nextToken.sessionId } });
            await this.sessionRevocation.revokeFamily(
              session.familyId,
              SessionRevocationReason.REFRESH_REUSE,
              transaction,
              now,
            );
            await this.audit.record(
              {
                actorId: session.userId,
                action: AuditAction.REFRESH_REUSED,
                outcome: AuditOutcome.FAILURE,
                targetType: AuditTargetType.AUTH_SESSION,
                targetId: session.id,
                ...auditContext(context),
              },
              transaction,
            );
            return { outcome: 'REUSE' };
          }

          return {
            outcome: 'SUCCESS',
            response: {
              accessToken,
              refreshToken: nextToken.value,
              accessTokenExpiresInSeconds: this.tokens.accessTtlSeconds,
              user: publicUser(session.user),
            },
          };
        },
        { isolationLevel: 'Serializable' },
      ),
    );

    if (result.outcome !== 'SUCCESS') {
      throw invalidSession();
    }

    return result.response;
  }

  public async logout(user: AuthenticatedUser, context: ClientContext): Promise<void> {
    const now = this.clock();
    await withSerializableRetry(() =>
      this.prisma.$transaction(
        async (transaction) => {
          const session = await transaction.refreshSession.findUnique({
            where: { id: user.sessionId },
            select: { familyId: true },
          });
          if (session === null) {
            return;
          }

          await this.sessionRevocation.revokeFamily(
            session.familyId,
            SessionRevocationReason.LOGOUT,
            transaction,
            now,
          );
          await this.audit.record(
            {
              actorId: user.id,
              action: AuditAction.LOGOUT,
              targetType: AuditTargetType.AUTH_SESSION,
              targetId: user.sessionId,
              ...auditContext(context),
            },
            transaction,
          );
        },
        { isolationLevel: 'Serializable' },
      ),
    );
  }
}
