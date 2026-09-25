import { z } from 'zod';
import { employeeRoleAssignmentSchema } from './job-role.js';

export const employeeProfileSchema = z
  .object({
    userId: z.string().uuid(),
    cpf: z.string().nullable().optional(),
    rg: z.string().nullable().optional(),
    birthDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .nullable()
      .optional(),
    phone: z.string().nullable().optional(),
    personalEmail: z.string().email().nullable().optional(),
    addressStreet: z.string().nullable().optional(),
    addressNumber: z.string().nullable().optional(),
    addressComplement: z.string().nullable().optional(),
    addressNeighborhood: z.string().nullable().optional(),
    addressCity: z.string().nullable().optional(),
    addressState: z.string().length(2).nullable().optional(),
    addressPostalCode: z.string().nullable().optional(),
    hireDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .nullable()
      .optional(),
    notes: z.string().nullable().optional(),
    accessEnabled: z.boolean(),
    roleAssignment: employeeRoleAssignmentSchema.nullable().optional(),
    createdAt: z.string().datetime({ offset: true }),
    updatedAt: z.string().datetime({ offset: true }),
  })
  .strict();

export type EmployeeProfileDto = z.infer<typeof employeeProfileSchema>;

export const updateEmployeeProfileSchema = z
  .object({
    cpf: z.string().trim().max(14).optional().nullable(),
    rg: z.string().trim().max(30).optional().nullable(),
    birthDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data de nascimento deve estar no formato AAAA-MM-DD.')
      .optional()
      .nullable(),
    phone: z.string().trim().max(30).optional().nullable(),
    personalEmail: z
      .string()
      .trim()
      .email('E-mail pessoal inválido.')
      .optional()
      .nullable()
      .or(z.literal('')),
    addressStreet: z.string().trim().max(200).optional().nullable(),
    addressNumber: z.string().trim().max(30).optional().nullable(),
    addressComplement: z.string().trim().max(100).optional().nullable(),
    addressNeighborhood: z.string().trim().max(100).optional().nullable(),
    addressCity: z.string().trim().max(100).optional().nullable(),
    addressState: z.string().trim().max(2).optional().nullable(),
    addressPostalCode: z.string().trim().max(10).optional().nullable(),
    hireDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data de admissão deve estar no formato AAAA-MM-DD.')
      .optional()
      .nullable(),
    notes: z.string().trim().max(2000).optional().nullable(),
  })
  .strict();

export type UpdateEmployeeProfileDto = z.infer<typeof updateEmployeeProfileSchema>;

export const toggleEmployeeAccessSchema = z
  .object({
    accessEnabled: z.boolean(),
  })
  .strict();

export type ToggleEmployeeAccessDto = z.infer<typeof toggleEmployeeAccessSchema>;
