import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ATTENDANCE_INTEGRITY_CODES,
  ATTENDANCE_PUNCH_KINDS,
  ATTENDANCE_STATUSES,
  CALENDAR_STATUSES,
  EXPECTATION_SOURCES,
  PROVISIONAL_WORK_STATES,
  type AttendancePeriodSummary,
  type AttendanceIntegrityIssue,
  type AttendancePunchKind,
  type DailyAttendanceSummary,
  type EffectivePunch,
  type MonthlyAttendanceSummary,
  type PunchChronology,
  type WorkedInterval,
} from '@ph-ponto/shared';

export interface PublicPunchChronology extends Omit<PunchChronology, 'integrityIssues'> {
  integrityIssues: Omit<AttendanceIntegrityIssue, 'message'>[];
}

export class EffectiveAttendancePunchViewDto implements EffectivePunch {
  @ApiProperty({ format: 'uuid' })
  public id!: string;

  @ApiProperty({ enum: ATTENDANCE_PUNCH_KINDS })
  public kind!: AttendancePunchKind;

  @ApiProperty({ format: 'date-time' })
  public originalOccurredAt!: string;

  @ApiProperty({ format: 'date-time' })
  public effectiveOccurredAt!: string;

  @ApiProperty({ minimum: 0 })
  public appliedAdjustmentCount!: number;
}

export class AttendanceIntegrityIssueViewDto {
  @ApiProperty({ enum: ATTENDANCE_INTEGRITY_CODES })
  public code!: AttendanceIntegrityIssue['code'];

  @ApiProperty({ format: 'uuid' })
  public punchId!: string;

  @ApiPropertyOptional({ format: 'uuid' })
  public adjustmentId?: string;
}

export class WorkedIntervalViewDto implements WorkedInterval {
  @ApiProperty({ format: 'uuid' })
  public clockInPunchId!: string;

  @ApiProperty({ format: 'uuid' })
  public clockOutPunchId!: string;

  @ApiProperty({ format: 'date-time' })
  public clockInAt!: string;

  @ApiProperty({ format: 'date-time' })
  public clockOutAt!: string;

  @ApiProperty({ minimum: 1 })
  public elapsedMilliseconds!: number;
}

export class PunchChronologyViewDto {
  @ApiProperty({ type: [EffectiveAttendancePunchViewDto] })
  public punches!: EffectivePunch[];

  @ApiProperty({ type: [AttendanceIntegrityIssueViewDto] })
  public integrityIssues!: Omit<AttendanceIntegrityIssue, 'message'>[];

  @ApiProperty({ type: [WorkedIntervalViewDto] })
  public intervals!: WorkedInterval[];

  @ApiProperty({ minimum: 0 })
  public punchCount!: number;

  @ApiProperty({ minimum: 0 })
  public completedIntervalCount!: number;

  @ApiProperty()
  public hasOpenInterval!: boolean;

  @ApiProperty()
  public isIncomplete!: boolean;

  @ApiProperty({ minimum: 0 })
  public workedMilliseconds!: number;

  @ApiProperty({ minimum: 0 })
  public workedMinutes!: number;
}

export class DailyAttendanceViewDto {
  @ApiProperty({ example: '2026-08-14' })
  public businessDate!: string;

  @ApiProperty()
  public isFinalized!: boolean;

  @ApiPropertyOptional({ enum: ATTENDANCE_STATUSES, nullable: true })
  public status!: DailyAttendanceSummary['status'];

  @ApiPropertyOptional({ enum: PROVISIONAL_WORK_STATES, nullable: true })
  public workState!: DailyAttendanceSummary['workState'];

  @ApiProperty({ minimum: 0 })
  public expectedMinutes!: number;

  @ApiProperty({ minimum: 0 })
  public workedMinutes!: number;

  @ApiPropertyOptional({ nullable: true })
  public balanceMinutes!: number | null;

  @ApiProperty({ minimum: 0 })
  public punchCount!: number;

  @ApiProperty({ minimum: 0 })
  public completedIntervalCount!: number;

  @ApiProperty({ minimum: 0 })
  public correctionCount!: number;

