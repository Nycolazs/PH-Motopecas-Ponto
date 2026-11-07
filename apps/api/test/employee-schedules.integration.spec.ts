import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { AppModule } from '../src/app.module.js';
import { ATTENDANCE_CLOCK } from '../src/attendance/attendance-clock.js';
import { PasswordService } from '../src/auth/password.service.js';
import { configureApplication } from '../src/bootstrap.js';
import { PrismaService } from '../src/database/prisma.service.js';
import { UserRole, Weekday } from '../src/generated/prisma/client.js';
import { TIME_PUNCH_CLOCK } from '../src/time-punches/clock.js';
import { clearApplicationData } from './database-test-helpers.js';

const PASSWORD = 'schedule-test-password';
// Monday 2026-12-21, 12:00 in São Paulo: after the EC 141 transition (40 h, 2 rest days).
const NOW = new Date('2026-12-21T15:00:00.000Z');

const WEEKDAYS: Weekday[] = [
  Weekday.MONDAY,
  Weekday.TUESDAY,
  Weekday.WEDNESDAY,
  Weekday.THURSDAY,
  Weekday.FRIDAY,
  Weekday.SATURDAY,
  Weekday.SUNDAY,
];

/** Today's store: Mon–Fri 08–17 (lunch 12–13), Saturday 08–12, closed Sunday (44 h, 6x1). */
function storeSchedule() {
  return WEEKDAYS.map((weekday) => {
    if (weekday === Weekday.SUNDAY) {
      return {
        weekday,
        isOpen: false,
        openingMinute: null,
        closingMinute: null,
        lunchEnabled: false,
        lunchStartMinute: null,
        lunchEndMinute: null,
      };
    }
    if (weekday === Weekday.SATURDAY) {
      return {
        weekday,
        isOpen: true,
        openingMinute: 480,
        closingMinute: 720,
        lunchEnabled: false,
        lunchStartMinute: null,
        lunchEndMinute: null,
      };
    }
    return {
      weekday,
      isOpen: true,
      openingMinute: 480,
      closingMinute: 1_020,
      lunchEnabled: true,
      lunchStartMinute: 720,
      lunchEndMinute: 780,
    };
  });
}

const WORK = {
  isWorkday: true,
  startMinute: 480,
  endMinute: 1_020,
  breakStartMinute: 720,
  breakEndMinute: 780,
};
const OFF = { isWorkday: false };

/** One week with the given rest days; every other day 08–17 with lunch (8 h). */
function week(rest: Weekday[]) {
  return {
    days: WEEKDAYS.map((weekday) => ({ weekday, ...(rest.includes(weekday) ? OFF : WORK) })),
  };
}

