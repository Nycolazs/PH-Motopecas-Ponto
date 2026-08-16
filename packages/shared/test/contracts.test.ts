import { describe, expect, expectTypeOf, it } from 'vitest';

import {
  apiProblemSchema,
  healthResponseSchema,
  userRoleSchema,
  type ApiProblem,
  type HealthResponse,
  type UserRole,
} from '../src/index.js';

describe('shared contracts', () => {
  it.each(['ADMIN', 'EMPLOYEE'] as const)('accepts the %s user role', (role) => {
    expect(userRoleSchema.parse(role)).toBe(role);
  });

  it('rejects unsupported user roles', () => {
    expect(userRoleSchema.safeParse('MANAGER').success).toBe(false);
  });

  it('accepts the stable API problem shape', () => {
    const problem = {
      status: 400,
      code: 'VALIDATION_ERROR',
      message: 'Confira os campos informados.',
      details: {
        username: ['Informe o usuário.'],
      },
      requestId: 'req_01JEXAMPLE',
      timestamp: '2026-08-14T23:45:12.123Z',
    };

    expect(apiProblemSchema.parse(problem)).toEqual(problem);
  });

  it.each([
    { status: 399 },
    { code: 'validation-error' },
    { timestamp: '14/08/2026 20:45' },
    { extra: 'internal detail' },
  ])('rejects an invalid API problem field: %o', (override) => {
    const result = apiProblemSchema.safeParse({
      status: 500,
      code: 'INTERNAL_ERROR',
      message: 'Não foi possível concluir a solicitação.',
      requestId: 'req_01JEXAMPLE',
      timestamp: '2026-08-14T23:45:12.123Z',
      ...override,
    });

    expect(result.success).toBe(false);
  });

  it.each(['ok', 'degraded'] as const)('accepts the %s health status', (status) => {
    const response = {
      status,
      service: 'api' as const,
      timestamp: '2026-08-14T23:45:12.123Z',
    };

    expect(healthResponseSchema.parse(response)).toEqual(response);
  });

  it('rejects leaking dependency details from the health response contract', () => {
    const result = healthResponseSchema.safeParse({
      status: 'degraded',
      service: 'api',
      timestamp: '2026-08-14T23:45:12.123Z',
      databaseUrl: 'postgresql://internal-host/ph_ponto',
    });

    expect(result.success).toBe(false);
  });

  it('exports types inferred from their runtime schemas', () => {
    expectTypeOf<UserRole>().toEqualTypeOf<'ADMIN' | 'EMPLOYEE'>();
    expectTypeOf(apiProblemSchema.parse).returns.toEqualTypeOf<ApiProblem>();
    expectTypeOf(healthResponseSchema.parse).returns.toEqualTypeOf<HealthResponse>();
  });
});
