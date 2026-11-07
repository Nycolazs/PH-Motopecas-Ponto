import { z } from 'zod';

const weekdaySchema = z.enum([
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
  'SUNDAY',
]);
export type ScheduleWeekday = z.infer<typeof weekdaySchema>;

export const scheduleCellStatusSchema = z
  .enum([
    'WORK',
    'REST',
    'HOLIDAY',
    'CLOSED',
    'VACATION',
    'ALLOWANCE',
    'MEDICAL_LEAVE',
    'NOT_HIRED',
  ])
  .catch('REST');
export type ScheduleCellStatus = z.infer<typeof scheduleCellStatusSchema>;

export const scheduleCellSchema = z.object({
  businessDate: z.string(),
  weekday: weekdaySchema,
  status: scheduleCellStatusSchema,
  startMinute: z.number().nullable(),
  endMinute: z.number().nullable(),
  breakStartMinute: z.number().nullable(),
  breakEndMinute: z.number().nullable(),
  plannedMinutes: z.number(),
  source: z.string(),
  label: z.string().nullable(),
  overrideId: z.string().nullable(),
  overrideReason: z.enum(['SWAP', 'ADJUSTMENT']).nullable(),
});
export type ScheduleCell = z.infer<typeof scheduleCellSchema>;

export const weekTotalSchema = z.object({
  weekStart: z.string(),
  plannedMinutes: z.number(),
  restDays: z.number(),
  weeklyLimitMinutes: z.number(),
  regimeLabel: z.string(),
});
export type WeekTotal = z.infer<typeof weekTotalSchema>;

export const complianceIssueSchema = z.object({
  code: z.string(),
  severity: z.enum(['ERROR', 'WARNING']).catch('WARNING'),
  businessDate: z.string(),
  message: z.string(),
});
export type ComplianceIssue = z.infer<typeof complianceIssueSchema>;

export const workRegimeSettingsSchema = z.object({
  hasCollectiveAgreement: z.boolean().nullable(),
  sundayRestEveryWeeks: z.number(),
  minimumStaff: z.number(),
});
export type WorkRegimeSettings = z.infer<typeof workRegimeSettingsSchema>;

export const teamScheduleSchema = z.object({
  from: z.string(),
  to: z.string(),
  settings: workRegimeSettingsSchema,
  regimeToday: z.string(),
  employees: z.array(
    z.object({
      employeeId: z.string(),
      name: z.string(),
      login: z.string(),
      hasAvatar: z.boolean(),
      hasOwnSchedule: z.boolean(),
      ownScheduleFrom: z.string().nullable().catch(null),
      days: z.array(scheduleCellSchema),
      weeks: z.array(weekTotalSchema),
      issues: z.array(complianceIssueSchema),
    }),
  ),
  coverage: z.array(
    z.object({
      businessDate: z.string(),
      working: z.number(),
      storeOpen: z.boolean(),
      belowMinimum: z.boolean(),
    }),
  ),
});
export type TeamSchedule = z.infer<typeof teamScheduleSchema>;
export type TeamScheduleRow = TeamSchedule['employees'][number];

const scheduleDaySchema = z.object({
  cycleWeek: z.number(),
  weekday: weekdaySchema,
  isWorkday: z.boolean(),
  startMinute: z.number().nullable(),
  endMinute: z.number().nullable(),
  breakStartMinute: z.number().nullable(),
  breakEndMinute: z.number().nullable(),
});
export type ScheduleDayRow = z.infer<typeof scheduleDaySchema>;

export const employeeScheduleOverviewSchema = z.object({
  employeeId: z.string(),
  name: z.string(),
  hasOwnSchedule: z.boolean(),
  settings: workRegimeSettingsSchema,
  days: z.array(scheduleCellSchema),
  weeks: z.array(weekTotalSchema),
  issues: z.array(complianceIssueSchema),
  currentVersionId: z.string().nullable(),
  versions: z.array(
    z.object({
      id: z.string(),
      effectiveDate: z.string(),
      usesCompanySchedule: z.boolean(),
      cycleWeeks: z.number(),
      cycleAnchorDate: z.string(),
      days: z.array(scheduleDaySchema),
      note: z.string().nullable(),
      createdAt: z.string(),
      createdByName: z.string(),
      isFuture: z.boolean(),
    }),
  ),
  upcomingOverrides: z.array(
    z.object({
      id: z.string(),
      businessDate: z.string(),
      isWorkday: z.boolean(),
      startMinute: z.number().nullable(),
      endMinute: z.number().nullable(),
      breakStartMinute: z.number().nullable(),
      breakEndMinute: z.number().nullable(),
      reason: z.enum(['SWAP', 'ADJUSTMENT']),
      swapId: z.string().nullable(),
      note: z.string(),
      createdAt: z.string(),
      createdByName: z.string(),
    }),
  ),
});
export type EmployeeScheduleOverview = z.infer<typeof employeeScheduleOverviewSchema>;
export type EmployeeScheduleVersionView = EmployeeScheduleOverview['versions'][number];

export const schedulePreviewSchema = z.object({
  effectiveDate: z.string(),
  days: z.array(scheduleCellSchema),
  weeks: z.array(weekTotalSchema),
  issues: z.array(complianceIssueSchema),
});
export type SchedulePreview = z.infer<typeof schedulePreviewSchema>;

export const myScheduleSchema = z.object({
  from: z.string(),
  to: z.string(),
  hasOwnSchedule: z.boolean(),
  days: z.array(scheduleCellSchema),
  weeks: z.array(weekTotalSchema),
  /** First week of an escala published for later; null when nothing changes soon. */
  nextChange: z
    .object({ effectiveDate: z.string(), days: z.array(scheduleCellSchema) })
    .nullable()
    .catch(null),
});
export type MySchedule = z.infer<typeof myScheduleSchema>;

export const scheduleMutationSchema = z.object({}).passthrough();

export interface ShiftInput {
  isWorkday: boolean;
  startMinute?: number | null;
  endMinute?: number | null;
  breakStartMinute?: number | null;
  breakEndMinute?: number | null;
}

export interface ScheduleDraftInput {
  effectiveDate: string;
  usesCompanySchedule?: boolean;
  weeks?: { days: (ShiftInput & { weekday: ScheduleWeekday })[] }[];
  note?: string | null;
  confirmIssues?: boolean;
}
