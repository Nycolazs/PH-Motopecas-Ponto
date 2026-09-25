import { z } from 'zod';

export const employmentEventTypeSchema = z.enum([
  'ADMISSION',
  'ROLE_CHANGE',
  'SUSPENSION',
  'TERMINATION',
  'REACTIVATION',
  'NOTE',
]);
export type EmploymentEventTypeDto = z.infer<typeof employmentEventTypeSchema>;

export const terminationReasonSchema = z.enum([
  'WITHOUT_CAUSE',
  'WITH_CAUSE',
  'EMPLOYEE_RESIGNATION',
  'MUTUAL_AGREEMENT',
  'CONTRACT_EXPIRATION',
  'OTHER',
]);
export type TerminationReasonDto = z.infer<typeof terminationReasonSchema>;

export const createEmploymentEventSchema = z.object({
  eventType: employmentEventTypeSchema,
  effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data de vigência inválida (AAAA-MM-DD).'),
  title: z.string().min(2, 'Título é obrigatório.').max(150),
  description: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type CreateEmploymentEventDto = z.infer<typeof createEmploymentEventSchema>;

export const terminateEmployeeSchema = z.object({
  effectiveDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data de desligamento inválida (AAAA-MM-DD).'),
  reason: terminationReasonSchema,
  notes: z.string().optional(),
});
export type TerminateEmployeeDto = z.infer<typeof terminateEmployeeSchema>;

export const reactivateEmployeeSchema = z.object({
  effectiveDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data de reativação inválida (AAAA-MM-DD).'),
  notes: z.string().optional(),
});
export type ReactivateEmployeeDto = z.infer<typeof reactivateEmployeeSchema>;

export const employmentEventSchema = z.object({
  id: z.string().uuid(),
  employeeId: z.string().uuid(),
  eventType: employmentEventTypeSchema,
  effectiveDate: z.string(),
  title: z.string(),
  description: z.string().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
  createdById: z.string().uuid(),
  createdByName: z.string().optional(),
  createdAt: z.string(),
});
export type EmploymentEventDto = z.infer<typeof employmentEventSchema>;

export const paginatedEmploymentEventsSchema = z.object({
  items: z.array(employmentEventSchema),
  total: z.number().int(),
  limit: z.number().int(),
  offset: z.number().int(),
});
export type PaginatedEmploymentEventsDto = z.infer<typeof paginatedEmploymentEventsSchema>;
