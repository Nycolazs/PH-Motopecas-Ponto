import { z } from 'zod';

export const USER_ROLES = ['ADMIN', 'EMPLOYEE'] as const;

export const userRoleSchema = z.enum(USER_ROLES);

export type UserRole = z.infer<typeof userRoleSchema>;

export const apiProblemDetailsSchema = z.record(z.string(), z.array(z.string()));

export type ApiProblemDetails = z.infer<typeof apiProblemDetailsSchema>;

export const apiProblemSchema = z
  .object({
    status: z.number().int().min(400).max(599),
    code: z.string().regex(/^[A-Z][A-Z0-9_]*$/),
    message: z.string().trim().min(1),
    details: apiProblemDetailsSchema.optional(),
    requestId: z.string().trim().min(1),
    timestamp: z.string().datetime({ offset: true }),
  })
  .strict();

export type ApiProblem = z.infer<typeof apiProblemSchema>;

export const HEALTH_STATUSES = ['ok', 'degraded'] as const;

export const healthStatusSchema = z.enum(HEALTH_STATUSES);

export type HealthStatus = z.infer<typeof healthStatusSchema>;

export const healthResponseSchema = z
  .object({
    status: healthStatusSchema,
    service: z.literal('api'),
    timestamp: z.string().datetime({ offset: true }),
  })
  .strict();

export type HealthResponse = z.infer<typeof healthResponseSchema>;