describe('escala do colaborador (5x2) with real PostgreSQL', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let passwordHash: string;
  let adminId: string;
  let employeeId: string;
  let colleagueId: string;
  let adminToken: string;
  let employeeToken: string;

  const http = () => request(app.getHttpServer());
  const asAdmin = <T extends request.Test>(test: T) => test.auth(adminToken, { type: 'bearer' });
  const asEmployee = <T extends request.Test>(test: T) =>
    test.auth(employeeToken, { type: 'bearer' });

  beforeAll(async () => {
    const moduleReference = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(ATTENDANCE_CLOCK)
      .useValue(() => NOW)
      .overrideProvider(TIME_PUNCH_CLOCK)
      .useValue(() => NOW)
      .compile();
    app = moduleReference.createNestApplication<NestExpressApplication>();
    configureApplication(app);
    await app.init();
    prisma = app.get(PrismaService);
    passwordHash = await app.get(PasswordService).hash(PASSWORD);
  });

  beforeEach(async () => {
    await clearApplicationData(prisma);
    const createdAt = new Date('2025-01-01T00:00:00.000Z');
    const user = (name: string, login: string, role: UserRole) =>
      prisma.user.create({
        data: { name, login, normalizedLogin: login, passwordHash, role, createdAt },
      });
    const [admin, employee, colleague] = await Promise.all([
      user('Gestora', 'gestora', UserRole.ADMIN),
      user('Ana Escala', 'ana', UserRole.EMPLOYEE),
      user('Bruno Equipe', 'bruno', UserRole.EMPLOYEE),
    ]);
    adminId = admin.id;
    employeeId = employee.id;
    colleagueId = colleague.id;
    await prisma.businessScheduleVersion.create({
      data: {
        effectiveDate: new Date('2025-01-01T00:00:00.000Z'),
        createdById: admin.id,
        days: { create: storeSchedule() },
      },
    });
    const login = async (name: string) =>
      (await http().post('/auth/login').send({ login: name, password: PASSWORD }).expect(200)).body
        .accessToken as string;
    adminToken = await login('gestora');
    employeeToken = await login('ana');
  });

  afterAll(async () => {
    await clearApplicationData(prisma);
    await app.close();
  });

  const team = (from = '2026-12-21', to = '2026-12-27') =>
    asAdmin(http().get('/employee-schedules/team').query({ from, to }));

  it('flags the old 6x1 week after the transition and shows the team grid', async () => {
    const response = await team().expect(200);
    expect(response.body.employees).toHaveLength(2);
    const ana = response.body.employees.find((row: { name: string }) => row.name === 'Ana Escala');
    expect(ana.hasOwnSchedule).toBe(false);
    expect(ana.days).toHaveLength(7);
    expect(ana.weeks[0]).toMatchObject({ plannedMinutes: 44 * 60, restDays: 1 });
    const codes = ana.issues.map((issue: { code: string }) => issue.code);
    expect(codes).toEqual(
      expect.arrayContaining(['NOT_ENOUGH_REST_DAYS', 'WEEKLY_HOURS_EXCEEDED']),
    );
    const sunday = response.body.coverage.find(
      (day: { businessDate: string }) => day.businessDate === '2026-12-27',
    );
    expect(sunday).toMatchObject({ working: 0, storeOpen: false, belowMinimum: false });
  });

  it('previews and publishes a 5x2 escala, blocking an illegal one until confirmed', async () => {
    const fiveByTwo = {
      effectiveDate: '2026-12-21',
      weeks: [week([Weekday.WEDNESDAY, Weekday.SUNDAY])],
    };
    const preview = await asAdmin(http().post(`/employee-schedules/${employeeId}/preview`))
      .send(fiveByTwo)
      .expect(201);
    expect(preview.body.issues.filter((i: { severity: string }) => i.severity === 'ERROR')).toEqual(
      [],
    );
    expect(preview.body.weeks[0]).toMatchObject({ plannedMinutes: 40 * 60, restDays: 2 });

    await asAdmin(http().post(`/employee-schedules/${employeeId}/versions`))
      .send(fiveByTwo)
      .expect(201);

    // Six workdays (44 h) from next week: rejected with the reasons, accepted when confirmed.
    const sixByOne = { effectiveDate: '2026-12-28', weeks: [week([Weekday.SUNDAY])] };
    const rejected = await asAdmin(http().post(`/employee-schedules/${employeeId}/versions`))
      .send(sixByOne)
      .expect(422);
    expect(rejected.body.code).toBe('SCHEDULE_COMPLIANCE_ISSUES');
    expect(JSON.stringify(rejected.body)).toContain('NOT_ENOUGH_REST_DAYS');
    await asAdmin(http().post(`/employee-schedules/${employeeId}/versions`))
      .send({ ...sixByOne, confirmIssues: true })
      .expect(201);
    // A version that has not started yet can be replaced on the same date.
    await asAdmin(http().post(`/employee-schedules/${employeeId}/versions`))
      .send({ ...sixByOne, weeks: [week([Weekday.MONDAY, Weekday.SUNDAY])] })
      .expect(201);
    // Today's version cannot be replaced (history is append-only), the past is refused.
    await asAdmin(http().post(`/employee-schedules/${employeeId}/versions`))
      .send(fiveByTwo)
      .expect(409);
    await asAdmin(http().post(`/employee-schedules/${employeeId}/versions`))
      .send({ ...fiveByTwo, effectiveDate: '2026-12-20' })
      .expect(400);

    const overview = await asAdmin(http().get(`/employee-schedules/${employeeId}`))
      .query({ from: '2026-12-21', to: '2027-01-03' })
      .expect(200);
    expect(overview.body.hasOwnSchedule).toBe(true);
    expect(overview.body.versions).toHaveLength(2);
    const statusOf = (date: string) =>
      overview.body.days.find((day: { businessDate: string }) => day.businessDate === date).status;
    expect(statusOf('2026-12-23')).toBe('REST'); // Wednesday, first escala
    expect(statusOf('2026-12-26')).toBe('WORK'); // Saturday 08–17
    expect(statusOf('2026-12-28')).toBe('REST'); // Monday, replaced future version
    expect(statusOf('2026-12-30')).toBe('WORK'); // Wednesday, second escala
    const versions = await prisma.employeeScheduleVersion.count({ where: { employeeId } });
    expect(versions).toBe(2);
  });

  it('validates the shape of an escala in plain Portuguese', async () => {
    const bad = await asAdmin(http().post(`/employee-schedules/${employeeId}/preview`))
      .send({
        effectiveDate: '2026-12-21',
        weeks: [
          {
            days: WEEKDAYS.map((weekday) => ({
              weekday,
              ...(weekday === Weekday.MONDAY ? { ...WORK, breakStartMinute: 300 } : WORK),
            })),
          },
        ],
      })
      .expect(400);
    expect(bad.body.message).toContain('Segunda');
    await asAdmin(http().post(`/employee-schedules/${employeeId}/preview`))
      .send({ effectiveDate: '2026-12-21', weeks: [week(WEEKDAYS)] })
      .expect(400);
  });

  it('uses the escala in the daily attendance and the timesheet', async () => {
    // An escala that started in the past (created directly: the API only accepts today or later).
    await prisma.employeeScheduleVersion.create({
      data: {
        employeeId,
        effectiveDate: new Date('2026-12-07T00:00:00.000Z'),
        cycleWeeks: 1,
        cycleAnchorDate: new Date('2026-12-07T00:00:00.000Z'),
        createdById: adminId,
        days: {
          create: week([Weekday.WEDNESDAY, Weekday.SUNDAY]).days.map((day) => ({
            cycleWeek: 0,
            weekday: day.weekday,
            isWorkday: day.isWorkday,
            startMinute: day.isWorkday ? 480 : null,
            endMinute: day.isWorkday ? 1_020 : null,
            breakStartMinute: day.isWorkday ? 720 : null,
            breakEndMinute: day.isWorkday ? 780 : null,
          })),
        },
      },
    });

    const day = (date: string) =>
      asAdmin(http().get(`/attendance/employees/${employeeId}/day`))
        .query({ date })
        .expect(200);
    const wednesday = await day('2026-12-09');
    expect(wednesday.body).toMatchObject({ expectedMinutes: 0, status: 'DAY_OFF' });
    const saturday = await day('2026-12-12');
    expect(saturday.body.expectedMinutes).toBe(480); // the store's Saturday is 4 h
    const colleagueSaturday = await asAdmin(http().get(`/attendance/employees/${colleagueId}/day`))
      .query({ date: '2026-12-12' })
      .expect(200);
    expect(colleagueSaturday.body.expectedMinutes).toBe(240);

    const report = await asAdmin(http().get('/attendance/reports/timesheets'))
      .query({ from: '2026-12-07', to: '2026-12-13', employeeId, includeDays: true })
      .expect(200);
    const row = report.body.employees[0];
    expect(row.totals.expectedMinutes).toBe(5 * 480);
    const folga = row.days.find(
      (item: { businessDate: string }) => item.businessDate === '2026-12-09',
    );
    expect(folga).toMatchObject({ status: 'DAY_OFF', expectedMinutes: 0 });
  });

  it('moves a rest day (troca de folga), then cancels it', async () => {
    await asAdmin(http().post(`/employee-schedules/${employeeId}/versions`))
      .send({ effectiveDate: '2026-12-21', weeks: [week([Weekday.WEDNESDAY, Weekday.SUNDAY])] })
      .expect(201);

    // Wrong days are explained.
    const notRest = await asAdmin(http().post('/employee-schedules/overrides/move-rest-day'))
      .send({ employeeId, restDate: '2026-12-22', newRestDate: '2026-12-24', note: 'Teste' })
      .expect(400);
    expect(notRest.body.message).toContain('não é um dia de folga');

    const moved = await asAdmin(http().post('/employee-schedules/overrides/move-rest-day'))
      .send({ employeeId, restDate: '2026-12-23', newRestDate: '2026-12-24', note: 'Pedido dela' })
      .expect(201);
    expect(moved.body.ids).toHaveLength(2);

    const statuses = async () => {
      const grid = await team().expect(200);
      const ana = grid.body.employees.find(
        (r: { employeeId: string }) => r.employeeId === employeeId,
      );
      return Object.fromEntries(
        ana.days.map((d: { businessDate: string; status: string }) => [d.businessDate, d.status]),
      );
    };
    expect(await statuses()).toMatchObject({ '2026-12-23': 'WORK', '2026-12-24': 'REST' });

    // A second change on the same day must cancel the first one.
    await asAdmin(http().post('/employee-schedules/overrides/adjustment'))
      .send({ employeeId, businessDate: '2026-12-24', isWorkday: false, note: 'Duplicado' })
      .expect(409);

    await asAdmin(http().post(`/employee-schedules/overrides/${moved.body.ids[0]}/revoke`))
      .send({ reason: 'Desistiu da troca' })
      .expect(201);
    expect(await statuses()).toMatchObject({ '2026-12-23': 'REST', '2026-12-24': 'WORK' });
    expect(
      await prisma.scheduleOverride.count({ where: { employeeId, revokedAt: { not: null } } }),
    ).toBe(2);
  });

  it('warns before a one-day adjustment breaks the rules, and saves once confirmed', async () => {
    await asAdmin(http().post(`/employee-schedules/${employeeId}/versions`))
      .send({ effectiveDate: '2026-12-21', weeks: [week([Weekday.SATURDAY, Weekday.SUNDAY])] })
      .expect(201);

    // 08:00–22:00 is far above the daily limit.
    const longDay = {
      employeeId,
      businessDate: '2026-12-22',
      isWorkday: true,
      startMinute: 480,
      endMinute: 1320,
      breakStartMinute: 720,
      breakEndMinute: 780,
      note: 'Inventário',
    };
    const refused = await asAdmin(http().post('/employee-schedules/overrides/adjustment'))
      .send(longDay)
      .expect(422);
    expect(refused.body.code).toBe('SCHEDULE_COMPLIANCE_ISSUES');
    expect(Object.keys(refused.body.details)).toContain('DAILY_HOURS_EXCEEDED');
    expect(await prisma.scheduleOverride.count({ where: { employeeId } })).toBe(0);

    // Working on a rest day leaves a single folga that week.
    await asAdmin(http().post('/employee-schedules/overrides/adjustment'))
      .send({ ...longDay, businessDate: '2026-12-26', endMinute: 1020, note: 'Cobrir colega' })
      .expect(422);

    await asAdmin(http().post('/employee-schedules/overrides/adjustment'))
      .send({ ...longDay, confirmIssues: true })
      .expect(201);
    // A day off never needs confirmation.
    await asAdmin(http().post('/employee-schedules/overrides/adjustment'))
      .send({ employeeId, businessDate: '2026-12-23', isWorkday: false, note: 'Folga extra' })
      .expect(201);
    expect(await prisma.scheduleOverride.count({ where: { employeeId } })).toBe(2);
  });

  it('keeps holidays and vacations above the escala', async () => {
    await asAdmin(http().post(`/employee-schedules/${employeeId}/versions`))
      .send({ effectiveDate: '2026-12-21', weeks: [week([Weekday.WEDNESDAY, Weekday.SUNDAY])] })
      .expect(201);
    await prisma.calendarException.create({
      data: {
        businessDate: new Date('2026-12-25T00:00:00.000Z'),
        revisions: {
          create: {
            sequence: 1,
            operation: 'UPSERT',
            kind: 'HOLIDAY',
            name: 'Natal',
            createdById: adminId,
          },
        },
      },
    });
    await prisma.vacation.create({
      data: {
        employeeId: colleagueId,
        startDate: new Date('2026-12-21T00:00:00.000Z'),
        endDate: new Date('2026-12-27T00:00:00.000Z'),
        createdById: adminId,
      },
    });
    const grid = await team().expect(200);
    const ana = grid.body.employees.find(
      (r: { employeeId: string }) => r.employeeId === employeeId,
    );
    const christmas = ana.days.find(
      (d: { businessDate: string }) => d.businessDate === '2026-12-25',
    );
    expect(christmas).toMatchObject({ status: 'HOLIDAY', label: 'Natal' });
    const bruno = grid.body.employees.find(
      (r: { employeeId: string }) => r.employeeId === colleagueId,
    );
    expect(bruno.days.every((d: { status: string }) => d.status === 'VACATION')).toBe(true);
    // A week of vacation is not reported as missing rest days.
    expect(bruno.issues.filter((i: { code: string }) => i.code === 'NOT_ENOUGH_REST_DAYS')).toEqual(
      [],
    );
  });

  it('lets the employee see only their own escala, and only admins change settings', async () => {
    const mine = await asEmployee(http().get('/employee-schedules/me')).expect(200);
    expect(mine.body.days.length).toBeGreaterThanOrEqual(7);
    expect(mine.body.days[0].businessDate).toBe('2026-12-21');
    expect(mine.body.nextChange).toBeNull();

    // An escala published for later is shown ahead of time.
    await asAdmin(http().post(`/employee-schedules/${employeeId}/versions`))
      .send({ effectiveDate: '2027-02-01', weeks: [week([Weekday.SATURDAY, Weekday.SUNDAY])] })
      .expect(201);
    const ahead = await asEmployee(http().get('/employee-schedules/me')).expect(200);
    expect(ahead.body.nextChange.effectiveDate).toBe('2027-02-01');
    expect(ahead.body.nextChange.days.map((day: { status: string }) => day.status)).toEqual([
      'WORK',
      'WORK',
      'WORK',
      'WORK',
      'WORK',
      'REST',
      'REST',
    ]);
    await asEmployee(http().get(`/employee-schedules/${colleagueId}`))
      .query({ from: '2026-12-21', to: '2026-12-27' })
      .expect(403);
    await asEmployee(http().get('/employee-schedules/team'))
      .query({ from: '2026-12-21', to: '2026-12-27' })
      .expect(403);
    await asEmployee(http().post(`/employee-schedules/${employeeId}/versions`))
      .send({ effectiveDate: '2026-12-22', weeks: [week([Weekday.SUNDAY])] })
      .expect(403);

    const settings = await asAdmin(http().put('/employee-schedules/settings'))
      .send({ hasCollectiveAgreement: true, sundayRestEveryWeeks: 2, minimumStaff: 2 })
      .expect(200);
    expect(settings.body).toEqual({
      hasCollectiveAgreement: true,
      sundayRestEveryWeeks: 2,
      minimumStaff: 2,
    });
    const grid = await team().expect(200);
    expect(grid.body.settings.minimumStaff).toBe(2);
    // With an agreement the transition allows 42 h.
    expect(grid.body.employees[0].weeks[0].weeklyLimitMinutes).toBe(42 * 60);
  });
});
