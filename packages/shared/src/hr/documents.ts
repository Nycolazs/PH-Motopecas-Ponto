import { z } from 'zod';

import { uuidSchema } from '../contracts.js';

export const documentTypeSchema = z.enum([
  'CULTURE',
  'REGULATION',
  'ROLE_MAP',
  'INTERVIEW',
  'ACKNOWLEDGMENT_REGULATION',
  'ACKNOWLEDGMENT_ROLE',
  'DISCIPLINE_VERBAL',
  'DISCIPLINE_WRITTEN',
  'DISCIPLINE_SUSPENSION',
  'PERFORMANCE_REVIEW',
]);

export type DocumentTypeDto = z.infer<typeof documentTypeSchema>;

export const renderJobStatusSchema = z.enum(['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED']);

export type RenderJobStatusDto = z.infer<typeof renderJobStatusSchema>;

export const documentDraftSchema = z
  .object({
    id: uuidSchema,
    documentType: documentTypeSchema,
    authorId: uuidSchema,
    employeeId: uuidSchema.nullable().optional(),
    revision: z.number().int().positive(),
    title: z.string().min(1).max(200),
    payload: z.record(z.string(), z.unknown()),
    preparedArtifactId: uuidSchema.nullable().optional(),
    createdAt: z.string().datetime({ offset: true }),
    updatedAt: z.string().datetime({ offset: true }),
  })
  .strict();

export type DocumentDraftDto = z.infer<typeof documentDraftSchema>;

export const saveDocumentDraftSchema = z
  .object({
    documentType: documentTypeSchema,
    employeeId: uuidSchema.optional().nullable(),
    title: z.string().trim().min(2, 'O título deve ter pelo menos 2 caracteres.').max(200),
    expectedRevision: z.number().int().positive().optional(),
    payload: z.record(z.string(), z.unknown()),
  })
  .strict();

export type SaveDocumentDraftDto = z.infer<typeof saveDocumentDraftSchema>;

export const prepareDocumentDraftSchema = z
  .object({
    expectedRevision: z.number().int().positive(),
  })
  .strict();

export type PrepareDocumentDraftDto = z.infer<typeof prepareDocumentDraftSchema>;

export const confirmDocumentDraftSchema = z
  .object({
    expectedRevision: z.number().int().positive(),
    preparedArtifactId: uuidSchema,
  })
  .strict();

export type ConfirmDocumentDraftDto = z.infer<typeof confirmDocumentDraftSchema>;

export const renderJobSchema = z
  .object({
    id: uuidSchema,
    draftId: uuidSchema.nullable().optional(),
    documentType: documentTypeSchema,
    status: renderJobStatusSchema,
    artifactId: uuidSchema.nullable().optional(),
    error: z.string().nullable().optional(),
    attempts: z.number().int().nonnegative(),
    createdAt: z.string().datetime({ offset: true }),
    updatedAt: z.string().datetime({ offset: true }),
  })
  .strict();

export type RenderJobDto = z.infer<typeof renderJobSchema>;

export const generatedDocumentSchema = z
  .object({
    id: uuidSchema,
    documentType: documentTypeSchema,
    title: z.string().min(1).max(200),
    companyId: uuidSchema,
    employeeId: uuidSchema.nullable().optional(),
    employeeName: z.string().nullable().optional(),
    authorId: uuidSchema,
    authorName: z.string().nullable().optional(),
    artifactId: uuidSchema,
    fileSize: z.number().int().nonnegative().nullable().optional(),
    version: z.number().int().positive(),
    supersededById: uuidSchema.nullable().optional(),
    isVoid: z.boolean(),
    voidReason: z.string().nullable().optional(),
    voidedAt: z.string().datetime({ offset: true }).nullable().optional(),
    createdAt: z.string().datetime({ offset: true }),
  })
  .strict();

export type GeneratedDocumentDto = z.infer<typeof generatedDocumentSchema>;

export const voidDocumentSchema = z
  .object({
    reason: z
      .string()
      .trim()
      .min(3, 'A justificativa de anulação deve ter pelo menos 3 caracteres.')
      .max(255),
  })
  .strict();

export type VoidDocumentDto = z.infer<typeof voidDocumentSchema>;

export const listDocumentsQuerySchema = z
  .object({
    page: z.number().int().positive().optional(),
    limit: z.number().int().positive().optional(),
    documentType: documentTypeSchema.optional(),
    employeeId: uuidSchema.optional(),
    search: z.string().optional(),
    isVoid: z.boolean().optional(),
  })
  .strict();

export type ListDocumentsQueryDto = z.infer<typeof listDocumentsQuerySchema>;

export const documentListSchema = z
  .object({
    items: z.array(generatedDocumentSchema),
    pagination: z.object({
      page: z.number().int().positive(),
      limit: z.number().int().positive(),
      total: z.number().int().nonnegative(),
      totalPages: z.number().int().nonnegative(),
    }),
  })
  .strict();

export type DocumentListDto = z.infer<typeof documentListSchema>;
