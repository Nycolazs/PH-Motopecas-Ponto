import { z } from 'zod';
import { uuidSchema } from '../contracts.js';
import { documentTypeSchema } from './documents.js';

export const disciplinaryActionTypeSchema = z.enum([
  'VERBAL_WARNING',
  'WRITTEN_WARNING',
  'SUSPENSION',
]);

export type DisciplinaryActionType = z.infer<typeof disciplinaryActionTypeSchema>;

export const disciplinaryProgressionStageSchema = z.enum([
  'NONE',
  'VERBAL_WARNING',
  'WRITTEN_WARNING',
  'SUSPENSION',
  'DISMISSAL_REVIEW',
]);

export type DisciplinaryProgressionStage = z.infer<typeof disciplinaryProgressionStageSchema>;

export const disciplinaryWitnessSchema = z
  .object({
    name: z.string().trim().min(2, 'Nome da testemunha deve ter pelo menos 2 caracteres.'),
    cpf: z.string().trim().optional().nullable(),
  })
  .strict();

export type DisciplinaryWitnessDto = z.infer<typeof disciplinaryWitnessSchema>;

export const disciplineVerbalPayloadSchema = z
  .object({
    employeeId: uuidSchema,
    employeeName: z.string().trim().min(2, 'Nome do colaborador obrigatório.'),
    employeeCpf: z.string().trim().optional().nullable(),
    employeeRole: z.string().trim().optional().nullable(),
    incidentDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data do ocorrido deve estar no formato AAAA-MM-DD.'),
    location: z.string().trim().optional().nullable(),
    reason: z
      .string()
      .trim()
      .min(3, 'O motivo deve ter pelo menos 3 caracteres.')
      .max(200, 'O motivo não pode exceder 200 caracteres.'),
    details: z
      .string()
      .trim()
      .min(10, 'A descrição dos fatos e orientações deve ter pelo menos 10 caracteres.')
      .max(5000),
    internalClauseRef: z.string().trim().max(200).optional().nullable(),
    priorActionId: uuidSchema.optional().nullable(),
    commitment: z.string().trim().max(2000).optional().nullable(),
    witnesses: z.array(disciplinaryWitnessSchema).optional().default([]),
  })
  .strict();

export type DisciplineVerbalPayloadDto = z.infer<typeof disciplineVerbalPayloadSchema>;

export const disciplineWrittenPayloadSchema = z
  .object({
    employeeId: uuidSchema,
    employeeName: z.string().trim().min(2, 'Nome do colaborador obrigatório.'),
    employeeCpf: z.string().trim().optional().nullable(),
    employeeRole: z.string().trim().optional().nullable(),
    incidentDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data do ocorrido deve estar no formato AAAA-MM-DD.'),
    location: z.string().trim().optional().nullable(),
    reason: z
      .string()
      .trim()
      .min(3, 'O motivo deve ter pelo menos 3 caracteres.')
      .max(200, 'O motivo não pode exceder 200 caracteres.'),
    details: z
      .string()
      .trim()
      .min(10, 'A descrição dos fatos e penalidade deve ter pelo menos 10 caracteres.')
      .max(5000),
    internalClauseRef: z.string().trim().max(200).optional().nullable(),
    legalBasisRef: z.string().trim().max(200).optional().nullable(),
    priorActionId: uuidSchema.optional().nullable(),
    consequencesNote: z.string().trim().max(2000).optional().nullable(),
    witnesses: z.array(disciplinaryWitnessSchema).optional().default([]),
  })
  .strict();

export type DisciplineWrittenPayloadDto = z.infer<typeof disciplineWrittenPayloadSchema>;

export const disciplineSuspensionPayloadSchema = z
  .object({
    employeeId: uuidSchema,
    employeeName: z.string().trim().min(2, 'Nome do colaborador obrigatório.'),
    employeeCpf: z.string().trim().optional().nullable(),
    employeeRole: z.string().trim().optional().nullable(),
    incidentDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data do ocorrido deve estar no formato AAAA-MM-DD.'),
    location: z.string().trim().optional().nullable(),
    suspensionDays: z
      .number()
      .int('Dias de suspensão devem ser um número inteiro.')
      .min(1, 'A suspensão deve ter no mínimo 1 dia.')
      .max(30, 'A suspensão disciplinar não pode exceder 30 dias (Art. 474 da CLT).'),
    suspensionStartDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inicial deve estar no formato AAAA-MM-DD.'),
    suspensionEndDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data final deve estar no formato AAAA-MM-DD.'),
    returnDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data de retorno deve estar no formato AAAA-MM-DD.'),
    reason: z
      .string()
      .trim()
      .min(3, 'O motivo deve ter pelo menos 3 caracteres.')
      .max(200, 'O motivo não pode exceder 200 caracteres.'),
    details: z
      .string()
      .trim()
      .min(10, 'A descrição detalhada da suspensão deve ter pelo menos 10 caracteres.')
      .max(5000),
    internalClauseRef: z.string().trim().max(200).optional().nullable(),
    legalBasisRef: z.string().trim().max(200).optional().nullable(),
    priorActionId: uuidSchema.optional().nullable(),
    consequencesNote: z.string().trim().max(2000).optional().nullable(),
    witnesses: z.array(disciplinaryWitnessSchema).optional().default([]),
  })
  .strict();

