import { z } from 'zod';

export const authUserSchema = z
  .object({
    id: z.string().uuid(),
    name: z.string().trim().min(1),
    login: z.string().trim().min(1),
    role: z.enum(['ADMIN', 'EMPLOYEE']),
  })
  .strict();

export const managedUserSchema = z
  .object({
    id: z.string().uuid(),
    name: z.string().trim().min(1),
    login: z.string().trim().min(1),
    role: z.enum(['ADMIN', 'EMPLOYEE']),
    isActive: z.boolean(),
    hasAvatar: z.boolean(),
    createdAt: z.string().datetime({ offset: true }),
    updatedAt: z.string().datetime({ offset: true }),
  })
  .strict();

export const paginationSchema = z
  .object({
    page: z.number().int().positive(),
    limit: z.number().int().positive(),
    total: z.number().int().nonnegative(),
    totalPages: z.number().int().nonnegative(),
  })
  .strict();

export const userListSchema = z
  .object({
    items: z.array(managedUserSchema),
    pagination: paginationSchema,
  })
  .strict();

const punchKindSchema = z.enum(['CLOCK_IN', 'CLOCK_OUT']);
const attendanceStatusSchema = z.enum([
  'NORMAL',
  'OVERTIME',
  'MISSING_HOURS',
  'INCOMPLETE',
  'HOLIDAY',
  'DAY_OFF',
  'CLOSED',
  'VACATION',
]);
const workStateSchema = z.enum(['NOT_STARTED', 'WORKING', 'LUNCH', 'OFF_DUTY']);
const expectationSourceSchema = z.enum([
  'WEEKLY_SCHEDULE',
  'HOLIDAY',
  'CLOSED',
  'SPECIAL_HOURS',
  'VACATION',
]);
const calendarStatusSchema = z.enum(['HOLIDAY', 'DAY_OFF', 'CLOSED', 'VACATION']);
const integrityCodeSchema = z.enum([
  'PUNCH_OUTSIDE_BUSINESS_DATE',
  'ADJUSTMENT_SEQUENCE_GAP',
  'ADJUSTMENT_LINEAGE_MISMATCH',
  'ADJUSTMENT_NO_CHANGE',
  'ADJUSTMENT_CROSSES_BUSINESS_DATE',
  'NON_INCREASING_INSTANT',
  'WRONG_FIRST_KIND',
  'REPEATED_KIND',
]);

export const effectivePunchSchema = z
  .object({
    id: z.string().uuid(),
    kind: punchKindSchema,
    originalOccurredAt: z.string().datetime({ offset: true }),
    effectiveOccurredAt: z.string().datetime({ offset: true }),
    appliedAdjustmentCount: z.number().int().nonnegative(),
  })
  .strict();

const chronologySchema = z
  .object({
    punches: z.array(effectivePunchSchema),
    integrityIssues: z.array(
      z
        .object({
          code: integrityCodeSchema,
          punchId: z.string().uuid(),
          adjustmentId: z.string().uuid().optional(),
        })
        .strict(),
    ),
    intervals: z.array(
      z
        .object({
          clockInPunchId: z.string().uuid(),
          clockOutPunchId: z.string().uuid(),
          clockInAt: z.string().datetime({ offset: true }),
          clockOutAt: z.string().datetime({ offset: true }),
          elapsedMilliseconds: z.number().int().positive(),
        })
        .strict(),
    ),
    punchCount: z.number().int().nonnegative(),
    completedIntervalCount: z.number().int().nonnegative(),
    hasOpenInterval: z.boolean(),
    isIncomplete: z.boolean(),
    workedMilliseconds: z.number().int().nonnegative(),
    workedMinutes: z.number().int().nonnegative(),
  })
  .strict();

export const dailyAttendanceSchema = z
  .object({
    businessDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    isFinalized: z.boolean(),
    status: attendanceStatusSchema.nullable(),
    workState: workStateSchema.nullable(),
    expectedMinutes: z.number().int().nonnegative(),
    workedMinutes: z.number().int().nonnegative(),
    balanceMinutes: z.number().int().nullable(),
    punchCount: z.number().int().nonnegative(),
    completedIntervalCount: z.number().int().nonnegative(),
    correctionCount: z.number().int().nonnegative(),
    expectationSource: expectationSourceSchema,
    calendarStatus: calendarStatusSchema.nullable(),
    exceptionName: z.string().nullable(),
    chronology: chronologySchema,
  })
  .strict();

const statusCountsSchema = z
  .object({
    normal: z.number().int().nonnegative(),
    overtime: z.number().int().nonnegative(),
    missingHours: z.number().int().nonnegative(),
    incomplete: z.number().int().nonnegative(),
    holiday: z.number().int().nonnegative(),
    dayOff: z.number().int().nonnegative(),
    closed: z.number().int().nonnegative(),
    vacation: z.number().int().nonnegative().default(0),
  })
  .strict();

