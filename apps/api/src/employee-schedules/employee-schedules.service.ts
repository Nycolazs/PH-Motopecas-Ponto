import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  addDays,
  applyAbsenceJustification,
  applyEmployeeScheduleLayer,
  assertValidShift,
  businessDateFromInstant,
  checkCompliance,
  daysBetween,
  effectiveLimits,
  enumerateDates,
  mondayOf,
  planEmployeeDay,
  resolveExpectation,
  selectEmployeeScheduleVersion,
  shiftMinutes,
  weekdayForBusinessDate,
  type CalendarExceptionRevision,
  type ComplianceIssue,
  type EmployeeScheduleDayInput,
  type EmployeeScheduleOverrideInput,
  type EmployeeScheduleVersionInput,
  type PlannedDay,
  type ResolvedExpectation,
  type ScheduleVersion,
  type Shift,
  type Weekday,
} from '@ph-ponto/shared';
import { randomUUID } from 'node:crypto';

import { AuditService } from '../audit/audit.service.js';
import type { AuthenticatedUser, ClientContext } from '../auth/auth.types.js';
import { PrismaService } from '../database/prisma.service.js';
import {
  AuditAction,
  AuditTargetType,
  type Prisma,
  ScheduleOverrideReason,
  UserRole,
} from '../generated/prisma/client.js';
import { ATTENDANCE_CLOCK, type AttendanceClock } from '../attendance/attendance-clock.js';
import {
  businessDateToDatabaseDate,
  databaseDateToBusinessDate,
} from '../schedules/business-date.js';
import {
  EMPTY_SCHEDULE_LAYER,
  employeeScheduleVersionSelect,
  loadEmployeeScheduleLayers,
  toVersionInput,
  type EmployeeScheduleLayer,
} from './employee-schedule-layers.js';
import type {
  CreateScheduleAdjustmentDto,
  EmployeeScheduleDraftDto,
  MoveRestDayDto,
  PublishEmployeeScheduleDto,
  ShiftInputDto,
  UpdateWorkRegimeDto,
} from './employee-schedule.dto.js';

export const WORK_REGIME_SETTING_KEY = 'work_regime';
const MAX_RANGE_DAYS = 62;
const PREVIEW_WEEKS = 8;

export interface WorkRegimeSettings {
  hasCollectiveAgreement: boolean | null;
  sundayRestEveryWeeks: number;
  minimumStaff: number;
}

export const DEFAULT_WORK_REGIME: WorkRegimeSettings = {
  hasCollectiveAgreement: null,
  sundayRestEveryWeeks: 3,
  minimumStaff: 1,
};

export type ScheduleCellStatus =
  'WORK' | 'REST' | 'HOLIDAY' | 'CLOSED' | 'VACATION' | 'ALLOWANCE' | 'MEDICAL_LEAVE' | 'NOT_HIRED';

export interface ScheduleCell {
  businessDate: string;
  weekday: Weekday;
  status: ScheduleCellStatus;
  startMinute: number | null;
  endMinute: number | null;
  breakStartMinute: number | null;
  breakEndMinute: number | null;
  plannedMinutes: number;
  source: ResolvedExpectation['source'];
  label: string | null;
  overrideId: string | null;
  overrideReason: 'SWAP' | 'ADJUSTMENT' | null;
}

export interface WeekTotal {
  weekStart: string;
  plannedMinutes: number;
  restDays: number;
  weeklyLimitMinutes: number;
  regimeLabel: string;
}

export interface EmployeeScheduleRow {
  employeeId: string;
  name: string;
  login: string;
  hasAvatar: boolean;
  hasOwnSchedule: boolean;
  /** Start of the person's newest escala (own schedule), today or in the future; null if none. */
  ownScheduleFrom: string | null;
  days: ScheduleCell[];
  weeks: WeekTotal[];
  issues: ComplianceIssue[];
}

export interface DayCoverageView {
  businessDate: string;
  working: number;
  storeOpen: boolean;
  belowMinimum: boolean;
}

export interface TeamScheduleView {
  from: string;
  to: string;
  settings: WorkRegimeSettings;
  regimeToday: string;
  employees: EmployeeScheduleRow[];
  coverage: DayCoverageView[];
}

interface CalendarData {
  scheduleVersions: ScheduleVersion[];
  exceptionRevisions: CalendarExceptionRevision[];
  vacations: {
    employeeId: string;
    id: string;
    startDate: string;
    endDate: string;
    note: string | null;
  }[];
  justifications: {
    employeeId: string;
    kind: 'ALLOWANCE' | 'MEDICAL_CERTIFICATE';
    reason: string;
    startDate: string;
    endDate: string;
  }[];
  layers: Map<string, EmployeeScheduleLayer>;
}

function within(date: string, start: string, end: string): boolean {
  return start <= date && date <= end;
}

function shiftFromInput(input: ShiftInputDto, label: string): Shift | null {
  if (!input.isWorkday) {
    if (
      (input.startMinute ?? null) !== null ||
      (input.endMinute ?? null) !== null ||
      (input.breakStartMinute ?? null) !== null ||
      (input.breakEndMinute ?? null) !== null
    ) {
      throw new BadRequestException({
        code: 'INVALID_SHIFT',
        message: `${label}: dia de folga não pode ter horários.`,
      });
    }
    return null;
  }
  if (input.startMinute == null || input.endMinute == null) {
    throw new BadRequestException({
      code: 'INVALID_SHIFT',
      message: `${label}: informe o horário de entrada e de saída.`,
    });
  }
  const shift: Shift = {
    startMinute: input.startMinute,
    endMinute: input.endMinute,
    breakStartMinute: input.breakStartMinute ?? null,
    breakEndMinute: input.breakEndMinute ?? null,
  };
  try {
    assertValidShift(shift);
  } catch {
    let message = `${label}: a saída precisa ser depois da entrada.`;
    if ((shift.breakStartMinute === null) !== (shift.breakEndMinute === null)) {
      message = `${label}: informe o início e o fim do intervalo, ou deixe os dois vazios.`;
    } else if (shift.startMinute < shift.endMinute) {
      message = `${label}: o intervalo precisa ficar dentro do horário de trabalho.`;
    }
    throw new BadRequestException({ code: 'INVALID_SHIFT', message });
  }
  return shift;
}

