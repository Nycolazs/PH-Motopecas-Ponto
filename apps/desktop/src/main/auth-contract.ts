import type {
  DesktopAuthError,
  DesktopAuthUser,
  DesktopLoginInput,
} from '../shared/electron-api.js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const REFRESH_TOKEN_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.[A-Za-z0-9_-]{43,91}$/i;
const ERROR_CODE_PATTERN = /^[A-Z][A-Z0-9_]{0,63}$/;
const ACCESS_TOKEN_PATTERN = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;
const MAX_ACCESS_TOKEN_LENGTH = 16_384;

export interface ApiAuthResponse {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresInSeconds: number;
  user: DesktopAuthUser;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const allowed = new Set(keys);
  return Object.keys(value).every((key) => allowed.has(key));
}

function boundedString(value: unknown, minimum: number, maximum: number): value is string {
  return typeof value === 'string' && value.length >= minimum && value.length <= maximum;
}

export function parseDesktopLoginInput(value: unknown): DesktopLoginInput {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, ['login', 'password']) ||
    !boundedString(value.login, 3, 64) ||
    !boundedString(value.password, 1, 256)
  ) {
    throw new AuthContractError({
      code: 'INVALID_AUTH_INPUT',
      message: 'Confira o login e a senha informados.',
      status: 400,
    });
  }

  return { login: value.login, password: value.password };
}

export function isRefreshToken(value: unknown): value is string {
  return typeof value === 'string' && REFRESH_TOKEN_PATTERN.test(value);
}

export function parseApiAuthResponse(value: unknown): ApiAuthResponse {
  if (!isRecord(value) || !isRecord(value.user)) {
    throw invalidApiResponse();
  }

  const { user } = value;
  if (
    !boundedString(value.accessToken, 1, MAX_ACCESS_TOKEN_LENGTH) ||
    !ACCESS_TOKEN_PATTERN.test(value.accessToken) ||
    !isRefreshToken(value.refreshToken) ||
    value.accessToken === value.refreshToken ||
    !Number.isInteger(value.accessTokenExpiresInSeconds) ||
    (value.accessTokenExpiresInSeconds as number) < 1 ||
    (value.accessTokenExpiresInSeconds as number) > 86_400 ||
    !boundedString(user.id, 36, 36) ||
    !UUID_PATTERN.test(user.id) ||
    !boundedString(user.name, 1, 120) ||
    !boundedString(user.login, 1, 64) ||
    (user.role !== 'ADMIN' && user.role !== 'EMPLOYEE')
  ) {
    throw invalidApiResponse();
  }

  return {
    accessToken: value.accessToken,
    refreshToken: value.refreshToken,
    accessTokenExpiresInSeconds: value.accessTokenExpiresInSeconds as number,
    user: {
      id: user.id,
      name: user.name,
      login: user.login,
      role: user.role,
    },
  };
}

export function parseSafeApiError(value: unknown, status: number): DesktopAuthError | undefined {
  if (!isRecord(value)) return undefined;
  if (
    !boundedString(value.code, 1, 64) ||
    !ERROR_CODE_PATTERN.test(value.code) ||
    !boundedString(value.message, 1, 500)
  ) {
    return undefined;
  }

  return { code: value.code, message: value.message, status };
}

export class AuthContractError extends Error {
  public constructor(public readonly safe: DesktopAuthError) {
    super(safe.message);
    this.name = 'AuthContractError';
  }
}

function invalidApiResponse(): AuthContractError {
  return new AuthContractError({
    code: 'INVALID_API_RESPONSE',
    message: 'O servidor retornou uma resposta de autenticação inválida.',
  });
}
