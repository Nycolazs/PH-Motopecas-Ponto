import type { DailyAttendanceSummary } from '@ph-ponto/shared';

import type { Prisma } from '../generated/prisma/client.js';

export const ATTENDANCE_SUMMARY_RESOLVER = Symbol('ATTENDANCE_SUMMARY_RESOLVER');

export interface ResolveDailyAttendanceInput {
  employeeId: string;
  businessDate: string;
  evaluationInstant: Date;
  transaction: Prisma.TransactionClient;
}

export interface AttendanceSummaryResolver {
  resolveDaily(input: ResolveDailyAttendanceInput): Promise<DailyAttendanceSummary>;
}