export type DisciplineSuspensionPayloadDto = z.infer<typeof disciplineSuspensionPayloadSchema>;

export const disciplinaryActionSchema = z
  .object({
    id: uuidSchema,
    companyId: uuidSchema,
    employeeId: uuidSchema,
    employeeName: z.string().nullable().optional(),
    issuerId: uuidSchema,
    issuerName: z.string().nullable().optional(),
    actionType: disciplinaryActionTypeSchema,
    documentType: documentTypeSchema,
    incidentDate: z.string(),
    reason: z.string(),
    details: z.string(),
    internalClauseRef: z.string().nullable().optional(),
    suspensionDays: z.number().int().nullable().optional(),
    suspensionStartDate: z.string().nullable().optional(),
    suspensionEndDate: z.string().nullable().optional(),
    priorActionId: uuidSchema.nullable().optional(),
    priorActionSummary: z.string().nullable().optional(),
    generatedDocumentId: uuidSchema.nullable().optional(),
    isVoid: z.boolean(),
    voidReason: z.string().nullable().optional(),
    voidedById: uuidSchema.nullable().optional(),
    voidedAt: z.string().nullable().optional(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .strict();

export type DisciplinaryActionDto = z.infer<typeof disciplinaryActionSchema>;

export const disciplinaryProgressionSummarySchema = z
  .object({
    employeeId: uuidSchema,
    employeeName: z.string().nullable().optional(),
    verbalCount: z.number().int().nonnegative(),
    writtenCount: z.number().int().nonnegative(),
    suspensionCount: z.number().int().nonnegative(),
    totalSuspensionDays: z.number().int().nonnegative(),
    voidedCount: z.number().int().nonnegative(),
    currentStage: disciplinaryProgressionStageSchema,
    lastActionDate: z.string().nullable().optional(),
    lastActionType: disciplinaryActionTypeSchema.nullable().optional(),
    nextSuggestedStage: disciplinaryProgressionStageSchema,
  })
  .strict();

export type DisciplinaryProgressionSummaryDto = z.infer<
  typeof disciplinaryProgressionSummarySchema
>;

export const voidDisciplinaryActionSchema = z
  .object({
    reason: z
      .string()
      .trim()
      .min(5, 'A justificativa de anulação deve ter pelo menos 5 caracteres.')
      .max(255, 'A justificativa não pode exceder 255 caracteres.'),
  })
  .strict();

export type VoidDisciplinaryActionDto = z.infer<typeof voidDisciplinaryActionSchema>;

export interface ActionForProgression {
  actionType: DisciplinaryActionType;
  isVoid: boolean;
  incidentDate: string;
  suspensionDays?: number | null;
}

export function calculateDisciplinaryProgression(
  employeeId: string,
  employeeName: string | null | undefined,
  actions: ActionForProgression[],
): DisciplinaryProgressionSummaryDto {
  let verbalCount = 0;
  let writtenCount = 0;
  let suspensionCount = 0;
  let totalSuspensionDays = 0;
  let voidedCount = 0;

  const activeActions: ActionForProgression[] = [];

  for (const act of actions) {
    if (act.isVoid) {
      voidedCount += 1;
      continue;
    }

    activeActions.push(act);

    if (act.actionType === 'VERBAL_WARNING') {
      verbalCount += 1;
    } else if (act.actionType === 'WRITTEN_WARNING') {
      writtenCount += 1;
    } else if (act.actionType === 'SUSPENSION') {
      suspensionCount += 1;
      if (act.suspensionDays && act.suspensionDays > 0) {
        totalSuspensionDays += act.suspensionDays;
      }
    }
  }

  // Sort active actions by incidentDate descending to identify the latest
  activeActions.sort((a, b) => b.incidentDate.localeCompare(a.incidentDate));

  const latestActive = activeActions.length > 0 ? activeActions[0] : null;

  let currentStage: DisciplinaryProgressionStage = 'NONE';
  if (suspensionCount > 0) {
    currentStage = 'SUSPENSION';
  } else if (writtenCount > 0) {
    currentStage = 'WRITTEN_WARNING';
  } else if (verbalCount > 0) {
    currentStage = 'VERBAL_WARNING';
  }

  let nextSuggestedStage: DisciplinaryProgressionStage = 'VERBAL_WARNING';
  if (currentStage === 'NONE') {
    nextSuggestedStage = 'VERBAL_WARNING';
  } else if (currentStage === 'VERBAL_WARNING') {
    nextSuggestedStage = 'WRITTEN_WARNING';
  } else if (currentStage === 'WRITTEN_WARNING') {
    nextSuggestedStage = 'SUSPENSION';
  } else if (currentStage === 'SUSPENSION') {
    nextSuggestedStage = 'DISMISSAL_REVIEW';
  }

  return {
    employeeId,
    employeeName: employeeName ?? null,
    verbalCount,
    writtenCount,
    suspensionCount,
    totalSuspensionDays,
    voidedCount,
    currentStage,
    lastActionDate: latestActive?.incidentDate ?? null,
    lastActionType: latestActive?.actionType ?? null,
    nextSuggestedStage,
  };
}
