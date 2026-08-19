import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  aggregateAttendancePeriod,
  aggregateMonthlyAttendance,
  businessDateFromInstant,
  calculateDailyAttendance,
  classifyBusinessDate,
  instantRangeForBusinessDate,
  resolveExpectation,
  type AttendancePeriodSummary,
  type AttendancePunch,
  type CalendarExceptionRevision,
  type DailyAttendanceSummary,
  type MonthlyAttendanceSummary,
  type ResolvedExpectation,
  type ScheduleVersion,
  type Weekday,
} from '@ph-ponto/shared';

import { CalendarExceptionResolverService } from '../calendar-exceptions/calendar-exception-resolver.service.js';
import { PrismaService } from '../database/prisma.service.js';
import { CalendarExceptionKind, type Prisma, UserRole } from '../generated/prisma/client.js';
import { ScheduleResolverService } from '../schedules/schedule-resolver.service.js';
import {
  businessDateToDatabaseDate,
  databaseDateToBusinessDate,
} from '../schedules/business-date.js';
import type {
  AttendanceSummaryResolver,
  ResolveDailyAttendanceInput,
} from '../time-punches/attendance-summary.port.js';
import {
  compareBusinessDates,
  enumerateBusinessDates,
  isBusinessDate,
  monthBusinessDateRange,
} from './business-date.js';
import {
  toDailyAttendanceView,
  type AttendanceOverviewViewDto,
  type DailyAttendanceViewDto,
  type EmployeeTodayStatusViewDto,
} from './attendance.view.js';
import { ATTENDANCE_CLOCK, type AttendanceClock } from './attendance-clock.js';

const MAXIMUM_HISTORY_DAYS = 366;

export interface AttendancePeriodResult {
  days: DailyAttendanceViewDto[];
  totals: AttendancePeriodSummary;
}

export interface MonthlyAttendanceResult {
  days: DailyAttendanceViewDto[];
  totals: MonthlyAttendanceSummary;
}

function invalidDate(): BadRequestException {
  return new BadRequestException({
    code: 'INVALID_BUSINESS_DATE',
    message: 'Informe uma data válida no formato AAAA-MM-DD.',
  });
}

function invalidRange(message: string): BadRequestException {
  return new BadRequestException({ code: 'INVALID_DATE_RANGE', message });
}

