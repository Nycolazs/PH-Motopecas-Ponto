import { z } from 'zod';

export const companySchema = z
  .object({
    id: z.string().uuid(),
    legalName: z.string().min(1).max(200),
    tradeName: z.string().min(1).max(200),
    cnpj: z.string().min(14).max(18),
    stateRegistration: z.string().max(30).nullable().optional(),
    email: z.string().email().nullable().optional(),
    phone: z.string().max(30).nullable().optional(),
    addressStreet: z.string().max(200).nullable().optional(),
    addressNumber: z.string().max(30).nullable().optional(),
    addressComplement: z.string().max(100).nullable().optional(),
    addressNeighborhood: z.string().max(100).nullable().optional(),
    addressCity: z.string().max(100).nullable().optional(),
    addressState: z.string().length(2).nullable().optional(),
    addressPostalCode: z.string().max(10).nullable().optional(),
    primaryContactName: z.string().max(120).nullable().optional(),
    createdAt: z.string().datetime({ offset: true }),
    updatedAt: z.string().datetime({ offset: true }),
  })
  .strict();

export type CompanyDto = z.infer<typeof companySchema>;

export const updateCompanySchema = z
  .object({
    legalName: z.string().trim().min(2, 'Razão Social deve ter pelo menos 2 caracteres.').max(200),
    tradeName: z.string().trim().min(2, 'Nome Fantasia deve ter pelo menos 2 caracteres.').max(200),
    cnpj: z.string().trim().min(14, 'CNPJ inválido.').max(18),
    stateRegistration: z.string().trim().max(30).optional().nullable(),
    email: z.string().trim().email('E-mail inválido.').optional().nullable().or(z.literal('')),
    phone: z.string().trim().max(30).optional().nullable(),
    addressStreet: z.string().trim().max(200).optional().nullable(),
    addressNumber: z.string().trim().max(30).optional().nullable(),
    addressComplement: z.string().trim().max(100).optional().nullable(),
    addressNeighborhood: z.string().trim().max(100).optional().nullable(),
    addressCity: z.string().trim().max(100).optional().nullable(),
    addressState: z.string().trim().max(2).optional().nullable(),
    addressPostalCode: z.string().trim().max(10).optional().nullable(),
    primaryContactName: z.string().trim().max(120).optional().nullable(),
  })
  .strict();

export type UpdateCompanyDto = z.infer<typeof updateCompanySchema>;

export const setupItemStatusSchema = z
  .object({
    id: z.string(),
    label: z.string(),
    description: z.string(),
    isCompleted: z.boolean(),
    actionUrl: z.string().optional(),
  })
  .strict();

export type SetupItemStatusDto = z.infer<typeof setupItemStatusSchema>;

export const setupStatusSchema = z
  .object({
    completionPercentage: z.number().min(0).max(100),
    items: z.array(setupItemStatusSchema),
  })
  .strict();

export type SetupStatusDto = z.infer<typeof setupStatusSchema>;