const periodTotalsSchema = z
  .object({
    startDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .nullable(),
    endDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .nullable(),
    finalizedDayCount: z.number().int().nonnegative(),
    completeDayCount: z.number().int().nonnegative(),
    incompleteDayCount: z.number().int().nonnegative(),
    provisionalDayCount: z.number().int().nonnegative(),
    expectedMinutes: z.number().int().nonnegative(),
    workedMinutes: z.number().int().nonnegative(),
    balanceMinutes: z.number().int(),
    overtimeMinutes: z.number().int().nonnegative(),
    missingMinutes: z.number().int().nonnegative(),
    knownPartialWorkedMinutes: z.number().int().nonnegative(),
    punchCount: z.number().int().nonnegative(),
    correctionCount: z.number().int().nonnegative(),
    statusCounts: statusCountsSchema,
  })
  .strict();

export const attendancePeriodSchema = z
  .object({ days: z.array(dailyAttendanceSchema), totals: periodTotalsSchema })
  .strict();

export const monthlyAttendanceSchema = z
  .object({
    days: z.array(dailyAttendanceSchema),
    totals: periodTotalsSchema.extend({
      year: z.number().int().min(1).max(9999),
      month: z.number().int().min(1).max(12),
    }),
  })
  .strict();

const timePunchSchema = z
  .object({
    id: z.string().uuid(),
    employeeId: z.string().uuid(),
    occurredAt: z.string().datetime({ offset: true }),
    effectiveOccurredAt: z.string().datetime({ offset: true }),
    kind: punchKindSchema,
    origin: z.enum(['EMPLOYEE', 'ADMIN_INSERTION']),
    createdByAdminId: z.string().uuid().nullable(),
    insertionReason: z.string().nullable(),
    adjustmentSequence: z.number().int().nonnegative(),
    createdAt: z.string().datetime({ offset: true }),
  })
  .strict();

export const timePunchMutationSchema = z
  .object({
    punch: timePunchSchema,
    dailySummary: dailyAttendanceSchema,
    idempotencyKey: z.string().uuid(),
  })
  .strict();

export const adminTimePunchMutationSchema = z
  .object({
    punch: timePunchSchema,
    dailySummary: dailyAttendanceSchema,
    idempotencyKey: z.string().uuid(),
    auditEventId: z.string().uuid().optional(),
  })
  .strict();

// Overview / Dashboard schemas
export const employeeTodayStatusSchema = z
  .object({
    id: z.string().uuid(),
    name: z.string(),
    login: z.string(),
    hasAvatar: z.boolean(),
    status: attendanceStatusSchema.nullable(),
    workState: workStateSchema.nullable(),
    workedMinutes: z.number().int().nonnegative(),
    expectedMinutes: z.number().int().nonnegative(),
    balanceMinutes: z.number().int().nullable(),
    punchCount: z.number().int().nonnegative(),
    completedIntervalCount: z.number().int().nonnegative(),
    correctionCount: z.number().int().nonnegative(),
    lastPunchAt: z.string().datetime({ offset: true }).nullable(),
    lastPunchKind: punchKindSchema.nullable(),
  })
  .strict();

export const recentPunchSchema = z
  .object({
    id: z.string().uuid(),
    employeeId: z.string().uuid(),
    employeeName: z.string(),
    occurredAt: z.string().datetime({ offset: true }),
    effectiveOccurredAt: z.string().datetime({ offset: true }),
    kind: punchKindSchema,
    origin: z.enum(['EMPLOYEE', 'ADMIN_INSERTION']),
    adjustmentSequence: z.number().int().nonnegative(),
  })
  .strict();

export const recentAdjustmentSchema = z
  .object({
    id: z.string().uuid(),
    timePunchId: z.string().uuid(),
    employeeName: z.string(),
    adminName: z.string(),
    previousOccurredAt: z.string().datetime({ offset: true }),
    correctedOccurredAt: z.string().datetime({ offset: true }),
    reason: z.string(),
    createdAt: z.string().datetime({ offset: true }),
  })
  .strict();

export const attendanceOverviewSchema = z
  .object({
    businessDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    totalActiveEmployees: z.number().int().nonnegative(),
    clockedInTodayCount: z.number().int().nonnegative(),
    currentlyWorkingCount: z.number().int().nonnegative(),
    incompleteCount: z.number().int().nonnegative(),
    notClockedInCount: z.number().int().nonnegative(),
    employees: z.array(employeeTodayStatusSchema),
    recentPunches: z.array(recentPunchSchema),
    recentAdjustments: z.array(recentAdjustmentSchema),
  })
  .strict();

