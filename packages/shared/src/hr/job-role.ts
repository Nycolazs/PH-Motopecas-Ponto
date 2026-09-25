import { z } from 'zod';

export const jobRoleVersionSchema = z
  .object({
    id: z.string().uuid(),
    jobRoleId: z.string().uuid(),
    versionNumber: z.number().int().positive(),
    title: z.string().min(1).max(120),
    cbo: z.string().max(20).nullable().optional(),
    description: z.string().min(1),
    responsibilities: z.array(z.string()),
    requirements: z.array(z.string()),
    createdById: z.string().uuid(),
    publishedAt: z.string().datetime({ offset: true }),
    createdAt: z.string().datetime({ offset: true }),
  })
  .strict();

export type JobRoleVersionDto = z.infer<typeof jobRoleVersionSchema>;

export const jobRoleSchema = z
  .object({
    id: z.string().uuid(),
    title: z.string().min(1).max(120),
    department: z.string().max(100).nullable().optional(),
    isActive: z.boolean(),
    createdAt: z.string().datetime({ offset: true }),
    updatedAt: z.string().datetime({ offset: true }),
    currentVersion: jobRoleVersionSchema.nullable().optional(),
    versions: z.array(jobRoleVersionSchema).optional(),
    activeEmployeesCount: z.number().int().nonnegative().optional(),
  })
  .strict();

export type JobRoleDto = z.infer<typeof jobRoleSchema>;

export const createJobRoleSchema = z
  .object({
    title: z.string().trim().min(2, 'O título do cargo deve ter pelo menos 2 caracteres.').max(120),
    department: z.string().trim().max(100).optional().nullable(),
    cbo: z.string().trim().max(20).optional().nullable(),
    description: z.string().trim().min(10, 'A descrição deve ter pelo menos 10 caracteres.'),
    responsibilities: z.array(z.string().trim().min(1)).default([]),
    requirements: z.array(z.string().trim().min(1)).default([]),
  })
  .strict();

export type CreateJobRoleDto = z.infer<typeof createJobRoleSchema>;

export const updateJobRoleSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(2, 'O título do cargo deve ter pelo menos 2 caracteres.')
      .max(120)
      .optional(),
    department: z.string().trim().max(100).optional().nullable(),
    isActive: z.boolean().optional(),
  })
  .strict();

export type UpdateJobRoleDto = z.infer<typeof updateJobRoleSchema>;

export const createJobRoleVersionSchema = z
  .object({
    title: z.string().trim().min(2).max(120).optional(),
    cbo: z.string().trim().max(20).optional().nullable(),
    description: z.string().trim().min(10, 'A descrição deve ter pelo menos 10 caracteres.'),
    responsibilities: z.array(z.string().trim().min(1)).default([]),
    requirements: z.array(z.string().trim().min(1)).default([]),
  })
  .strict();

export type CreateJobRoleVersionDto = z.infer<typeof createJobRoleVersionSchema>;

export const employeeRoleAssignmentSchema = z
  .object({
    id: z.string().uuid(),
    employeeId: z.string().uuid(),
    jobRoleId: z.string().uuid(),
    jobRoleVersionId: z.string().uuid(),
    roleTitle: z.string().min(1),
    versionNumber: z.number().int().positive(),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    endDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .nullable()
      .optional(),
    isPrincipal: z.boolean(),
    notes: z.string().nullable().optional(),
    createdAt: z.string().datetime({ offset: true }),
  })
  .strict();

export type EmployeeRoleAssignmentDto = z.infer<typeof employeeRoleAssignmentSchema>;

export const assignEmployeeRoleSchema = z
  .object({
    jobRoleId: z.string().uuid(),
    jobRoleVersionId: z.string().uuid().optional(),
    startDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data de início deve estar no formato AAAA-MM-DD.'),
    endDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data de término deve estar no formato AAAA-MM-DD.')
      .optional()
      .nullable(),
    isPrincipal: z.boolean().default(true),
    notes: z.string().trim().max(500).optional().nullable(),
  })
  .strict();

export type AssignEmployeeRoleDto = z.infer<typeof assignEmployeeRoleSchema>;