const WEEKDAY_LABELS: Record<Weekday, string> = {
  MONDAY: 'Segunda',
  TUESDAY: 'Terça',
  WEDNESDAY: 'Quarta',
  THURSDAY: 'Quinta',
  FRIDAY: 'Sexta',
  SATURDAY: 'Sábado',
  SUNDAY: 'Domingo',
};

/** Problem details keyed by rule code (the API error format only carries string lists). */
function issueDetails(issues: readonly ComplianceIssue[]): Record<string, string[]> {
  const details: Record<string, string[]> = {};
  for (const issue of issues) {
    (details[issue.code] ??= []).push(issue.message);
  }
  return details;
}

function ownScheduleFrom(
  latest: { effectiveDate: Date; usesCompanySchedule: boolean } | undefined,
): string | null {
  if (latest === undefined || latest.usesCompanySchedule) return null;
  return databaseDateToBusinessDate(latest.effectiveDate);
}

function dateBR(date: string): string {
  const [year, month, day] = date.split('-');
  return `${day}/${month}/${year}`;
}

@Injectable()
export class EmployeeSchedulesService {
  public constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(ATTENDANCE_CLOCK) private readonly clock: AttendanceClock,
  ) {}

  private today(): string {
    return businessDateFromInstant(this.clock());
  }

  // ---------------------------------------------------------------- settings

  public async getSettings(
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<WorkRegimeSettings> {
    const record = await client.appSetting.findUnique({
      where: { key: WORK_REGIME_SETTING_KEY },
      select: { value: true },
    });
    const value = (record?.value ?? {}) as Partial<WorkRegimeSettings>;
    return {
      hasCollectiveAgreement:
        typeof value.hasCollectiveAgreement === 'boolean' ? value.hasCollectiveAgreement : null,
      sundayRestEveryWeeks: value.sundayRestEveryWeeks === 2 ? 2 : 3,
      minimumStaff:
        typeof value.minimumStaff === 'number' && Number.isInteger(value.minimumStaff)
          ? value.minimumStaff
          : DEFAULT_WORK_REGIME.minimumStaff,
    };
  }

  public async updateSettings(
    actor: AuthenticatedUser,
    input: UpdateWorkRegimeDto,
    context: ClientContext,
  ): Promise<WorkRegimeSettings> {
    const next: WorkRegimeSettings = {
      hasCollectiveAgreement: input.hasCollectiveAgreement ?? null,
      sundayRestEveryWeeks: input.sundayRestEveryWeeks,
      minimumStaff: input.minimumStaff,
    };
    await this.prisma.$transaction(async (tx) => {
      const before = await this.getSettings(tx);
      await tx.appSetting.upsert({
        where: { key: WORK_REGIME_SETTING_KEY },
        create: {
          key: WORK_REGIME_SETTING_KEY,
          value: next as unknown as Prisma.InputJsonValue,
          updatedById: actor.id,
        },
        update: { value: next as unknown as Prisma.InputJsonValue, updatedById: actor.id },
      });
      await this.audit.record(
        {
          actorId: actor.id,
          action: AuditAction.SETTING_UPDATED,
          targetType: AuditTargetType.SETTING,
          targetId: WORK_REGIME_SETTING_KEY,
          ...context,
          beforeState: { key: WORK_REGIME_SETTING_KEY, ...before },
          afterState: { key: WORK_REGIME_SETTING_KEY, ...next },
        },
        tx,
      );
    });
    return next;
  }

  // ---------------------------------------------------------------- reading

  public async getTeam(from: string, to: string): Promise<TeamScheduleView> {
    this.assertRange(from, to);
    const employees = await this.prisma.user.findMany({
      where: { role: UserRole.EMPLOYEE, isActive: true },
      select: {
        id: true,
        name: true,
        login: true,
        createdAt: true,
        avatar: { select: { id: true } },
        employeeProfile: { select: { hireDate: true } },
      },
    });
    employees.sort((left, right) => left.name.localeCompare(right.name, 'pt-BR'));

    // Weekly rules need complete weeks: compute on whole weeks, show the requested range.
    const computeFrom = mondayOf(from);
    const computeTo = addDays(mondayOf(to), 6);
    const [settings, calendar, latestVersions] = await Promise.all([
      this.getSettings(),
      this.loadCalendar(
        employees.map((employee) => employee.id),
        computeFrom,
        computeTo,
      ),
      this.prisma.employeeScheduleVersion.findMany({
        where: { employeeId: { in: employees.map((employee) => employee.id) } },
        orderBy: { effectiveDate: 'desc' },
        select: { employeeId: true, effectiveDate: true, usesCompanySchedule: true },
      }),
    ]);
    const latestByEmployee = new Map<string, (typeof latestVersions)[number]>();
    for (const version of latestVersions) {
      if (!latestByEmployee.has(version.employeeId))
        latestByEmployee.set(version.employeeId, version);
    }

    const rows = employees.map((employee) => {
      const startDate = this.firstWorkDate(employee);
      const row = this.buildRow(employee.id, startDate, calendar, computeFrom, computeTo, settings);
      return {
        employeeId: employee.id,
        name: employee.name,
        login: employee.login,
        hasAvatar: employee.avatar !== null,
        hasOwnSchedule: row.hasOwnSchedule,
        ownScheduleFrom: ownScheduleFrom(latestByEmployee.get(employee.id)),
        days: row.days.filter((day) => within(day.businessDate, from, to)),
        weeks: row.weeks,
        issues: row.issues.filter(
          (issue) => issue.businessDate >= mondayOf(from) && issue.businessDate <= to,
        ),
      };
    });

    const coverage = enumerateDates(from, to).map((businessDate) => {
      const company = this.companyExpectation(calendar, businessDate);
      const working = rows.filter((row) =>
        row.days.some((day) => day.businessDate === businessDate && day.status === 'WORK'),
      ).length;
      const storeOpen =
        company !== null &&
        company.source !== 'HOLIDAY' &&
        company.source !== 'CLOSED' &&
        (company.isOpen || working > 0);
      return {
        businessDate,
        working,
        storeOpen,
        belowMinimum: storeOpen && working < settings.minimumStaff,
      };
    });

    return {
      from,
      to,
      settings,
      regimeToday: effectiveLimits(this.today(), {
        hasCollectiveAgreement: settings.hasCollectiveAgreement === true,
      }).regime.label,
      employees: rows,
      coverage,
    };
  }

  public async getEmployeeOverview(employeeId: string, from: string, to: string) {
    this.assertRange(from, to);
    const employee = await this.findEmployee(employeeId);
    const computeFrom = mondayOf(from);
    const computeTo = addDays(mondayOf(to), 6);
    const [settings, calendar, versions, overrides] = await Promise.all([
      this.getSettings(),
      this.loadCalendar([employeeId], computeFrom, computeTo),
      this.prisma.employeeScheduleVersion.findMany({
        where: { employeeId },
        orderBy: { effectiveDate: 'desc' },
        select: {
          ...employeeScheduleVersionSelect,
          note: true,
          createdAt: true,
          createdBy: { select: { name: true } },
        },
      }),
      this.prisma.scheduleOverride.findMany({
        where: {
          employeeId,
          revokedAt: null,
          businessDate: { gte: businessDateToDatabaseDate(this.today()) },
        },
        orderBy: { businessDate: 'asc' },
        take: 60,
        select: {
          id: true,
          businessDate: true,
          isWorkday: true,
          startMinute: true,
          endMinute: true,
          breakStartMinute: true,
          breakEndMinute: true,
          reason: true,
          swapId: true,
          note: true,
          createdAt: true,
          createdBy: { select: { name: true } },
        },
      }),
    ]);
    const row = this.buildRow(
      employeeId,
      this.firstWorkDate(employee),
      calendar,
      computeFrom,
      computeTo,
      settings,
    );
    const today = this.today();
    const currentVersion =
      versions.find((version) => databaseDateToBusinessDate(version.effectiveDate) <= today) ??
      null;
    return {
      employeeId,
      name: employee.name,
      hasOwnSchedule: row.hasOwnSchedule,
      settings,
      days: row.days.filter((day) => within(day.businessDate, from, to)),
      weeks: row.weeks,
      issues: row.issues.filter(
        (issue) => issue.businessDate >= mondayOf(from) && issue.businessDate <= to,
      ),
      currentVersionId: currentVersion?.id ?? null,
      versions: versions.map((version) => ({
        ...toVersionInput(version),
        note: version.note,
        createdAt: version.createdAt.toISOString(),
        createdByName: version.createdBy.name,
        isFuture: databaseDateToBusinessDate(version.effectiveDate) > today,
      })),
      upcomingOverrides: overrides.map((override) => ({
        id: override.id,
        businessDate: databaseDateToBusinessDate(override.businessDate),
        isWorkday: override.isWorkday,
        startMinute: override.startMinute,
        endMinute: override.endMinute,
        breakStartMinute: override.breakStartMinute,
        breakEndMinute: override.breakEndMinute,
        reason: override.reason,
        swapId: override.swapId,
        note: override.note,
        createdAt: override.createdAt.toISOString(),
        createdByName: override.createdBy.name,
      })),
    };
  }

  /** The signed-in employee's own schedule (from today, up to 6 weeks). */
  public async getMine(employeeId: string, weeks = 4) {
    const from = this.today();
    const to = addDays(mondayOf(from), Math.min(Math.max(weeks, 1), 6) * 7 - 1);
    const overview = await this.getEmployeeOverview(employeeId, from, to);
    return {
      from,
      to,
      hasOwnSchedule: overview.hasOwnSchedule,
      days: overview.days,
      weeks: overview.weeks,
    };
  }

  // ---------------------------------------------------------------- preview & publish

  public async preview(employeeId: string, input: EmployeeScheduleDraftDto) {
    await this.findEmployee(employeeId);
    const draft = this.draftVersion(input);
    return this.evaluateDraft(employeeId, draft);
  }

  public async publish(
    actor: AuthenticatedUser,
    employeeId: string,
    input: PublishEmployeeScheduleDto,
    context: ClientContext,
  ) {
    const employee = await this.findEmployee(employeeId);
    const today = this.today();
    if (input.effectiveDate < today) {
      throw new BadRequestException({
        code: 'SCHEDULE_IN_THE_PAST',
        message:
          'A escala só pode começar hoje ou numa data futura. O histórico de ponto já registrado não muda.',
      });
    }
    const draft = this.draftVersion(input);
    const evaluation = await this.evaluateDraft(employeeId, draft);
    const errors = evaluation.issues.filter((issue) => issue.severity === 'ERROR');
    if (errors.length > 0 && input.confirmIssues !== true) {
      throw new UnprocessableEntityException({
        code: 'SCHEDULE_COMPLIANCE_ISSUES',
        message: `A escala tem ${errors.length} ${errors.length === 1 ? 'problema' : 'problemas'} de jornada. Revise ou confirme que deseja publicar assim.`,
        details: issueDetails(evaluation.issues),
      });
    }

    const created = await this.prisma.$transaction(
      async (tx) => {
        const existing = await tx.employeeScheduleVersion.findUnique({
          where: {
            employeeId_effectiveDate: {
              employeeId,
              effectiveDate: businessDateToDatabaseDate(input.effectiveDate),
            },
          },
          select: { id: true },
        });
        if (existing !== null) {
          if (input.effectiveDate <= today) {
            throw new ConflictException({
              code: 'SCHEDULE_ALREADY_STARTED',
              message:
                'Já existe uma escala começando hoje para este colaborador. Escolha a partir de amanhã.',
            });
          }
          // A future version that has not taken effect can still be replaced.
          await tx.employeeScheduleDay.deleteMany({ where: { versionId: existing.id } });
          await tx.employeeScheduleVersion.delete({ where: { id: existing.id } });
        }

        const version = await tx.employeeScheduleVersion.create({
          data: {
            employeeId,
            effectiveDate: businessDateToDatabaseDate(draft.effectiveDate),
            usesCompanySchedule: draft.usesCompanySchedule,
            cycleWeeks: draft.cycleWeeks,
            cycleAnchorDate: businessDateToDatabaseDate(draft.cycleAnchorDate),
            note: input.note?.trim() || null,
            createdById: actor.id,
            days: { create: draft.days.map((day) => ({ ...day })) },
          },
          select: { id: true },
        });

        await this.audit.record(
          {
            actorId: actor.id,
            action: AuditAction.EMPLOYEE_SCHEDULE_PUBLISHED,
            targetType: AuditTargetType.EMPLOYEE_SCHEDULE,
            targetId: version.id,
            ...context,
            afterState: {
              employeeId,
              employeeName: employee.name,
              effectiveDate: draft.effectiveDate,
              usesCompanySchedule: draft.usesCompanySchedule,
              cycleWeeks: draft.cycleWeeks,
              replacedFutureVersion: existing?.id ?? null,
              confirmedIssues: errors.map((issue) => issue.message).join(' | ') || null,
            },
          },
          tx,
        );
        return version;
      },
      { isolationLevel: 'Serializable' },
    );

    return { id: created.id, ...evaluation };
  }

  // ---------------------------------------------------------------- one-day changes

  public async createAdjustment(
    actor: AuthenticatedUser,
    input: CreateScheduleAdjustmentDto,
    context: ClientContext,
  ) {
    const employee = await this.findEmployee(input.employeeId);
    if (input.businessDate < this.today()) {
      throw new BadRequestException({
        code: 'SCHEDULE_IN_THE_PAST',
        message: 'Ajustes de escala só podem ser feitos para hoje ou datas futuras.',
      });
    }
    const shift = shiftFromInput(input, dateBR(input.businessDate));
    const newErrors = await this.assertCompliantChange(
      employee,
      [
        {
          id: 'sim-adjustment',
          businessDate: input.businessDate,
          isWorkday: shift !== null,
          startMinute: shift?.startMinute ?? null,
          endMinute: shift?.endMinute ?? null,
          breakStartMinute: shift?.breakStartMinute ?? null,
          breakEndMinute: shift?.breakEndMinute ?? null,
          reason: 'ADJUSTMENT',
          note: input.note,
        },
      ],
      input.confirmIssues === true,
      'O ajuste deixa a jornada fora das regras. Revise ou confirme que deseja salvar assim.',
    );
    const override = await this.prisma.$transaction(
      async (tx) => {
        await this.assertNoActiveOverride(tx, input.employeeId, [input.businessDate]);
        const created = await tx.scheduleOverride.create({
          data: {
            employeeId: input.employeeId,
            businessDate: businessDateToDatabaseDate(input.businessDate),
            ...this.shiftColumns(shift),
            reason: ScheduleOverrideReason.ADJUSTMENT,
            note: input.note,
            createdById: actor.id,
          },
          select: { id: true },
        });
        await this.audit.record(
          {
            actorId: actor.id,
            action: AuditAction.SCHEDULE_OVERRIDE_CREATED,
            targetType: AuditTargetType.SCHEDULE_OVERRIDE,
            targetId: created.id,
            ...context,
            afterState: {
              employeeId: input.employeeId,
              employeeName: employee.name,
              businessDate: input.businessDate,
              reason: 'ADJUSTMENT',
              isWorkday: shift !== null,
              note: input.note,
              confirmedIssues: newErrors.map((issue) => issue.message).join(' | ') || null,
            },
          },
          tx,
        );
        return created;
      },
      { isolationLevel: 'Serializable' },
    );
    return { ids: [override.id] };
  }

  /** Troca de folga: the rest day becomes a workday and a workday becomes the new rest day. */
  public async moveRestDay(
    actor: AuthenticatedUser,
    input: MoveRestDayDto,
    context: ClientContext,
  ) {
    const employee = await this.findEmployee(input.employeeId);
    const today = this.today();
    if (input.restDate < today || input.newRestDate < today) {
      throw new BadRequestException({
        code: 'SCHEDULE_IN_THE_PAST',
        message: 'A troca de folga só pode envolver hoje ou datas futuras.',
      });
    }
    if (input.restDate === input.newRestDate) {
      throw new BadRequestException({
        code: 'INVALID_SWAP',
        message: 'Escolha dois dias diferentes.',
      });
    }
    if (Math.abs(daysBetween(input.restDate, input.newRestDate)) > 31) {
      throw new BadRequestException({
        code: 'INVALID_SWAP',
        message: 'Os dois dias da troca precisam estar a no máximo 31 dias um do outro.',
      });
    }

    const first = input.restDate < input.newRestDate ? input.restDate : input.newRestDate;
    const last = input.restDate < input.newRestDate ? input.newRestDate : input.restDate;
    const [settings, calendar] = await Promise.all([
      this.getSettings(),
      this.loadCalendar([input.employeeId], first, last),
    ]);
    const current = this.buildRow(
      input.employeeId,
      this.firstWorkDate(employee),
      calendar,
      first,
      last,
      settings,
    );
    const restCell = current.days.find((day) => day.businessDate === input.restDate);
    const workCell = current.days.find((day) => day.businessDate === input.newRestDate);
    if (restCell?.status !== 'REST') {
      throw new BadRequestException({
        code: 'INVALID_SWAP',
        message: `${dateBR(input.restDate)} não é um dia de folga de ${employee.name}.`,
      });
    }
    if (
      workCell?.status !== 'WORK' ||
      workCell.startMinute === null ||
      workCell.endMinute === null
    ) {
      throw new BadRequestException({
        code: 'INVALID_SWAP',
        message: `${dateBR(input.newRestDate)} não é um dia de trabalho de ${employee.name}.`,
      });
    }
    const movedShift: Shift = {
      startMinute: workCell.startMinute,
      endMinute: workCell.endMinute,
      breakStartMinute: workCell.breakStartMinute,
      breakEndMinute: workCell.breakEndMinute,
    };

    const swapId = randomUUID();
    const simulated: EmployeeScheduleOverrideInput[] = [
      {
        id: 'sim-a',
        businessDate: input.restDate,
        isWorkday: true,
        ...movedShift,
        reason: 'SWAP',
        note: input.note,
      },
      {
        id: 'sim-b',
        businessDate: input.newRestDate,
        isWorkday: false,
        startMinute: null,
        endMinute: null,
        breakStartMinute: null,
        breakEndMinute: null,
        reason: 'SWAP',
        note: input.note,
      },
    ];
    const newErrors = await this.assertCompliantChange(
      employee,
      simulated,
      input.confirmIssues === true,
      'A troca deixa a jornada fora das regras. Revise ou confirme que deseja trocar assim.',
    );

    const ids = await this.prisma.$transaction(
      async (tx) => {
        await this.assertNoActiveOverride(tx, input.employeeId, [
          input.restDate,
          input.newRestDate,
        ]);
        const createdIds: string[] = [];
        for (const item of simulated) {
          const created = await tx.scheduleOverride.create({
            data: {
              employeeId: input.employeeId,
              businessDate: businessDateToDatabaseDate(item.businessDate),
              isWorkday: item.isWorkday,
              startMinute: item.startMinute,
              endMinute: item.endMinute,
              breakStartMinute: item.breakStartMinute,
              breakEndMinute: item.breakEndMinute,
              reason: ScheduleOverrideReason.SWAP,
              swapId,
              note: input.note,
              createdById: actor.id,
            },
            select: { id: true },
          });
          createdIds.push(created.id);
        }
        await this.audit.record(
          {
            actorId: actor.id,
            action: AuditAction.SCHEDULE_OVERRIDE_CREATED,
            targetType: AuditTargetType.SCHEDULE_OVERRIDE,
            targetId: createdIds[0]!,
            ...context,
            afterState: {
              employeeId: input.employeeId,
              employeeName: employee.name,
              reason: 'SWAP',
              swapId,
              restDate: input.restDate,
              newRestDate: input.newRestDate,
              note: input.note,
              confirmedIssues: newErrors.map((issue) => issue.message).join(' | ') || null,
            },
          },
          tx,
        );
        return createdIds;
      },
      { isolationLevel: 'Serializable' },
    );
    return { ids, swapId };
  }

  /**
   * Simulates one-day changes and refuses (422) when they create a compliance error that was
   * not there before, unless the administrator confirmed. Returns the new errors it accepted.
   */
  private async assertCompliantChange(
    employee: { id: string; createdAt: Date },
    simulated: EmployeeScheduleOverrideInput[],
    confirmed: boolean,
    message: string,
  ) {
    const dates = simulated.map((item) => item.businessDate).sort();
    const computeFrom = addDays(mondayOf(dates[0]!), -7);
    const computeTo = addDays(mondayOf(dates[dates.length - 1]!), 13);
    const [settings, calendar] = await Promise.all([
      this.getSettings(),
      this.loadCalendar([employee.id], computeFrom, computeTo),
    ]);
    const startDate = this.firstWorkDate(employee);
    const before = this.buildRow(
      employee.id,
      startDate,
      calendar,
      computeFrom,
      computeTo,
      settings,
    );
    const layer = calendar.layers.get(employee.id) ?? { versions: [], overrides: [] };
    calendar.layers.set(employee.id, {
      versions: layer.versions,
      overrides: [...layer.overrides, ...simulated],
    });
    const after = this.buildRow(employee.id, startDate, calendar, computeFrom, computeTo, settings);
    const newErrors = after.issues.filter(
      (issue) =>
        issue.severity === 'ERROR' &&
        !before.issues.some(
          (old) => old.code === issue.code && old.businessDate === issue.businessDate,
        ),
    );
    if (newErrors.length > 0 && !confirmed) {
      throw new UnprocessableEntityException({
        code: 'SCHEDULE_COMPLIANCE_ISSUES',
        message,
        details: issueDetails(newErrors),
      });
    }
    return newErrors;
  }

  public async revokeOverride(
    actor: AuthenticatedUser,
    overrideId: string,
    reason: string,
    context: ClientContext,
  ) {
    return this.prisma.$transaction(
      async (tx) => {
        const override = await tx.scheduleOverride.findUnique({
          where: { id: overrideId },
          select: { id: true, swapId: true, revokedAt: true, employeeId: true, businessDate: true },
        });
        if (override === null) {
          throw new NotFoundException({
            code: 'RESOURCE_NOT_FOUND',
            message: 'Ajuste de escala não encontrado.',
          });
        }
        if (override.revokedAt !== null) {
          throw new ConflictException({
            code: 'ALREADY_REVOKED',
            message: 'Este ajuste já foi cancelado.',
          });
        }
        const targets = override.swapId
          ? await tx.scheduleOverride.findMany({
              where: { swapId: override.swapId, revokedAt: null },
              select: { id: true, businessDate: true },
            })
          : [{ id: override.id, businessDate: override.businessDate }];
        const now = this.clock();
        await tx.scheduleOverride.updateMany({
          where: { id: { in: targets.map((target) => target.id) } },
          data: { revokedAt: now, revokedById: actor.id, revokeReason: reason },
        });
        await this.audit.record(
          {
            actorId: actor.id,
            action: AuditAction.SCHEDULE_OVERRIDE_REVOKED,
            targetType: AuditTargetType.SCHEDULE_OVERRIDE,
            targetId: override.id,
            ...context,
            afterState: {
              employeeId: override.employeeId,
              revokedIds: targets.map((target) => target.id).join(','),
              dates: targets
                .map((target) => databaseDateToBusinessDate(target.businessDate))
                .join(','),
              reason,
            },
          },
          tx,
        );
        return { revokedIds: targets.map((target) => target.id) };
      },
      { isolationLevel: 'Serializable' },
    );
  }

  // ---------------------------------------------------------------- internals

  private assertRange(from: string, to: string): void {
    if (from > to) {
      throw new BadRequestException({
        code: 'INVALID_DATE_RANGE',
        message: 'A data inicial deve ser anterior ou igual à data final.',
      });
    }
    if (daysBetween(from, to) + 1 > MAX_RANGE_DAYS) {
      throw new BadRequestException({
        code: 'INVALID_DATE_RANGE',
        message: `Consulte no máximo ${MAX_RANGE_DAYS} dias por vez.`,
      });
    }
  }

  private async findEmployee(employeeId: string) {
    const employee = await this.prisma.user.findFirst({
      where: { id: employeeId, role: UserRole.EMPLOYEE },
      select: {
        id: true,
        name: true,
        createdAt: true,
        employeeProfile: { select: { hireDate: true } },
      },
    });
    if (employee === null) {
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'Colaborador não encontrado.',
      });
    }
    return employee;
  }

  /** Same rule as attendance: days before the account existed are not expected. */
  private firstWorkDate(employee: { createdAt: Date }): string {
    return businessDateFromInstant(employee.createdAt);
  }

  private async assertNoActiveOverride(
    tx: Prisma.TransactionClient,
    employeeId: string,
    dates: string[],
  ): Promise<void> {
    const existing = await tx.scheduleOverride.findFirst({
      where: {
        employeeId,
        revokedAt: null,
        businessDate: { in: dates.map(businessDateToDatabaseDate) },
      },
      select: { businessDate: true },
    });
    if (existing !== null) {
      throw new ConflictException({
        code: 'SCHEDULE_OVERRIDE_EXISTS',
        message: `Já existe uma troca ou ajuste em ${dateBR(databaseDateToBusinessDate(existing.businessDate))}. Cancele-o antes de fazer outro.`,
      });
    }
  }

  private shiftColumns(shift: Shift | null) {
    return {
      isWorkday: shift !== null,
      startMinute: shift?.startMinute ?? null,
      endMinute: shift?.endMinute ?? null,
      breakStartMinute: shift?.breakStartMinute ?? null,
      breakEndMinute: shift?.breakEndMinute ?? null,
    };
  }

  private draftVersion(input: EmployeeScheduleDraftDto): EmployeeScheduleVersionInput {
    const anchor = mondayOf(input.effectiveDate);
    if (input.usesCompanySchedule === true) {
      return {
        id: 'draft',
        effectiveDate: input.effectiveDate,
        usesCompanySchedule: true,
        cycleWeeks: 1,
        cycleAnchorDate: anchor,
        days: [],
      };
    }
    const weeks = input.weeks ?? [];
    if (weeks.length === 0) {
      throw new BadRequestException({
        code: 'INVALID_SCHEDULE',
        message: 'Informe os dias de trabalho e de folga da escala.',
      });
    }
    const days: EmployeeScheduleDayInput[] = [];
    weeks.forEach((week, cycleWeek) => {
      const seen = new Set<Weekday>();
      for (const day of week.days) {
        if (seen.has(day.weekday)) {
          throw new BadRequestException({
            code: 'INVALID_SCHEDULE',
            message: `${WEEKDAY_LABELS[day.weekday]} aparece duas vezes na semana ${cycleWeek + 1}.`,
          });
        }
        seen.add(day.weekday);
        const label =
          weeks.length > 1
            ? `${WEEKDAY_LABELS[day.weekday]} (semana ${cycleWeek + 1})`
            : WEEKDAY_LABELS[day.weekday];
        const shift = shiftFromInput(day, label);
        days.push({ cycleWeek, weekday: day.weekday, ...this.shiftColumns(shift) });
      }
    });
    if (!days.some((day) => day.isWorkday)) {
      throw new BadRequestException({
        code: 'INVALID_SCHEDULE',
        message: 'A escala precisa ter pelo menos um dia de trabalho.',
      });
    }
    return {
      id: 'draft',
      effectiveDate: input.effectiveDate,
      usesCompanySchedule: false,
      cycleWeeks: weeks.length,
      cycleAnchorDate: anchor,
      days,
    };
  }

  private async evaluateDraft(employeeId: string, draft: EmployeeScheduleVersionInput) {
    const computeFrom = mondayOf(draft.effectiveDate);
    const computeTo = addDays(computeFrom, PREVIEW_WEEKS * 7 - 1);
    const employee = await this.findEmployee(employeeId);
    const [settings, calendar] = await Promise.all([
      this.getSettings(),
      this.loadCalendar([employeeId], computeFrom, computeTo),
    ]);
    const layer = calendar.layers.get(employeeId) ?? { versions: [], overrides: [] };
    // The draft replaces a version on the same date and is followed by any later version.
    calendar.layers.set(employeeId, {
      versions: [
        ...layer.versions.filter((version) => version.effectiveDate !== draft.effectiveDate),
        draft,
      ],
      overrides: layer.overrides,
    });
    const row = this.buildRow(
      employeeId,
      this.firstWorkDate(employee),
      calendar,
      computeFrom,
      computeTo,
      settings,
    );
    return {
      effectiveDate: draft.effectiveDate,
      days: row.days,
      weeks: row.weeks,
      issues: row.issues.filter((issue) => issue.businessDate >= computeFrom),
    };
  }

  private async loadCalendar(
    employeeIds: string[],
    from: string,
    to: string,
  ): Promise<CalendarData> {
    return this.prisma.$transaction(
      async (tx) => {
        const [schedules, exceptions, vacations, justifications, layers] = await Promise.all([
          tx.businessScheduleVersion.findMany({
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
          tx.calendarException.findMany({
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
          employeeIds.length === 0
            ? []
            : tx.vacation.findMany({
                where: {
                  employeeId: { in: employeeIds },
                  startDate: { lte: businessDateToDatabaseDate(to) },
                  endDate: { gte: businessDateToDatabaseDate(from) },
                },
                select: { id: true, employeeId: true, startDate: true, endDate: true, note: true },
              }),
          employeeIds.length === 0
            ? []
            : tx.absenceJustification.findMany({
                where: {
                  employeeId: { in: employeeIds },
                  revokedAt: null,
                  startDate: { lte: businessDateToDatabaseDate(to) },
                  endDate: { gte: businessDateToDatabaseDate(from) },
                },
                select: {
                  employeeId: true,
                  kind: true,
                  reason: true,
                  startDate: true,
                  endDate: true,
                },
              }),
          loadEmployeeScheduleLayers(tx, employeeIds, from, to),
        ]);
        return {
          scheduleVersions: schedules.map((schedule) => ({
            id: schedule.id,
            effectiveDate: databaseDateToBusinessDate(schedule.effectiveDate),
            days: schedule.days.map((day) => ({ ...day, weekday: day.weekday as Weekday })),
          })),
          exceptionRevisions: exceptions.flatMap((exception) =>
            exception.revisions.map((revision) => ({
              ...revision,
              businessDate: databaseDateToBusinessDate(exception.businessDate),
            })),
          ),
          vacations: vacations.map((vacation) => ({
            ...vacation,
            startDate: databaseDateToBusinessDate(vacation.startDate),
            endDate: databaseDateToBusinessDate(vacation.endDate),
          })),
          justifications: justifications.map((justification) => ({
            ...justification,
            startDate: databaseDateToBusinessDate(justification.startDate),
            endDate: databaseDateToBusinessDate(justification.endDate),
          })),
          layers,
        };
      },
      { isolationLevel: 'RepeatableRead', maxWait: 5_000, timeout: 15_000 },
    );
  }

  private companyExpectation(
    calendar: CalendarData,
    businessDate: string,
    withExceptions = true,
  ): ResolvedExpectation | null {
    try {
      return resolveExpectation({
        businessDate,
        scheduleVersions: calendar.scheduleVersions,
        exceptionRevisions: withExceptions ? calendar.exceptionRevisions : [],
      });
    } catch {
      return null; // no company schedule yet on that date
    }
  }

  private buildRow(
    employeeId: string,
    firstWorkDate: string,
    calendar: CalendarData,
    from: string,
    to: string,
    settings: WorkRegimeSettings,
  ): {
    hasOwnSchedule: boolean;
    days: ScheduleCell[];
    weeks: WeekTotal[];
    issues: ComplianceIssue[];
  } {
    const layer = calendar.layers.get(employeeId) ?? EMPTY_SCHEDULE_LAYER;
    const dates = enumerateDates(from, to);
    const options = {
      hasCollectiveAgreement: settings.hasCollectiveAgreement === true,
      sundayRestEveryWeeks: settings.sundayRestEveryWeeks,
    };
    const holidays = new Set<string>();
    const unplannable = new Set<string>(); // vacation, abono, atestado, before hiring
    const planned: PlannedDay[] = [];
    let hasOwnSchedule = false;

    const days = dates.map((businessDate): ScheduleCell => {
      const weekday = weekdayForBusinessDate(businessDate);
      const plan = planEmployeeDay(layer.versions, layer.overrides, businessDate);
      const version = selectEmployeeScheduleVersion(layer.versions, businessDate);
      if (version !== null && !version.usesCompanySchedule) hasOwnSchedule = true;
      const vacation = calendar.vacations.find(
        (item) =>
          item.employeeId === employeeId && within(businessDate, item.startDate, item.endDate),
      );
      const justification = calendar.justifications.find(
        (item) =>
          item.employeeId === employeeId && within(businessDate, item.startDate, item.endDate),
      );
      const company = this.companyExpectation(calendar, businessDate);
      const weekly = this.companyExpectation(calendar, businessDate, false);

      // What the escala itself plans (holidays aside) feeds the labour-law checks.
      const plannedShift: Shift | null =
        plan !== null
          ? plan.shift
          : weekly !== null &&
              weekly.isOpen &&
              weekly.openingMinute !== null &&
              weekly.closingMinute !== null
            ? {
                startMinute: weekly.openingMinute,
                endMinute: weekly.closingMinute,
                breakStartMinute: weekly.lunchEnabled ? weekly.lunchStartMinute : null,
                breakEndMinute: weekly.lunchEnabled ? weekly.lunchEndMinute : null,
              }
            : null;

      const empty = {
        businessDate,
        weekday,
        startMinute: null,
        endMinute: null,
        breakStartMinute: null,
        breakEndMinute: null,
        plannedMinutes: 0,
        overrideId: plan?.overrideId ?? null,
        overrideReason: plan?.overrideId
          ? (layer.overrides.find((item) => item.id === plan.overrideId)?.reason ?? null)
          : null,
      };

      if (businessDate < firstWorkDate || company === null) {
        unplannable.add(businessDate);
        planned.push(this.plannedDay(businessDate, weekday, null));
        return { ...empty, status: 'NOT_HIRED', source: 'WEEKLY_SCHEDULE', label: null };
      }

      let expectation = applyEmployeeScheduleLayer(
        vacation
          ? resolveExpectation({
              businessDate,
              scheduleVersions: calendar.scheduleVersions,
              exceptionRevisions: calendar.exceptionRevisions,
              vacation,
            })
          : company,
        plan,
      );
      if (justification && expectation.isOpen) {
        expectation = applyAbsenceJustification(expectation, {
          kind: justification.kind,
          reason: justification.reason,
        });
      }

      const isHoliday = expectation.source === 'HOLIDAY' || expectation.source === 'CLOSED';
      if (isHoliday) holidays.add(businessDate);
      const isAbsence =
        expectation.calendarStatus === 'VACATION' ||
        expectation.calendarStatus === 'ALLOWANCE' ||
        expectation.calendarStatus === 'MEDICAL_LEAVE';
      if (isAbsence) unplannable.add(businessDate);
      planned.push(
        this.plannedDay(businessDate, weekday, isHoliday || isAbsence ? null : plannedShift),
      );

      let status: ScheduleCellStatus;
      if (expectation.calendarStatus === 'VACATION') status = 'VACATION';
      else if (expectation.calendarStatus === 'ALLOWANCE') status = 'ALLOWANCE';
      else if (expectation.calendarStatus === 'MEDICAL_LEAVE') status = 'MEDICAL_LEAVE';
      else if (expectation.source === 'HOLIDAY') status = 'HOLIDAY';
      else if (expectation.source === 'CLOSED') status = 'CLOSED';
      else status = expectation.isOpen ? 'WORK' : 'REST';

      if (status !== 'WORK') {
        return { ...empty, status, source: expectation.source, label: expectation.exceptionName };
      }
      return {
        ...empty,
        status,
        startMinute: expectation.openingMinute,
        endMinute: expectation.closingMinute,
        breakStartMinute: expectation.lunchEnabled ? expectation.lunchStartMinute : null,
        breakEndMinute: expectation.lunchEnabled ? expectation.lunchEndMinute : null,
        plannedMinutes: expectation.expectedMinutes,
        source: expectation.source,
        label: expectation.exceptionName,
      };
    });

    const weekHasGap = (monday: string) =>
      Array.from({ length: 7 }, (_, offset) => addDays(monday, offset)).some((date) =>
        unplannable.has(date),
      );
    const issues = checkCompliance(planned, { ...options, holidays }).filter((issue) => {
      if (unplannable.has(issue.businessDate)) return false;
      const weekly =
        issue.code === 'WEEKLY_HOURS_EXCEEDED' || issue.code === 'NOT_ENOUGH_REST_DAYS';
      return !(weekly && weekHasGap(issue.businessDate));
    });

    const weeks: WeekTotal[] = [];
    for (let index = 0; index + 7 <= days.length; index += 7) {
      const slice = days.slice(index, index + 7);
      const weekStart = slice[0]!.businessDate;
      if (weekdayForBusinessDate(weekStart) !== 'MONDAY') continue;
      const limits = effectiveLimits(weekStart, options);
      weeks.push({
        weekStart,
        plannedMinutes: slice.reduce((sum, day) => sum + day.plannedMinutes, 0),
        restDays: slice.filter((day) => day.status === 'REST').length,
        weeklyLimitMinutes: limits.weeklyLimitMinutes,
        regimeLabel: limits.regime.label,
      });
    }

    return { hasOwnSchedule, days, weeks, issues };
  }

  private plannedDay(businessDate: string, weekday: Weekday, shift: Shift | null): PlannedDay {
    return {
      businessDate,
      weekday,
      shift,
      plannedMinutes: shiftMinutes(shift),
      source: 'PATTERN',
      cycleWeek: 0,
      override: null,
    };
  }
}
