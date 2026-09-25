import { z } from 'zod';

import { uuidSchema } from '../contracts.js';

export const roleMapPayloadSchema = z.object({
  jobRoleId: uuidSchema,
  roleTitle: z.string().min(2, 'Título do cargo é obrigatório.'),
  department: z.string().nullable().optional(),
  cbo: z.string().nullable().optional(),
  mission: z.string().min(10, 'A missão/objetivo do cargo deve ter pelo menos 10 caracteres.'),
  responsibilities: z
    .array(z.string().min(3))
    .min(1, 'Cadastre pelo menos uma atribuição/responsabilidade.'),
  requirements: z
    .array(z.string().min(3))
    .min(1, 'Cadastre pelo menos um requisito para a função.'),
  behavioralCompetencies: z.array(z.string().min(2)).default([]),
  effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data de vigência inválida (AAAA-MM-DD).'),
});
export type RoleMapPayloadDto = z.infer<typeof roleMapPayloadSchema>;
