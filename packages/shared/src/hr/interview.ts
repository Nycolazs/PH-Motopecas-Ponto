import { z } from 'zod';

export const interviewRecommendationSchema = z.enum([
  'RECOMMENDED',
  'NOT_RECOMMENDED',
  'TALENT_POOL',
]);
export type InterviewRecommendationDto = z.infer<typeof interviewRecommendationSchema>;

export const interviewCriterionScoreSchema = z.object({
  criterion: z.string().min(2, 'Critério é obrigatório.'),
  score: z.number().int().min(1).max(5),
  notes: z.string().optional(),
});
export type InterviewCriterionScoreDto = z.infer<typeof interviewCriterionScoreSchema>;

export const interviewPayloadSchema = z.object({
  candidateName: z.string().min(3, 'Nome do candidato é obrigatório.'),
  candidateEmail: z.string().email('E-mail inválido.').nullable().optional(),
  candidatePhone: z.string().nullable().optional(),
  jobRoleId: z.string().uuid().nullable().optional(),
  roleTitle: z.string().min(2, 'Cargo pretendido é obrigatório.'),
  interviewDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data da entrevista inválida (AAAA-MM-DD).'),
  interviewerName: z.string().min(3, 'Nome do entrevistador é obrigatório.'),
  criteriaScores: z
    .array(interviewCriterionScoreSchema)
    .min(1, 'Avalie pelo menos um critério na entrevista.'),
  generalNotes: z.string().optional(),
  recommendation: interviewRecommendationSchema,
});
export type InterviewPayloadDto = z.infer<typeof interviewPayloadSchema>;

export const hiringInterviewSchema = z.object({
  id: z.string().uuid(),
  candidateName: z.string(),
  candidateEmail: z.string().nullable().optional(),
  candidatePhone: z.string().nullable().optional(),
  jobRoleId: z.string().uuid().nullable().optional(),
  roleTitle: z.string(),
  interviewDate: z.string(),
  interviewerName: z.string(),
  evaluatorId: z.string().uuid(),
  recommendation: interviewRecommendationSchema,
  notes: z.string().nullable().optional(),
  scores: z.union([z.array(interviewCriterionScoreSchema), z.record(z.string(), z.unknown())]),
  generatedDocumentId: z.string().uuid().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type HiringInterviewDto = z.infer<typeof hiringInterviewSchema>;