export const incompleteAttendanceDayItemSchema = z
  .object({
    employeeId: z.string().uuid(),
    employeeName: z.string(),
    employeeLogin: z.string(),
    hasAvatar: z.boolean(),
    businessDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    month: z.string().regex(/^\d{4}-\d{2}$/),
    punchCount: z.number().int().nonnegative(),
    status: attendanceStatusSchema.nullable(),
    workState: workStateSchema.nullable(),
    workedMinutes: z.number().int().nonnegative(),
    expectedMinutes: z.number().int().nonnegative(),
    punches: z.array(effectivePunchSchema),
    lastPunchAt: z.string().datetime({ offset: true }).nullable(),
    lastPunchKind: punchKindSchema.nullable(),
  })
  .strict();

export const incompleteAttendanceSchema = z
  .object({
    month: z.string().regex(/^\d{4}-\d{2}$/),
    totalIncompleteDays: z.number().int().nonnegative(),
    totalAffectedEmployees: z.number().int().nonnegative(),
    items: z.array(incompleteAttendanceDayItemSchema),
  })
  .strict();

// Schedules schemas
export const scheduleDaySchema = z
  .object({
    weekday: z.enum(['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY']),
    isOpen: z.boolean(),
    openingMinute: z.number().int().nullable(),
    closingMinute: z.number().int().nullable(),
    lunchEnabled: z.boolean(),
    lunchStartMinute: z.number().int().nullable(),
    lunchEndMinute: z.number().int().nullable(),
    expectedMinutes: z.number().int().nonnegative().optional(),
  })
  .strict();

export const scheduleVersionSchema = z
  .object({
    id: z.string().uuid(),
    effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    note: z.string().nullable(),
    createdAt: z.string().datetime({ offset: true }),
    createdBy: z.object({ id: z.string().uuid(), name: z.string(), login: z.string() }).strict(),
    days: z.array(scheduleDaySchema),
  })
  .strict();

export const scheduleListSchema = z
  .object({
    items: z.array(scheduleVersionSchema),
    pagination: paginationSchema,
  })
  .strict();

// Calendar exceptions schemas
export const exceptionRevisionSchema = z
  .object({
    id: z.string().uuid(),
    sequence: z.number().int().positive(),
    operation: z.enum(['UPSERT', 'RETRACT']),
    kind: z.enum(['HOLIDAY', 'CLOSED', 'SPECIAL_HOURS']).nullable(),
    name: z.string().nullable(),
    openingMinute: z.number().int().nullable(),
    closingMinute: z.number().int().nullable(),
    lunchEnabled: z.boolean(),
    lunchStartMinute: z.number().int().nullable(),
    lunchEndMinute: z.number().int().nullable(),
    expectedMinutes: z.number().int().nullable().optional(),
    createdAt: z.string().datetime({ offset: true }),
    createdBy: z.object({ id: z.string().uuid(), name: z.string(), login: z.string() }).strict(),
  })
  .strict();

export const calendarExceptionSchema = z
  .object({
    id: z.string().uuid(),
    businessDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    isActive: z.boolean().optional(),
    latestRevision: exceptionRevisionSchema.optional(),
    revisionCount: z.number().int().optional(),
    revisions: z.array(exceptionRevisionSchema).optional(),
    effectiveRevision: exceptionRevisionSchema.nullable().optional(),
    createdAt: z.string().datetime({ offset: true }),
  })
  .strict();

export const calendarExceptionListSchema = z
  .object({
    items: z.array(calendarExceptionSchema),
    pagination: paginationSchema,
  })
  .strict();

// Audit log schemas
export const auditLogItemSchema = z
  .object({
    id: z.string().uuid(),
    action: z.string(),
    outcome: z.enum(['SUCCESS', 'FAILURE']),
    targetType: z.string(),
    targetId: z.string().nullable(),
    requestId: z.string().nullable(),
    beforeState: z.unknown().nullable(),
    afterState: z.unknown().nullable(),
    metadata: z.unknown().nullable(),
    createdAt: z.string().datetime({ offset: true }),
    actor: z
      .object({
        id: z.string().uuid(),
        name: z.string(),
        login: z.string(),
      })
      .nullable(),
  })
  .strict();

export const auditLogListSchema = z
  .object({
    items: z.array(auditLogItemSchema),
    pagination: paginationSchema,
  })
  .strict();

// Adjustment requests schemas
export const adjustmentRequestStatusSchema = z.enum(['PENDING', 'APPROVED', 'REJECTED']);