@Injectable()
export class AttendanceService implements AttendanceSummaryResolver {
  public constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ScheduleResolverService) private readonly schedules: ScheduleResolverService,
    @Inject(CalendarExceptionResolverService)
    private readonly exceptions: CalendarExceptionResolverService,
    @Inject(ATTENDANCE_CLOCK) private readonly clock: AttendanceClock,
  ) {}

  public async getToday(employeeId: string): Promise<DailyAttendanceViewDto> {
    const evaluationInstant = this.clock();
    return this.getDaily(employeeId, businessDateFromInstant(evaluationInstant), evaluationInstant);
  }

  public async getDaily(
    employeeId: string,
    businessDate: string,
    evaluationInstant = this.clock(),
  ): Promise<DailyAttendanceViewDto> {
    this.assertNotFutureDate(businessDate, evaluationInstant);
    await this.assertEmployee(employeeId);
    const summary = await this.prisma.$transaction((transaction) =>
      this.resolveDaily({ employeeId, businessDate, evaluationInstant, transaction }),
    );
    return toDailyAttendanceView(summary);
  }

  public async getAdminDaily(
    employeeId: string,
    businessDate: string,
    evaluationInstant = this.clock(),
  ): Promise<DailyAttendanceViewDto> {
    this.assertNotFutureDate(businessDate, evaluationInstant);
    await this.assertEmployee(employeeId);
    const summary = await this.prisma.$transaction((transaction) =>
      this.resolveDaily({ employeeId, businessDate, evaluationInstant, transaction }),
    );
    return toDailyAttendanceView(summary);
  }

  public async getOverview(
    targetDate?: string,
    evaluationInstant = this.clock(),
  ): Promise<AttendanceOverviewViewDto> {
    const businessDate = targetDate ?? businessDateFromInstant(evaluationInstant);
    this.assertNotFutureDate(businessDate, evaluationInstant);

    return this.prisma.$transaction(
      async (tx) => {
        const [activeEmployees, expectation, recentPunches, recentAdjustments] = await Promise.all([
          tx.user.findMany({
            where: { role: UserRole.EMPLOYEE, isActive: true },
            orderBy: [{ name: 'asc' }, { login: 'asc' }],
            select: {
              id: true,
              name: true,
              login: true,
              createdAt: true,
              avatar: { select: { id: true } },
            },
          }),
          this.resolveExpectation(businessDate, tx),
          tx.timePunch.findMany({
            take: 10,
            orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
            include: {
              employee: { select: { name: true } },
              adjustments: { orderBy: { sequence: 'desc' }, take: 1 },
            },
          }),
          tx.timeAdjustment.findMany({
            take: 10,
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
            include: {
              admin: { select: { name: true } },
              timePunch: { include: { employee: { select: { name: true } } } },
            },
          }),
        ]);

        const { start, endExclusive } = instantRangeForBusinessDate(businessDate);
        const todayPunches = await tx.timePunch.findMany({
          where: { occurredAt: { gte: start, lt: endExclusive } },
          orderBy: [{ occurredAt: 'asc' }, { id: 'asc' }],
          select: {
            id: true,
            employeeId: true,
            kind: true,
            occurredAt: true,
            adjustments: {
              orderBy: { sequence: 'asc' },
              select: {
                id: true,
                sequence: true,
                previousOccurredAt: true,
                correctedOccurredAt: true,
              },
            },
          },
        });

        const punchesByEmployee = new Map<string, AttendancePunch[]>();
        for (const p of todayPunches) {
          const list = punchesByEmployee.get(p.employeeId) ?? [];
          list.push({
            id: p.id,
            kind: p.kind,
            occurredAt: p.occurredAt,
            adjustments: p.adjustments,
          });
          punchesByEmployee.set(p.employeeId, list);
        }

        const todayVacations = await tx.vacation.findMany({
          where: {
            startDate: { lte: businessDateToDatabaseDate(businessDate) },
            endDate: { gte: businessDateToDatabaseDate(businessDate) },
          },
          select: { employeeId: true, note: true },
        });
        const vacationByEmployee = new Map<string, string>();
        for (const v of todayVacations) {
          vacationByEmployee.set(v.employeeId, v.note ?? 'Férias');
        }

        const targetEmployees = activeEmployees.filter((emp) => {
          if (!emp.createdAt) return true;
          const empHireDate = businessDateFromInstant(emp.createdAt);
          return compareBusinessDates(businessDate, empHireDate) >= 0;
        });

        const employeeStatuses: EmployeeTodayStatusViewDto[] = [];
        let clockedInTodayCount = 0;
        let currentlyWorkingCount = 0;
        let incompleteCount = 0;
        let notClockedInCount = 0;

        for (const emp of targetEmployees) {
          const punches = punchesByEmployee.get(emp.id) ?? [];
          const empHireDate = businessDateFromInstant(emp.createdAt);
          let empExpectation = expectation;
          const vacationNote = vacationByEmployee.get(emp.id);

          if (compareBusinessDates(businessDate, empHireDate) < 0) {
            empExpectation = {
              ...expectation,
              expectedMinutes: 0,
              isOpen: false,
              calendarStatus: 'DAY_OFF',
            };
          } else if (vacationNote !== undefined) {
            empExpectation = {
              ...expectation,
              source: 'VACATION',
              calendarStatus: 'VACATION',
              expectedMinutes: 0,
              isOpen: false,
              exceptionName: vacationNote,
            };
          }

          const daily = calculateDailyAttendance({
            businessDate,
            expectation: empExpectation,
            punches,
            isFinalized: classifyBusinessDate(businessDate, evaluationInstant) === 'FINALIZED',
          });

          if (daily.punchCount > 0) clockedInTodayCount++;
          if (daily.workState === 'WORKING') currentlyWorkingCount++;
          if (daily.status === 'INCOMPLETE' || daily.chronology.isIncomplete) incompleteCount++;
          if (daily.punchCount === 0 && empExpectation.isOpen) notClockedInCount++;

          const lastPunch = punches.at(-1);
          let effectiveLastPunchAt: string | null = null;
          if (lastPunch !== undefined) {
            const lastAdj = lastPunch.adjustments?.[lastPunch.adjustments.length - 1];
            const rawEffective = lastAdj?.correctedOccurredAt ?? lastPunch.occurredAt;
            effectiveLastPunchAt = new Date(rawEffective).toISOString();
          }

          employeeStatuses.push({
            id: emp.id,
            name: emp.name,
            login: emp.login,
            hasAvatar: emp.avatar !== null,
            status: daily.status,
            workState: daily.workState,
            workedMinutes: daily.workedMinutes,
            expectedMinutes: daily.expectedMinutes,
            balanceMinutes: daily.balanceMinutes,
            punchCount: daily.punchCount,
            completedIntervalCount: daily.completedIntervalCount,
            correctionCount: daily.correctionCount,
            lastPunchAt: effectiveLastPunchAt,
            lastPunchKind: lastPunch ? lastPunch.kind : null,
          });
        }

        return {
          businessDate,
          totalActiveEmployees: targetEmployees.length,
          clockedInTodayCount,
          currentlyWorkingCount,
          incompleteCount,
          notClockedInCount,
          employees: employeeStatuses,
          recentPunches: recentPunches.map((p) => ({
            id: p.id,
            employeeId: p.employeeId,
            employeeName: p.employee.name,
            occurredAt: p.occurredAt.toISOString(),
            effectiveOccurredAt: (
              p.adjustments[0]?.correctedOccurredAt ?? p.occurredAt
            ).toISOString(),
            kind: p.kind,
            origin: p.origin,
            adjustmentSequence: p.adjustments[0]?.sequence ?? 0,
          })),
          recentAdjustments: recentAdjustments.map((a) => ({
            id: a.id,
            timePunchId: a.timePunchId,
            employeeName: a.timePunch.employee.name,
            adminName: a.admin.name,
            previousOccurredAt: a.previousOccurredAt.toISOString(),
            correctedOccurredAt: a.correctedOccurredAt.toISOString(),
            reason: a.reason,
            createdAt: a.createdAt.toISOString(),
          })),
        };
      },
      { isolationLevel: 'RepeatableRead', maxWait: 5_000, timeout: 10_000 },
    );
  }

  public async getPeriod(
    employeeId: string,
    from: string,
    to: string,
    evaluationInstant = this.clock(),
  ): Promise<AttendancePeriodResult> {
    const dates = this.validatedDates(from, to, evaluationInstant);
    await this.assertEmployee(employeeId);
    const summaries = await this.loadPeriodSummaries(employeeId, dates, evaluationInstant);

    return {
      days: summaries.map(toDailyAttendanceView),
      totals: aggregateAttendancePeriod(summaries),
    };
  }

  public async getMonthly(
    employeeId: string,
    month: string,
    evaluationInstant = this.clock(),
  ): Promise<MonthlyAttendanceResult> {
    let range: { from: string; to: string };
    try {
      range = monthBusinessDateRange(month);
    } catch {
      throw new BadRequestException({
        code: 'INVALID_MONTH',
        message: 'Informe um mês válido no formato AAAA-MM.',
      });
    }

    const today = businessDateFromInstant(evaluationInstant);
    if (compareBusinessDates(range.from, today) > 0) {
      throw invalidRange('Não é possível consultar um mês futuro.');
    }

    const to = compareBusinessDates(range.to, today) > 0 ? today : range.to;
    const dates = this.validatedDates(range.from, to, evaluationInstant);
    await this.assertEmployee(employeeId);
    const summaries = await this.loadPeriodSummaries(employeeId, dates, evaluationInstant);
    const [year, monthNumber] = month.split('-').map(Number);

    return {
      days: summaries.map(toDailyAttendanceView),
      totals: aggregateMonthlyAttendance({
        year: year!,
        month: monthNumber!,
        summaries,
      }),
    };
  }

  public async resolveDaily({
    employeeId,
    businessDate,
    evaluationInstant,
    transaction,
  }: ResolveDailyAttendanceInput): Promise<DailyAttendanceSummary> {
    if (!isBusinessDate(businessDate)) {
      throw invalidDate();
    }

    const [userRecord, expectation, punches, vacation] = await Promise.all([
      transaction.user.findUnique({
        where: { id: employeeId },
        select: { createdAt: true },
      }),
      this.resolveExpectation(businessDate, transaction),
      this.listPunches(employeeId, businessDate, transaction),
      transaction.vacation.findFirst({
        where: {
          employeeId,
          startDate: { lte: businessDateToDatabaseDate(businessDate) },
          endDate: { gte: businessDateToDatabaseDate(businessDate) },
        },
        select: { id: true, note: true },
      }),
    ]);

    const hireBusinessDate = userRecord?.createdAt
      ? businessDateFromInstant(userRecord.createdAt)
      : null;

    let effectiveExpectation = expectation;
    if (hireBusinessDate && compareBusinessDates(businessDate, hireBusinessDate) < 0) {
      effectiveExpectation = {
        ...expectation,
        expectedMinutes: 0,
        isOpen: false,
        calendarStatus: 'DAY_OFF',
      };
    } else if (vacation) {
      effectiveExpectation = {
        ...expectation,
        source: 'VACATION',
        calendarStatus: 'VACATION',
        expectedMinutes: 0,
        isOpen: false,
        openingMinute: null,
        closingMinute: null,
        lunchEnabled: false,
        lunchStartMinute: null,
        lunchEndMinute: null,
        exceptionName: vacation.note ?? 'Férias',
      };
    }

    return calculateDailyAttendance({
      businessDate,
      expectation: effectiveExpectation,
      punches,
      isFinalized: classifyBusinessDate(businessDate, evaluationInstant) === 'FINALIZED',
    });
  }

  private async assertEmployee(employeeId: string): Promise<void> {
    const employee = await this.prisma.user.findFirst({
      where: { id: employeeId, role: UserRole.EMPLOYEE },
      select: { id: true },
    });
    if (employee === null) {
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'Funcionário não encontrado.',
      });
    }
  }

  private assertNotFutureDate(businessDate: string, evaluationInstant: Date): void {
    if (!isBusinessDate(businessDate)) {
      throw invalidDate();
    }
    if (classifyBusinessDate(businessDate, evaluationInstant) === 'FUTURE') {
      throw invalidRange('Não é possível consultar uma data futura.');
    }
  }

  private validatedDates(from: string, to: string, evaluationInstant: Date): string[] {
    if (!isBusinessDate(from) || !isBusinessDate(to)) {
      throw invalidDate();
    }
    if (compareBusinessDates(from, to) > 0) {
      throw invalidRange('A data inicial deve ser anterior ou igual à data final.');
    }
    if (classifyBusinessDate(to, evaluationInstant) === 'FUTURE') {
      throw invalidRange('O período não pode terminar em uma data futura.');
    }

    try {
      return enumerateBusinessDates(from, to, MAXIMUM_HISTORY_DAYS);
    } catch {
      throw invalidRange('O período consultado não pode ultrapassar 366 dias.');
    }
  }

  private async resolveExpectation(
    businessDate: string,
    transaction: Prisma.TransactionClient,
  ): Promise<ResolvedExpectation> {
    const [schedule, exception] = await Promise.all([
      this.schedules.resolveForDate(businessDate, transaction),
      this.exceptions.resolveForDate(businessDate, transaction),
    ]);
    const base: ResolvedExpectation = {
      businessDate,
      source: 'WEEKLY_SCHEDULE',
      calendarStatus: schedule.day.isOpen ? null : 'DAY_OFF',
      expectedMinutes: schedule.day.expectedMinutes,
      isOpen: schedule.day.isOpen,
      openingMinute: schedule.day.openingMinute,
      closingMinute: schedule.day.closingMinute,
      lunchEnabled: schedule.day.lunchEnabled,
      lunchStartMinute: schedule.day.lunchStartMinute,
      lunchEndMinute: schedule.day.lunchEndMinute,
      scheduleVersionId: schedule.scheduleVersionId,
      scheduleEffectiveDate: schedule.effectiveDate,
      exceptionRevisionId: null,
      exceptionName: null,
    };
    if (exception === null) {
      return base;
    }

    if (
      exception.kind === CalendarExceptionKind.HOLIDAY ||
      exception.kind === CalendarExceptionKind.CLOSED
    ) {
      return {
        ...base,
        source: exception.kind,
        calendarStatus: exception.kind,
        expectedMinutes: 0,
        isOpen: false,
        openingMinute: null,
        closingMinute: null,
        lunchEnabled: false,
        lunchStartMinute: null,
        lunchEndMinute: null,
        exceptionRevisionId: exception.revisionId,
        exceptionName: exception.name,
      };
    }

    return {
      ...base,
      source: 'SPECIAL_HOURS',
      calendarStatus: null,
      expectedMinutes: exception.expectedMinutes,
      isOpen: true,
      openingMinute: exception.openingMinute,
      closingMinute: exception.closingMinute,
      lunchEnabled: exception.lunchEnabled,
      lunchStartMinute: exception.lunchStartMinute,
      lunchEndMinute: exception.lunchEndMinute,
      exceptionRevisionId: exception.revisionId,
      exceptionName: exception.name,
    };
  }

  private async loadPeriodSummaries(
    employeeId: string,
    dates: readonly string[],
    evaluationInstant: Date,
  ): Promise<DailyAttendanceSummary[]> {
    const from = dates[0];
    const to = dates.at(-1);
    if (from === undefined || to === undefined) {
      return [];
    }

    return this.prisma.$transaction(
      async (transaction) => {
        const [userRecord, scheduleRecords, exceptionRecords, punchRecords, vacationRecords] =
          await Promise.all([
            transaction.user.findUnique({
              where: { id: employeeId },
              select: { createdAt: true },
            }),
            transaction.businessScheduleVersion.findMany({
              where: { effectiveDate: { lte: businessDateToDatabaseDate(to) } },
              orderBy: { effectiveDate: 'asc' },
              select: {
                id: true,
                effectiveDate: true,
                days: {
                  select: {
                    weekday: true,
                    isOpen: true,
                    openingMinute: true,
                    closingMinute: true,
                    lunchEnabled: true,
                    lunchStartMinute: true,
                    lunchEndMinute: true,
                  },
                },
              },
            }),
            transaction.calendarException.findMany({
              where: {
                businessDate: {
                  gte: businessDateToDatabaseDate(from),
                  lte: businessDateToDatabaseDate(to),
                },
              },
              select: {
                businessDate: true,
                revisions: {
                  orderBy: { sequence: 'asc' },
                  select: {
                    id: true,
                    sequence: true,
                    operation: true,
                    kind: true,
                    name: true,
                    openingMinute: true,
                    closingMinute: true,
                    lunchEnabled: true,
                    lunchStartMinute: true,
                    lunchEndMinute: true,
                  },
                },
              },
            }),
            (() => {
              const { start } = instantRangeForBusinessDate(from);
              const { endExclusive } = instantRangeForBusinessDate(to);
              return transaction.timePunch.findMany({
                where: { employeeId, occurredAt: { gte: start, lt: endExclusive } },
                orderBy: [{ occurredAt: 'asc' }, { id: 'asc' }],
                select: {
                  id: true,
                  kind: true,
                  occurredAt: true,
                  adjustments: {
                    orderBy: { sequence: 'asc' },
                    select: {
                      id: true,
                      sequence: true,
                      previousOccurredAt: true,
                      correctedOccurredAt: true,
                    },
                  },
                },
              });
            })(),
            transaction.vacation.findMany({
              where: {
                employeeId,
                startDate: { lte: businessDateToDatabaseDate(to) },
                endDate: { gte: businessDateToDatabaseDate(from) },
              },
              select: {
                id: true,
                startDate: true,
                endDate: true,
                note: true,
              },
            }),
          ]);

        const hireBusinessDate = userRecord?.createdAt
          ? businessDateFromInstant(userRecord.createdAt)
          : null;

        const scheduleVersions: ScheduleVersion[] = scheduleRecords.map((schedule) => ({
          id: schedule.id,
          effectiveDate: databaseDateToBusinessDate(schedule.effectiveDate),
          days: schedule.days.map((day) => ({ ...day, weekday: day.weekday as Weekday })),
        }));
        const exceptionRevisions: CalendarExceptionRevision[] = exceptionRecords.flatMap(
          (exception) => {
            const businessDate = databaseDateToBusinessDate(exception.businessDate);
            return exception.revisions.map((revision) => ({
              ...revision,
              businessDate,
              operation: revision.operation,
              kind: revision.kind,
            }));
          },
        );
        const punchesByDate = new Map<string, AttendancePunch[]>();
        for (const punch of punchRecords) {
          const businessDate = businessDateFromInstant(punch.occurredAt);
          const datePunches = punchesByDate.get(businessDate) ?? [];
          datePunches.push({
            id: punch.id,
            kind: punch.kind,
            occurredAt: punch.occurredAt,
            adjustments: punch.adjustments,
          });
          punchesByDate.set(businessDate, datePunches);
        }

        const applicableDates = hireBusinessDate
          ? dates.filter((d) => compareBusinessDates(d, hireBusinessDate) >= 0)
          : dates;

        const allSummaries = applicableDates.map((businessDate) => {
          const matchingVacation = vacationRecords.find((v) => {
            const startStr = databaseDateToBusinessDate(v.startDate);
            const endStr = databaseDateToBusinessDate(v.endDate);
            return (
              compareBusinessDates(startStr, businessDate) <= 0 &&
              compareBusinessDates(businessDate, endStr) <= 0
            );
          });
          const vacationInfo = matchingVacation
            ? {
                id: matchingVacation.id,
                startDate: databaseDateToBusinessDate(matchingVacation.startDate),
                endDate: databaseDateToBusinessDate(matchingVacation.endDate),
                note: matchingVacation.note,
              }
            : null;

          const expectation = resolveExpectation({
            businessDate,
            scheduleVersions,
            exceptionRevisions,
            vacation: vacationInfo,
          });

          return calculateDailyAttendance({
            businessDate,
            expectation,
            punches: punchesByDate.get(businessDate) ?? [],
            isFinalized: classifyBusinessDate(businessDate, evaluationInstant) === 'FINALIZED',
          });
        });

        return allSummaries.filter((summary) => {
          const isRegularClosedDayWithoutPunches =
            !summary.expectation.isOpen &&
            summary.expectation.source === 'WEEKLY_SCHEDULE' &&
            summary.punchCount === 0 &&
            summary.expectation.calendarStatus === 'DAY_OFF' &&
            !summary.expectation.exceptionName;
          return !isRegularClosedDayWithoutPunches;
        });
      },
      { isolationLevel: 'RepeatableRead', maxWait: 5_000, timeout: 10_000 },
    );
  }

  private async listPunches(
    employeeId: string,
    businessDate: string,
    transaction: Prisma.TransactionClient,
  ): Promise<AttendancePunch[]> {
    const { start, endExclusive } = instantRangeForBusinessDate(businessDate);
    const punches = await transaction.timePunch.findMany({
      where: { employeeId, occurredAt: { gte: start, lt: endExclusive } },
      orderBy: [{ occurredAt: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        kind: true,
        occurredAt: true,
        adjustments: {
          orderBy: { sequence: 'asc' },
          select: {
            id: true,
            sequence: true,
            previousOccurredAt: true,
            correctedOccurredAt: true,
          },
        },
      },
    });

    return punches.map((punch) => ({
      id: punch.id,
      kind: punch.kind,
      occurredAt: punch.occurredAt,
      adjustments: punch.adjustments,
    }));
  }
}
