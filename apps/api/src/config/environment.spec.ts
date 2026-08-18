import { BUSINESS_TIME_ZONE } from '@ph-ponto/shared';
import { describe, expect, it } from 'vitest';

import { EnvironmentValidationError, validateEnvironment } from './environment.js';

const validEnvironment = {
  DATABASE_URL: 'postgresql://ph_ponto:secret@localhost:5432/ph_ponto',
  API_BASE_URL: 'http://localhost:3000',
  JWT_SECRET: 'access-secret-with-at-least-32-characters',
  JWT_REFRESH_SECRET: 'refresh-secret-with-at-least-32-characters',
  INITIAL_ADMIN_USERNAME: 'admin',
  INITIAL_ADMIN_PASSWORD: 'strong-bootstrap-password',
  UPLOAD_DIR: './data/uploads',
};

describe('validateEnvironment', () => {
  it('applies safe development defaults and coerces values', () => {
    const environment = validateEnvironment({
      ...validEnvironment,
      API_PORT: '3100',
      DATABASE_POOL_MAX: '7',
      SWAGGER_ENABLED: 'false',
    });

    expect(environment).toMatchObject({
      NODE_ENV: 'development',
      API_HOST: '0.0.0.0',
      API_PORT: 3100,
      APP_TIMEZONE: BUSINESS_TIME_ZONE,
      DATABASE_POOL_MAX: 7,
      SWAGGER_ENABLED: false,
    });
  });

  it('disables Swagger by default in production', () => {
    const environment = validateEnvironment({
      ...validEnvironment,
      NODE_ENV: 'production',
    });

    expect(environment.SWAGGER_ENABLED).toBe(false);
  });

  it('rejects non-PostgreSQL URLs without exposing the supplied value', () => {
    const secretUrl = 'https://admin:highly-secret@example.com/database';

    expect(() => validateEnvironment({ DATABASE_URL: secretUrl })).toThrow(
      EnvironmentValidationError,
    );

    try {
      validateEnvironment({ DATABASE_URL: secretUrl });
    } catch (error) {
      expect(String(error)).not.toContain('highly-secret');
    }
  });

  it('requires the official business timezone', () => {
    expect(() =>
      validateEnvironment({ ...validEnvironment, APP_TIMEZONE: 'America/Manaus' }),
    ).toThrow(EnvironmentValidationError);
  });

  it('requires independent access and refresh secrets with at least 32 characters', () => {
    expect(() =>
      validateEnvironment({
        ...validEnvironment,
        JWT_SECRET: 'too-short',
      }),
    ).toThrow(EnvironmentValidationError);
    expect(() =>
      validateEnvironment({
        ...validEnvironment,
        JWT_REFRESH_SECRET: validEnvironment.JWT_SECRET,
      }),
    ).toThrow(EnvironmentValidationError);
  });

  it('bounds access and refresh lifetimes', () => {
    expect(() =>
      validateEnvironment({
        ...validEnvironment,
        JWT_ACCESS_TTL_SECONDS: '901',
      }),
    ).toThrow(EnvironmentValidationError);
    expect(() =>
      validateEnvironment({
        ...validEnvironment,
        REFRESH_IDLE_TTL_SECONDS: '7200',
        REFRESH_ABSOLUTE_TTL_SECONDS: '3600',
      }),
    ).toThrow(EnvironmentValidationError);
  });

  it('does not expose authentication or bootstrap secrets in validation errors', () => {
    const invalidSecret = 'sensitive-bootstrap-value';

    try {
      validateEnvironment({
        ...validEnvironment,
        JWT_SECRET: invalidSecret,
        INITIAL_ADMIN_PASSWORD: 'sh',
      });
    } catch (error) {
      expect(String(error)).not.toContain(invalidSecret);
      expect(String(error)).not.toContain('sh');
    }
  });

  it('rejects known development credentials in production', () => {
    expect(() =>
      validateEnvironment({
        ...validEnvironment,
        NODE_ENV: 'production',
        JWT_SECRET: 'development-access-secret-change-before-production',
        JWT_REFRESH_SECRET: 'development-refresh-secret-change-before-production',
        INITIAL_ADMIN_PASSWORD: 'development-bootstrap-password-change-me',
      }),
    ).toThrow(EnvironmentValidationError);
  });

  it('requires API_BASE_URL to contain only an HTTP(S) origin', () => {
    for (const API_BASE_URL of [
      'ftp://api.example.com',
      'https://user:secret@api.example.com',
      'https://api.example.com/v1',
      'https://api.example.com?debug=true',
      'https://api.example.com/#docs',
    ]) {
      expect(() => validateEnvironment({ ...validEnvironment, API_BASE_URL })).toThrow(
        EnvironmentValidationError,
      );
    }
  });

  it('requires an exact loopback HTTP origin with an explicit development port', () => {
    for (const DESKTOP_DEV_ORIGIN of [
      'http://localhost',
      'https://localhost:5173',
      'http://desktop.internal:5173',
      'http://127.0.0.1:5173/app',
    ]) {
      expect(() => validateEnvironment({ ...validEnvironment, DESKTOP_DEV_ORIGIN })).toThrow(
        EnvironmentValidationError,
      );
    }
  });
});