export const adjustmentRequestAuthorSchema = z
  .object({
    id: z.string().uuid(),
    name: z.string(),
    login: z.string(),
  })
  .strict();

export const adjustmentRequestSchema = z
  .object({
    id: z.string().uuid(),
    timePunchId: z.string().uuid(),
    employeeId: z.string().uuid(),
    employee: adjustmentRequestAuthorSchema,
    status: adjustmentRequestStatusSchema,
    punchKind: punchKindSchema,
    currentOccurredAt: z.string().datetime({ offset: true }),
    requestedOccurredAt: z.string().datetime({ offset: true }),
    currentSequence: z.number().int().nonnegative(),
    reason: z.string(),
    reviewedById: z.string().uuid().nullable(),
    reviewedBy: adjustmentRequestAuthorSchema.nullable(),
    reviewComment: z.string().nullable(),
    reviewedAt: z.string().datetime({ offset: true }).nullable(),
    timeAdjustmentId: z.string().uuid().nullable(),
    createdAt: z.string().datetime({ offset: true }),
    updatedAt: z.string().datetime({ offset: true }),
  })
  .strict();

export const adjustmentRequestListSchema = z
  .object({
    items: z.array(adjustmentRequestSchema),
    pagination: paginationSchema,
  })
  .strict();

export const pendingCountSchema = z
  .object({
    pendingCount: z.number().int().nonnegative(),
  })
  .strict();

export const reviewAdjustmentResponseSchema = z
  .object({
    request: adjustmentRequestSchema,
    punchMutation: adminTimePunchMutationSchema.optional(),
  })
  .strict();

export const vacationAuthorSchema = z
  .object({
    id: z.string().uuid(),
    name: z.string(),
    login: z.string(),
  })
  .strict();

export const vacationSchema = z
  .object({
    id: z.string().uuid(),
    employeeId: z.string().uuid(),
    employee: vacationAuthorSchema,
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    daysCount: z.number().int().positive(),
    note: z.string().nullable(),
    createdById: z.string().uuid(),
    createdBy: vacationAuthorSchema,
    createdAt: z.string().datetime({ offset: true }),
    updatedAt: z.string().datetime({ offset: true }),
  })
  .strict();

export const vacationListSchema = z
  .object({
    items: z.array(vacationSchema),
    pagination: paginationSchema,
  })
  .strict();

export const createVacationInputSchema = z
  .object({
    employeeId: z.string().uuid(),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    note: z.string().max(255).optional(),
  })
  .strict();

export type AuthUser = z.infer<typeof authUserSchema>;
export type ManagedUser = z.infer<typeof managedUserSchema>;
export type UserList = z.infer<typeof userListSchema>;
export type DailyAttendance = z.infer<typeof dailyAttendanceSchema>;
export type AttendancePeriod = z.infer<typeof attendancePeriodSchema>;
export type MonthlyAttendance = z.infer<typeof monthlyAttendanceSchema>;
export type TimePunchMutation = z.infer<typeof timePunchMutationSchema>;
export type AttendanceOverview = z.infer<typeof attendanceOverviewSchema>;
export type EmployeeTodayStatus = z.infer<typeof employeeTodayStatusSchema>;
export type RecentPunch = z.infer<typeof recentPunchSchema>;
export type RecentAdjustment = z.infer<typeof recentAdjustmentSchema>;
export type ScheduleVersion = z.infer<typeof scheduleVersionSchema>;
export type ScheduleList = z.infer<typeof scheduleListSchema>;
export type CalendarException = z.infer<typeof calendarExceptionSchema>;
export type CalendarExceptionList = z.infer<typeof calendarExceptionListSchema>;
export type AuditLogItem = z.infer<typeof auditLogItemSchema>;
export type AuditLogList = z.infer<typeof auditLogListSchema>;
export type EffectivePunch = z.infer<typeof effectivePunchSchema>;
export type ScheduleDay = z.infer<typeof scheduleDaySchema>;
export type AdjustmentRequestStatus = z.infer<typeof adjustmentRequestStatusSchema>;
export type AdjustmentRequest = z.infer<typeof adjustmentRequestSchema>;
export type AdjustmentRequestList = z.infer<typeof adjustmentRequestListSchema>;
export type ReviewAdjustmentResponse = z.infer<typeof reviewAdjustmentResponseSchema>;
export type Vacation = z.infer<typeof vacationSchema>;
export type VacationList = z.infer<typeof vacationListSchema>;
export type CreateVacationInput = z.infer<typeof createVacationInputSchema>;
export type IncompleteAttendanceDayItem = z.infer<typeof incompleteAttendanceDayItemSchema>;
export type IncompleteAttendance = z.infer<typeof incompleteAttendanceSchema>;

