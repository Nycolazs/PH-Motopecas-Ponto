import { z } from 'zod';

export const cultureValueSchema = z
  .object({
    title: z.string().trim().min(2, 'O título do valor deve ter pelo menos 2 caracteres.').max(80),
    description: z
      .string()
      .trim()
      .min(5, 'A descrição do valor deve ter pelo menos 5 caracteres.')
      .max(300),
  })
  .strict();

export type CultureValueDto = z.infer<typeof cultureValueSchema>;

export const culturePayloadSchema = z
  .object({
    mission: z.string().trim().min(10, 'A missão deve ter pelo menos 10 caracteres.').max(1000),
    vision: z.string().trim().min(10, 'A visão deve ter pelo menos 10 caracteres.').max(1000),
    values: z
      .array(cultureValueSchema)
      .min(1, 'Cadastre pelo menos 1 valor institucional.')
      .max(10),
    motto: z.string().trim().max(200).optional().nullable(),
  })
  .strict();

export type CulturePayloadDto = z.infer<typeof culturePayloadSchema>;

export const cultureProfileVersionSchema = z
  .object({
    id: z.string().uuid(),
    cultureProfileId: z.string().uuid(),
    versionNumber: z.number().int().positive(),
    mission: z.string(),
    vision: z.string(),
    values: z.array(cultureValueSchema),
    motto: z.string().nullable().optional(),
    generatedDocumentId: z.string().uuid().nullable().optional(),
    publishedAt: z.string().datetime({ offset: true }),
    createdById: z.string().uuid(),
    createdAt: z.string().datetime({ offset: true }),
  })
  .strict();

export type CultureProfileVersionDto = z.infer<typeof cultureProfileVersionSchema>;

export const cultureProfileSchema = z
  .object({
    id: z.string().uuid(),
    companyId: z.string().uuid(),
    currentVersion: cultureProfileVersionSchema.nullable().optional(),
    versions: z.array(cultureProfileVersionSchema).default([]),
    createdAt: z.string().datetime({ offset: true }),
    updatedAt: z.string().datetime({ offset: true }),
  })
  .strict();

export type CultureProfileDto = z.infer<typeof cultureProfileSchema>;