  @ApiProperty({ enum: EXPECTATION_SOURCES })
  public expectationSource!: DailyAttendanceSummary['expectation']['source'];

  @ApiPropertyOptional({ enum: CALENDAR_STATUSES, nullable: true })
  public calendarStatus!: DailyAttendanceSummary['expectation']['calendarStatus'];

  @ApiPropertyOptional({ nullable: true })
  public exceptionName!: string | null;

  @ApiProperty({ type: PunchChronologyViewDto })
  public chronology!: PublicPunchChronology;
}

export class AttendanceStatusCountsViewDto {
  @ApiProperty({ minimum: 0 })
  public normal!: number;

  @ApiProperty({ minimum: 0 })
  public overtime!: number;

  @ApiProperty({ minimum: 0 })
  public missingHours!: number;

  @ApiProperty({ minimum: 0 })
  public incomplete!: number;

  @ApiProperty({ minimum: 0 })
  public holiday!: number;

  @ApiProperty({ minimum: 0 })
  public dayOff!: number;

  @ApiProperty({ minimum: 0 })
  public closed!: number;
}

export class AttendancePeriodTotalsViewDto implements AttendancePeriodSummary {
  @ApiPropertyOptional({ nullable: true, example: '2026-08-01' })
  public startDate!: string | null;

  @ApiPropertyOptional({ nullable: true, example: '2026-08-31' })
  public endDate!: string | null;

  @ApiProperty({ minimum: 0 })
  public finalizedDayCount!: number;

  @ApiProperty({ minimum: 0 })
  public completeDayCount!: number;

  @ApiProperty({ minimum: 0 })
  public incompleteDayCount!: number;

  @ApiProperty({ minimum: 0 })
  public provisionalDayCount!: number;

  @ApiProperty({ minimum: 0 })
  public expectedMinutes!: number;

  @ApiProperty({ minimum: 0 })
  public workedMinutes!: number;

  @ApiProperty()
  public balanceMinutes!: number;

  @ApiProperty({ minimum: 0 })
  public overtimeMinutes!: number;

  @ApiProperty({ minimum: 0 })
  public missingMinutes!: number;

  @ApiProperty({ minimum: 0 })
  public knownPartialWorkedMinutes!: number;

  @ApiProperty({ minimum: 0 })
  public punchCount!: number;

  @ApiProperty({ minimum: 0 })
  public correctionCount!: number;

  @ApiProperty({ type: AttendanceStatusCountsViewDto })
  public statusCounts!: AttendancePeriodSummary['statusCounts'];
}

export class MonthlyAttendanceTotalsViewDto
  extends AttendancePeriodTotalsViewDto
  implements MonthlyAttendanceSummary
{
  @ApiProperty({ minimum: 1, maximum: 9999 })
  public year!: number;

  @ApiProperty({ minimum: 1, maximum: 12 })
  public month!: number;
}

export class AttendancePeriodViewDto {
  @ApiProperty({ type: [DailyAttendanceViewDto] })
  public days!: DailyAttendanceViewDto[];

  @ApiProperty({ type: AttendancePeriodTotalsViewDto })
  public totals!: AttendancePeriodSummary;
}

export class MonthlyAttendanceViewDto {
  @ApiProperty({ type: [DailyAttendanceViewDto] })
  public days!: DailyAttendanceViewDto[];

  @ApiProperty({ type: MonthlyAttendanceTotalsViewDto })
  public totals!: MonthlyAttendanceSummary;
}

export class EmployeeTodayStatusViewDto {
  @ApiProperty({ format: 'uuid' })
  public id!: string;

  @ApiProperty({ example: 'João da Silva' })
  public name!: string;

  @ApiProperty({ example: 'joao.silva' })
  public login!: string;

  @ApiProperty()
  public hasAvatar!: boolean;

  @ApiPropertyOptional({ enum: ATTENDANCE_STATUSES, nullable: true })
  public status!: DailyAttendanceSummary['status'];

  @ApiPropertyOptional({ enum: PROVISIONAL_WORK_STATES, nullable: true })
  public workState!: DailyAttendanceSummary['workState'];

