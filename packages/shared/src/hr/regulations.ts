import { z } from 'zod';

import { uuidSchema } from '../contracts.js';

export const regulationCompanyInfoSchema = z.object({
  tradeName: z.string().min(1, 'Nome fantasia é obrigatório.'),
  legalName: z.string().min(1, 'Razão social é obrigatória.'),
  cnpj: z.string().min(14, 'CNPJ inválido.'),
  presentation: z
    .string()
    .min(10, 'A apresentação da empresa deve conter pelo menos 10 caracteres.'),
  principles: z.array(z.string()).default([]),
});
export type RegulationCompanyInfoDto = z.infer<typeof regulationCompanyInfoSchema>;

export const regulationWorkScheduleSchema = z.object({
  weeklyHours: z.string().min(1, 'Carga horária semanal é obrigatória.'),
  lunchDurationMinutes: z.number().int().min(15).max(180).default(60),
  toleranceMinutes: z.number().int().min(0).max(30).default(5),
  overtimePolicy: z.string().min(5, 'A política de horas extras é obrigatória.'),
  punchRules: z.string().min(10, 'As regras de registro de ponto são obrigatórias.'),
});
export type RegulationWorkScheduleDto = z.infer<typeof regulationWorkScheduleSchema>;

export const regulationConductEthicsSchema = z.object({
  dressCode: z.string().min(5, 'Diretrizes de apresentação e vestimenta são obrigatórias.'),
  customerServiceEthics: z
    .string()
    .min(5, 'Diretrizes de atendimento ao cliente e ética são obrigatórias.'),
  confidentiality: z.string().min(5, 'Diretrizes de sigilo e confidencialidade são obrigatórias.'),
  prohibitions: z.array(z.string()).min(1, 'Cadastre pelo menos uma proibição expressa.'),
});
export type RegulationConductEthicsDto = z.infer<typeof regulationConductEthicsSchema>;

export const regulationTechnologyPolicySchema = z.object({
  internetUsage: z.string().min(5, 'Diretrizes de uso de internet são obrigatórias.'),
  personalDevicePolicy: z
    .string()
    .min(5, 'Política de celular e aparelhos pessoais é obrigatória.'),
  companyEquipmentCare: z
    .string()
    .min(5, 'Diretrizes de conservação de ferramentas e equipamentos são obrigatórias.'),
  communicationTools: z
    .string()
    .min(5, 'Diretrizes de canais de comunicação interna são obrigatórias.'),
});
export type RegulationTechnologyPolicyDto = z.infer<typeof regulationTechnologyPolicySchema>;

export const regulationDisciplineRulesSchema = z.object({
  warningVerbalRules: z.string().min(5, 'Regras de advertência verbal são obrigatórias.'),
  warningWrittenRules: z.string().min(5, 'Regras de advertência escrita são obrigatórias.'),
  suspensionRules: z.string().min(5, 'Regras de suspensão são obrigatórias.'),
  terminationRules: z.string().min(5, 'Regras de demissão por justa causa são obrigatórias.'),
  progressionNotes: z.string().optional(),
});
export type RegulationDisciplineRulesDto = z.infer<typeof regulationDisciplineRulesSchema>;

export const regulationClauseSchema = z.object({
  title: z.string().min(2, 'O título da cláusula deve ter pelo menos 2 caracteres.'),
  content: z.string().min(5, 'O conteúdo da cláusula deve ter pelo menos 5 caracteres.'),
});
export type RegulationClauseDto = z.infer<typeof regulationClauseSchema>;

export const regulationPayloadSchema = z.object({
  title: z.string().min(3).default('Regimento Interno de Trabalho'),
  effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data de vigência inválida (AAAA-MM-DD).'),
  companyInfo: regulationCompanyInfoSchema,
  workSchedule: regulationWorkScheduleSchema,
  conductEthics: regulationConductEthicsSchema,
  technologyPolicy: regulationTechnologyPolicySchema,
  disciplineRules: regulationDisciplineRulesSchema,
  additionalClauses: z.array(regulationClauseSchema).default([]),
});
export type RegulationPayloadDto = z.infer<typeof regulationPayloadSchema>;

export const companyRegulationVersionSchema = z.object({
  id: uuidSchema,
  companyRegulationId: uuidSchema,
  versionNumber: z.number().int().min(1),
  title: z.string(),
  effectiveDate: z.string(),
  content: z.union([regulationPayloadSchema, z.record(z.string(), z.unknown())]),
  generatedDocumentId: uuidSchema.nullable().optional(),
  publishedAt: z.string(),
  createdById: uuidSchema,
  createdAt: z.string(),
});
export type CompanyRegulationVersionDto = z.infer<typeof companyRegulationVersionSchema>;

export const companyRegulationSchema = z.object({
  id: uuidSchema,
  companyId: uuidSchema,
  currentVersion: companyRegulationVersionSchema.nullable().optional(),
  versions: z.array(companyRegulationVersionSchema),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type CompanyRegulationDto = z.infer<typeof companyRegulationSchema>;
