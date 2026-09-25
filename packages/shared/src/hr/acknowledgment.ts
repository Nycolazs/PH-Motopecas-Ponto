import { z } from 'zod';

export const acknowledgmentTypeSchema = z.enum(['REGULATION', 'ROLE']);
export type AcknowledgmentTypeDto = z.infer<typeof acknowledgmentTypeSchema>;

export const acknowledgmentRegulationPayloadSchema = z.object({
  employeeId: z.string().uuid(),
  employeeName: z.string().min(2),
  employeeCpf: z.string().nullable().optional(),
  regulationVersionId: z.string().uuid(),
  regulationVersionNumber: z.number().int().min(1),
  regulationTitle: z.string().min(2),
  effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});
export type AcknowledgmentRegulationPayloadDto = z.infer<
  typeof acknowledgmentRegulationPayloadSchema
>;

export const acknowledgmentRolePayloadSchema = z.object({
  employeeId: z.string().uuid(),
  employeeName: z.string().min(2),
  employeeCpf: z.string().nullable().optional(),
  jobRoleVersionId: z.string().uuid(),
  roleTitle: z.string().min(2),
  roleVersionNumber: z.number().int().min(1),
  department: z.string().nullable().optional(),
  effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});
export type AcknowledgmentRolePayloadDto = z.infer<typeof acknowledgmentRolePayloadSchema>;

export const employeeDocumentAcknowledgmentSchema = z.object({
  id: z.string().uuid(),
  employeeId: z.string().uuid(),
  employeeName: z.string().nullable().optional(),
  acknowledgmentType: acknowledgmentTypeSchema,
  regulationVersionId: z.string().uuid().nullable().optional(),
  jobRoleVersionId: z.string().uuid().nullable().optional(),
  generatedDocumentId: z.string().uuid(),
  acknowledgedAt: z.string(),
  createdById: z.string().uuid(),
  createdAt: z.string(),
});
export type EmployeeDocumentAcknowledgmentDto = z.infer<
  typeof employeeDocumentAcknowledgmentSchema
>;

export const acknowledgmentStatusSummarySchema = z.object({
  totalActiveEmployees: z.number().int().min(0),
  regulationAcknowledgedCount: z.number().int().min(0),
  roleAcknowledgedCount: z.number().int().min(0),
  isFullyCompliant: z.boolean(),
});
export type AcknowledgmentStatusSummaryDto = z.infer<typeof acknowledgmentStatusSummarySchema>;