  @ApiProperty({ minimum: 0 })
  public workedMinutes!: number;

  @ApiProperty({ minimum: 0 })
  public expectedMinutes!: number;

  @ApiPropertyOptional({ nullable: true })
  public balanceMinutes!: number | null;

  @ApiProperty({ minimum: 0 })
  public punchCount!: number;

  @ApiProperty({ minimum: 0 })
  public completedIntervalCount!: number;

  @ApiProperty({ minimum: 0 })
  public correctionCount!: number;

  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  public lastPunchAt!: string | null;

  @ApiPropertyOptional({ enum: ATTENDANCE_PUNCH_KINDS, nullable: true })
  public lastPunchKind!: AttendancePunchKind | null;
}

export class RecentPunchViewDto {
  @ApiProperty({ format: 'uuid' })
  public id!: string;

  @ApiProperty({ format: 'uuid' })
  public employeeId!: string;

  @ApiProperty({ example: 'João da Silva' })
  public employeeName!: string;

  @ApiProperty({ format: 'date-time' })
  public occurredAt!: string;

  @ApiProperty({ format: 'date-time' })
  public effectiveOccurredAt!: string;

  @ApiProperty({ enum: ATTENDANCE_PUNCH_KINDS })
  public kind!: AttendancePunchKind;

  @ApiProperty({ enum: ['EMPLOYEE', 'ADMIN_INSERTION'] })
  public origin!: 'EMPLOYEE' | 'ADMIN_INSERTION';

  @ApiProperty({ minimum: 0 })
  public adjustmentSequence!: number;
}

export class RecentAdjustmentViewDto {
  @ApiProperty({ format: 'uuid' })
  public id!: string;

  @ApiProperty({ format: 'uuid' })
  public timePunchId!: string;

  @ApiProperty({ example: 'João da Silva' })
  public employeeName!: string;

  @ApiProperty({ example: 'Administrador' })
  public adminName!: string;

  @ApiProperty({ format: 'date-time' })
  public previousOccurredAt!: string;

  @ApiProperty({ format: 'date-time' })
  public correctedOccurredAt!: string;

  @ApiProperty({ example: 'Esqueceu de bater saída para almoço' })
  public reason!: string;

  @ApiProperty({ format: 'date-time' })
  public createdAt!: string;
}

export class AttendanceOverviewViewDto {
  @ApiProperty({ example: '2026-08-14' })
  public businessDate!: string;

  @ApiProperty({ minimum: 0 })
  public totalActiveEmployees!: number;

  @ApiProperty({ minimum: 0 })
  public clockedInTodayCount!: number;

  @ApiProperty({ minimum: 0 })
  public currentlyWorkingCount!: number;

  @ApiProperty({ minimum: 0 })
  public incompleteCount!: number;

  @ApiProperty({ minimum: 0 })
  public notClockedInCount!: number;

  @ApiProperty({ type: [EmployeeTodayStatusViewDto] })
  public employees!: EmployeeTodayStatusViewDto[];

  @ApiProperty({ type: [RecentPunchViewDto] })
  public recentPunches!: RecentPunchViewDto[];

  @ApiProperty({ type: [RecentAdjustmentViewDto] })
  public recentAdjustments!: RecentAdjustmentViewDto[];
}

export function toDailyAttendanceView(summary: DailyAttendanceSummary): DailyAttendanceViewDto {
  return {
    businessDate: summary.businessDate,
    isFinalized: summary.isFinalized,
    status: summary.status,
    workState: summary.workState,
    expectedMinutes: summary.expectedMinutes,
    workedMinutes: summary.workedMinutes,
    balanceMinutes: summary.balanceMinutes,
    punchCount: summary.punchCount,
    completedIntervalCount: summary.completedIntervalCount,
    correctionCount: summary.correctionCount,
    expectationSource: summary.expectation.source,
    calendarStatus: summary.expectation.calendarStatus,
    exceptionName: summary.expectation.exceptionName,
    chronology: {
      ...summary.chronology,
      integrityIssues: summary.chronology.integrityIssues.map(
        ({ message: _message, ...issue }) => issue,
      ),
    },
  };
}
