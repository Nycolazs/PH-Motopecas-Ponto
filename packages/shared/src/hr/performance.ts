import { z } from 'zod';

export const performanceClassificationSchema = z.enum([
  'EXCELLENT',
  'GOOD',
  'REGULAR',
  'NEEDS_IMPROVEMENT',
]);

export type PerformanceClassification = z.infer<typeof performanceClassificationSchema>;

export const PERFORMANCE_CLASSIFICATION_LABELS: Record<
  PerformanceClassification,
  { label: string; description: string; badgeColor: string }
> = {
  EXCELLENT: {
    label: 'Excelente',
    description: 'Supera com frequência os padrões e expectativas estabelecidos.',
    badgeColor: 'emerald',
  },
  GOOD: {
    label: 'Bom',
    description: 'Atende plenamente aos requisitos e expectativas do cargo com consistência.',
    badgeColor: 'blue',
  },
  REGULAR: {
    label: 'Regular',
    description:
      'Atende aos requisitos essenciais, mas requer acompanhamento e pontos de melhoria.',
    badgeColor: 'amber',
  },
  NEEDS_IMPROVEMENT: {
    label: 'Necessita Melhoria',
    description:
      'Desempenho abaixo do padrão mínimo esperado; plano corretivo imediato necessário.',
    badgeColor: 'rose',
  },
};

export const PERFORMANCE_CLASSIFICATION_BADGES: Record<PerformanceClassification, string> = {
  EXCELLENT:
    'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800',
  GOOD: 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800',
  REGULAR:
    'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800',
  NEEDS_IMPROVEMENT:
    'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800',
};

export const PERFORMANCE_CLASSIFICATION_DESCRIPTIONS: Record<PerformanceClassification, string> = {
  EXCELLENT: 'Supera com frequência os padrões e expectativas estabelecidos.',
  GOOD: 'Atende plenamente aos requisitos e expectativas do cargo com consistência.',
  REGULAR: 'Atende aos requisitos essenciais, mas requer acompanhamento e pontos de melhoria.',
  NEEDS_IMPROVEMENT:
    'Desempenho abaixo do padrão mínimo esperado; plano corretivo imediato necessário.',
};

export interface CanonicalCriterion {
  key: string;
  order: number;
  title: string;
  description: string;
}

export const CANONICAL_PERFORMANCE_CRITERIA: readonly CanonicalCriterion[] = [
  {
    key: 'PUNCTUALITY_ATTENDANCE',
    order: 1,
    title: 'Pontualidade e Assiduidade',
    description:
      'Cumprimento rigoroso dos horários de início, término e intervalos, frequência integral e respeito à jornada acordada.',
  },
  {
    key: 'PRODUCTIVITY_AGILITY',
    order: 2,
    title: 'Produtividade e Agilidade',
    description:
      'Volume de entregas, agilidade e eficácia na execução dos serviços operacionais ou administrativos sem retrabalho.',
  },
  {
    key: 'TECHNICAL_KNOWLEDGE',
    order: 3,
    title: 'Conhecimento Técnico e Qualidade',
    description:
      'Domínio técnico de peças, procedimentos mecânicos ou sistemas, com atenção aos detalhes e qualidade no acabamento.',
  },
  {
    key: 'TEAMWORK_COOPERATION',
    order: 4,
    title: 'Trabalho em Equipe e Cooperação',
    description:
      'Colaboração voluntária com os colegas de equipe, disposição para ajudar e contribuição para um ambiente harmonioso.',
  },
  {
    key: 'RESPECT_ETHICS',
    order: 5,
    title: 'Respeito e Conduta Ética',
    description:
      'Postura profissional, respeito à liderança, colegas e clientes, honestidade e integridade no trato com a empresa.',
  },
  {
    key: 'PROACTIVITY_INITIATIVE',
    order: 6,
    title: 'Proatividade e Iniciativa',
    description:
      'Capacidade de antecipar necessidades, solucionar imprevistos com bom senso e sugerir melhorias práticas.',
  },
  {
    key: 'ORGANIZATION_TOOLS',
    order: 7,
    title: 'Organização e Ferramentas',
    description:
      'Zelo e cuidado com ferramental, peças, veículos de clientes, maquinários e preservação da limpeza do posto de trabalho.',
  },
  {
    key: 'WORK_SAFETY',
    order: 8,
    title: 'Segurança do Trabalho',
    description:
      'Uso correto e constante de EPIs, observância das normas de segurança e zelo pela própria integridade e da equipe.',
  },
] as const;

export const performanceCriterionScoreSchema = z
  .object({
    criterionKey: z.string().trim().min(1, 'Identificador do critério obrigatório.'),
    criterionTitle: z.string().trim().min(2, 'Título do critério obrigatório.'),
    score: z
      .number()
      .int('A nota do critério deve ser um número inteiro.')
      .min(1, 'A nota mínima permitida é 1.')
      .max(5, 'A nota máxima permitida é 5.'),
    feedback: z.string().trim().optional().nullable(),
  })
  .strict();

export type PerformanceCriterionScoreDto = z.infer<typeof performanceCriterionScoreSchema>;

