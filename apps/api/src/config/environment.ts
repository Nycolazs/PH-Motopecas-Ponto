import { BUSINESS_TIME_ZONE } from '@ph-ponto/shared';
import { z } from 'zod';

const booleanSchema = z.preprocess((value) => {
  if (typeof value !== 'string') {
    return value;
  }

  if (value.toLowerCase() === 'true') {
    return true;
  }

  if (value.toLowerCase() === 'false') {
    return false;
  }

  return value;
}, z.boolean());

function isOriginUrl(value: string, protocols: string[]): boolean {
  const url = new URL(value);
  return (
    protocols.includes(url.protocol) &&
    url.username.length === 0 &&
    url.password.length === 0 &&
    url.pathname === '/' &&
    url.search.length === 0 &&
    url.hash.length === 0
  );
}

function isLoopbackDevelopmentOrigin(value: string): boolean {
  const url = new URL(value);
  return (
    isOriginUrl(value, ['http:']) &&
    ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) &&
    url.port.length > 0
  );
}

const postgresUrlSchema = z
  .string()
  .trim()
  .min(1)
  .refine(
    (value) => {
      try {
        const protocol = new URL(value).protocol;
        return protocol === 'postgres:' || protocol === 'postgresql:';
      } catch {
        return false;
      }
    },
    { message: 'DATABASE_URL deve ser uma URL PostgreSQL válida.' },
  );

const knownDevelopmentSecrets = new Set([
  'replace-with-at-least-32-random-characters',
  'replace-with-another-32-random-characters',
  'development-access-secret-change-before-production',
  'development-refresh-secret-change-before-production',
]);

const knownDevelopmentPasswords = new Set([
  'replace-with-a-strong-bootstrap-password',
  'development-bootstrap-password-change-me',
]);

const rawEnvironmentSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    DATABASE_URL: postgresUrlSchema,
    API_HOST: z.string().trim().min(1).default('0.0.0.0'),
    API_PORT: z.coerce.number().int().min(1).max(65_535).default(3333),
    API_BASE_URL: z.url().refine((value) => isOriginUrl(value, ['http:', 'https:']), {
      message: 'API_BASE_URL deve conter somente a origem HTTP(S).',
    }),
    APP_TIMEZONE: z.literal(BUSINESS_TIME_ZONE).default(BUSINESS_TIME_ZONE),
    DESKTOP_DEV_ORIGIN: z
      .url()
      .refine(isLoopbackDevelopmentOrigin, {
        message: 'DESKTOP_DEV_ORIGIN deve ser uma origem HTTP loopback com porta explícita.',
      })
      .default('http://localhost:5173'),
    ADMIN_WEB_ORIGIN: z.string().trim().optional(),
    JWT_SECRET: z.string().min(32).max(4_096),
    JWT_REFRESH_SECRET: z.string().min(32).max(4_096),
    JWT_ISSUER: z.string().trim().min(3).max(128).default('ph-ponto-api'),
    JWT_AUDIENCE: z.string().trim().min(3).max(128).default('ph-ponto-desktop'),
    JWT_ACCESS_TTL_SECONDS: z.coerce.number().int().min(60).max(900).default(300),
    REFRESH_IDLE_TTL_SECONDS: z.coerce.number().int().min(3_600).max(2_592_000).default(604_800),
    REFRESH_ABSOLUTE_TTL_SECONDS: z.coerce
      .number()
      .int()
      .min(3_600)
      .max(7_776_000)
      .default(2_592_000),
    AUTH_LOGIN_WINDOW_SECONDS: z.coerce.number().int().min(60).max(3_600).default(900),
    AUTH_LOGIN_MAX_ATTEMPTS: z.coerce.number().int().min(3).max(20).default(5),
    AUTH_LOGIN_BLOCK_SECONDS: z.coerce.number().int().min(60).max(86_400).default(900),
    INITIAL_ADMIN_USERNAME: z.string().trim().min(3).max(64),
    INITIAL_ADMIN_PASSWORD: z.string().min(8).max(256),
    UPLOAD_DIR: z.string().trim().min(1).max(1_024),
    SWAGGER_ENABLED: booleanSchema.optional(),
    TRUST_PROXY_COUNT: z.coerce.number().int().min(0).max(10).default(0),
    DATABASE_CONNECTION_TIMEOUT_MS: z.coerce.number().int().min(100).max(30_000).default(2_000),
    DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(100).default(10),
    READINESS_TIMEOUT_MS: z.coerce.number().int().min(100).max(30_000).default(3_000),
  })
  .superRefine((environment, context) => {
    if (environment.JWT_SECRET === environment.JWT_REFRESH_SECRET) {
      context.addIssue({
        code: 'custom',
        message: 'Os segredos de acesso e renovação devem ser diferentes.',
        path: ['JWT_REFRESH_SECRET'],
      });
    }

    if (environment.REFRESH_ABSOLUTE_TTL_SECONDS < environment.REFRESH_IDLE_TTL_SECONDS) {
      context.addIssue({
        code: 'custom',
        message: 'A duração absoluta da sessão deve ser igual ou maior que a duração ociosa.',
        path: ['REFRESH_ABSOLUTE_TTL_SECONDS'],
      });
    }

    if (environment.NODE_ENV !== 'production') {
      return;
    }

    for (const [field, secret] of [
      ['JWT_SECRET', environment.JWT_SECRET],
      ['JWT_REFRESH_SECRET', environment.JWT_REFRESH_SECRET],
    ] as const) {
      if (knownDevelopmentSecrets.has(secret)) {
        context.addIssue({
          code: 'custom',
          message: 'O segredo padrão de desenvolvimento não pode ser usado em produção.',
          path: [field],
        });
      }
    }

    if (knownDevelopmentPasswords.has(environment.INITIAL_ADMIN_PASSWORD)) {
      context.addIssue({
        code: 'custom',
        message: 'A senha inicial padrão não pode ser usada em produção.',
        path: ['INITIAL_ADMIN_PASSWORD'],
      });
    }
  });

export interface EnvironmentVariables extends z.infer<typeof rawEnvironmentSchema> {
  SWAGGER_ENABLED: boolean;
}

export class EnvironmentValidationError extends Error {
  public constructor() {
    super('A configuração do ambiente da API é inválida.');
    this.name = 'EnvironmentValidationError';
  }
}

export function validateEnvironment(environment: Record<string, unknown>): EnvironmentVariables {
  const result = rawEnvironmentSchema.safeParse(environment);

  if (!result.success) {
    throw new EnvironmentValidationError();
  }

  return {
    ...result.data,
    SWAGGER_ENABLED: result.data.SWAGGER_ENABLED ?? result.data.NODE_ENV !== 'production',
  };
}
