import type { DesktopAuthSession, ElectronApi } from '../../shared/electron-api.js';
import type {
  AttendanceOverview,
  AttendancePeriod,
  DailyAttendance,
  MonthlyAttendance,
  TimePunchMutation,
} from '../api/contracts.js';

export const employeeSession: DesktopAuthSession = {
  accessToken: 'employee-access-token',
  accessTokenExpiresAt: '2026-08-15T00:00:00.000Z',
  user: {
    id: '11111111-1111-4111-8111-111111111111',
    name: 'João Silva',
    login: 'joao.silva',
    role: 'EMPLOYEE',
  },
};

export const adminSession: DesktopAuthSession = {
  ...employeeSession,
  accessToken: 'admin-access-token',
  user: { ...employeeSession.user, name: 'Ana Admin', login: 'ana.admin', role: 'ADMIN' },
};

export function dailyFixture(overrides: Partial<DailyAttendance> = {}): DailyAttendance {
  return {
    businessDate: '2026-08-14',
    isFinalized: false,
    status: null,
    workState: 'NOT_STARTED',
    expectedMinutes: 480,
    workedMinutes: 0,
    balanceMinutes: null,
    punchCount: 0,
    completedIntervalCount: 0,
    correctionCount: 0,
    expectationSource: 'WEEKLY_SCHEDULE',
    calendarStatus: null,
    exceptionName: null,
    chronology: {
      punches: [],
      integrityIssues: [],
      intervals: [],
      punchCount: 0,
      completedIntervalCount: 0,
      hasOpenInterval: false,
      isIncomplete: false,
      workedMilliseconds: 0,
      workedMinutes: 0,
    },
    ...overrides,
  };
}

const periodTotals = {
  startDate: '2026-08-01',
  endDate: '2026-08-14',
  finalizedDayCount: 13,
  completeDayCount: 10,
  incompleteDayCount: 0,
  provisionalDayCount: 1,
  expectedMinutes: 5_760,
  workedMinutes: 5_760,
  balanceMinutes: 0,
  overtimeMinutes: 0,
  missingMinutes: 0,
  knownPartialWorkedMinutes: 0,
  punchCount: 40,
  correctionCount: 0,
  statusCounts: {
    normal: 10,
    overtime: 0,
    missingHours: 0,
    incomplete: 0,
    holiday: 0,
    dayOff: 3,
    closed: 0,
  },
};

export function monthlyFixture(day = dailyFixture()): MonthlyAttendance {
  return {
    days: [day],
    totals: { ...periodTotals, year: 2026, month: 8 },
  };
}

export function historyFixture(
  day = dailyFixture({ isFinalized: true, status: 'NORMAL', workState: null, balanceMinutes: 0 }),
): AttendancePeriod {
  return { days: [day], totals: periodTotals };
}

export function punchFixture(): TimePunchMutation {
  const occurredAt = '2026-08-14T11:03:00.000Z';
  const punchId = '22222222-2222-4222-8222-222222222222';
  const dailySummary = dailyFixture({
    workState: 'WORKING',
    punchCount: 1,
    chronology: {
      punches: [
        {
          id: punchId,
          kind: 'CLOCK_IN',
          originalOccurredAt: occurredAt,
          effectiveOccurredAt: occurredAt,
          appliedAdjustmentCount: 0,
        },
      ],
      integrityIssues: [],
      intervals: [],
      punchCount: 1,
      completedIntervalCount: 0,
      hasOpenInterval: true,
      isIncomplete: false,
      workedMilliseconds: 0,
      workedMinutes: 0,
    },
  });
  return {
    punch: {
      id: punchId,
      employeeId: employeeSession.user.id,
      occurredAt,
      effectiveOccurredAt: occurredAt,
      kind: 'CLOCK_IN',
      origin: 'EMPLOYEE',
      createdByAdminId: null,
      insertionReason: null,
      adjustmentSequence: 0,
      createdAt: occurredAt,
    },
    dailySummary,
    idempotencyKey: '33333333-3333-4333-8333-333333333333',
  };
}

export function overviewFixture(): AttendanceOverview {
  return {
    businessDate: '2026-08-14',
    totalActiveEmployees: 1,
    clockedInTodayCount: 0,
    currentlyWorkingCount: 0,
    incompleteCount: 0,
    notClockedInCount: 1,
    employees: [],
    recentPunches: [],
    recentAdjustments: [],
  };
}

export function createBridge(restoredSession: DesktopAuthSession | null): ElectronApi {
  return {
    app: {
      getInfo: async () => ({
        productName: 'PH-Ponto',
        version: '0.1.0',
        platform: 'test',
        packaged: false,
      }),
    },
    auth: {
      login: async () => ({ session: employeeSession, persistence: 'ENCRYPTED' }),
      restore: async () => ({ session: restoredSession, persistence: 'ENCRYPTED' }),
      refresh: async () => ({ session: restoredSession, persistence: 'ENCRYPTED' }),
      logout: async () => ({
        session: null,
        persistence: 'ENCRYPTED',
        remoteRevocation: 'CONFIRMED',
      }),
    },
  };
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