export const performanceReviewPayloadSchema = z
  .object({
    employeeId: z.string().uuid('ID do colaborador deve ser um UUID válido.'),
    employeeName: z.string().trim().min(2, 'Nome do colaborador obrigatório.'),
    employeeCpf: z.string().trim().optional().nullable(),
    employeeRole: z.string().trim().optional().nullable(),
    evaluationPeriod: z
      .string()
      .trim()
      .min(2, 'Período avaliado obrigatório.')
      .max(50, 'Período avaliado não pode ultrapassar 50 caracteres.'),
    evaluationDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data da avaliação deve estar no formato AAAA-MM-DD.'),
    evaluatorId: z.string().uuid('ID do avaliador deve ser um UUID válido.'),
    evaluatorName: z.string().trim().min(2, 'Nome do avaliador obrigatório.'),
    evaluatorRole: z.string().trim().optional().nullable(),
    criteriaScores: z
      .array(performanceCriterionScoreSchema)
      .length(8, 'A avaliação de desempenho deve conter exatamente os 8 critérios canônicos.'),
    strengths: z.string().trim().optional().nullable(),
    improvements: z.string().trim().optional().nullable(),
    actionPlan: z.string().trim().optional().nullable(),
    evaluatorComments: z.string().trim().optional().nullable(),
    employeeComments: z.string().trim().optional().nullable(),
    supersedesReviewId: z.string().uuid().optional().nullable(),
    supersessionReason: z.string().trim().optional().nullable(),
  })
  .strict();

export type PerformanceReviewPayloadDto = z.infer<typeof performanceReviewPayloadSchema>;

export const performanceReviewSchema = z
  .object({
    id: z.string().uuid(),
    companyId: z.string().uuid(),
    employeeId: z.string().uuid(),
    employeeName: z.string().nullable().optional(),
    evaluatorId: z.string().uuid(),
    evaluatorName: z.string().nullable().optional(),
    evaluationPeriod: z.string(),
    evaluationDate: z.string(),
    meanScore: z.number(),
    classification: performanceClassificationSchema,
    scores: z.array(performanceCriterionScoreSchema),
    strengths: z.string().nullable().optional(),
    improvements: z.string().nullable().optional(),
    actionPlan: z.string().nullable().optional(),
    evaluatorComments: z.string().nullable().optional(),
    employeeComments: z.string().nullable().optional(),
    generatedDocumentId: z.string().uuid().nullable().optional(),
    isSuperseded: z.boolean(),
    supersededById: z.string().uuid().nullable().optional(),
    supersededAt: z.string().nullable().optional(),
    supersessionReason: z.string().nullable().optional(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .strict();

export type PerformanceReviewDto = z.infer<typeof performanceReviewSchema>;

export const supersedePerformanceReviewSchema = z
  .object({
    reason: z
      .string()
      .trim()
      .min(5, 'A justificativa de substituição deve ter no mínimo 5 caracteres.')
      .max(500, 'A justificativa não pode ultrapassar 500 caracteres.'),
  })
  .strict();

export type SupersedePerformanceReviewDto = z.infer<typeof supersedePerformanceReviewSchema>;

export const performanceCriteriaItemSchema = z
  .object({
    key: z.string(),
    order: z.number().int(),
    title: z.string(),
    description: z.string(),
  })
  .strict();

export type PerformanceCriteriaItemDto = z.infer<typeof performanceCriteriaItemSchema>;

export const performanceCriteriaResponseSchema = z
  .object({
    id: z.string().uuid(),
    companyId: z.string().uuid(),
    versionNumber: z.number().int(),
    isActive: z.boolean(),
    criteria: z.array(performanceCriteriaItemSchema),
    createdAt: z.string(),
  })
  .strict();

export type PerformanceCriteriaResponseDto = z.infer<typeof performanceCriteriaResponseSchema>;

export const listPerformanceReviewsQuerySchema = z
  .object({
    employeeId: z.string().uuid().optional(),
    period: z.string().optional(),
    includeSuperseded: z.boolean().optional(),
  })
  .strict();

export type ListPerformanceReviewsQueryDto = z.infer<typeof listPerformanceReviewsQuerySchema>;

export interface CalculatedMeanResult {
  meanScore: number;
  classification: PerformanceClassification;
  classificationLabel: string;
  criteriaCount: number;
  totalPoints: number;
}

/**
 * Pure calculation function for Performance Evaluation:
 * - Uses equal weights for all criteria evaluated.
 * - Enforces integer score boundaries (1 to 5).
 * - Computes the mean deterministically rounded to 2 decimal places.
 * - Maps the mean to the standard qualitative performance classification band.
 */
export function calculatePerformanceMean(scores: Array<{ score: number }>): CalculatedMeanResult {
  if (!scores || scores.length === 0) {
    throw new Error('Não é possível calcular a média de uma lista de notas vazia.');
  }

  let totalPoints = 0;
  for (const item of scores) {
    if (!Number.isInteger(item.score) || item.score < 1 || item.score > 5) {
      throw new Error(
        `Nota inválida (${item.score}). As notas devem ser números inteiros entre 1 e 5.`,
      );
    }
    totalPoints += item.score;
  }

  const rawMean = totalPoints / scores.length;
  const meanScore = Math.round(rawMean * 100) / 100;

  let classification: PerformanceClassification;
  if (meanScore >= 4.5) {
    classification = 'EXCELLENT';
  } else if (meanScore >= 3.5) {
    classification = 'GOOD';
  } else if (meanScore >= 2.5) {
    classification = 'REGULAR';
  } else {
    classification = 'NEEDS_IMPROVEMENT';
  }

  return {
    meanScore,
    classification,
    classificationLabel: PERFORMANCE_CLASSIFICATION_LABELS[classification].label,
    criteriaCount: scores.length,
    totalPoints,
  };
}
