import { z } from 'zod';
import { uuidSchema } from '../contracts.js';
import { documentTypeSchema } from './documents.js';

export const timelineCategorySchema = z.enum([
  'ALL',
  'EMPLOYMENT',
  'ROLE',
  'DOCUMENT',
  'ACCESS',
  'VACATION',
  'DISCIPLINE',
  'EVALUATION',
]);
export type TimelineCategoryDto = z.infer<typeof timelineCategorySchema>;

export const employeeTimelineItemSchema = z.object({
  id: z.string(),
  category: z.enum([
    'EMPLOYMENT',
    'ROLE',
    'DOCUMENT',
    'ACCESS',
    'VACATION',
    'DISCIPLINE',
    'EVALUATION',
  ]),
  title: z.string(),
  description: z.string().nullable().optional(),
  occurredAt: z.string(),
  businessDate: z.string().nullable().optional(),
  actorName: z.string().nullable().optional(),
  documentId: uuidSchema.nullable().optional(),
  documentType: documentTypeSchema.nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
});
export type EmployeeTimelineItemDto = z.infer<typeof employeeTimelineItemSchema>;

export const paginatedTimelineSchema = z.object({
  items: z.array(employeeTimelineItemSchema),
  total: z.number().int(),
  limit: z.number().int(),
  offset: z.number().int(),
});
export type PaginatedTimelineDto = z.infer<typeof paginatedTimelineSchema>;
