import { expect, test } from '@playwright/test';

const employeeSession = {
  accessToken: 'employee-access-token',
  accessTokenExpiresAt: '2026-08-14T23:59:59.000Z',
  user: {
    id: '8f876ef4-dff4-4d58-91bc-e964d75c03da',
    name: 'Marina Souza',
    login: 'marina.souza',
    role: 'EMPLOYEE' as const,
  },
};

const emptyChronology = {
  punches: [],
  integrityIssues: [],
  intervals: [],
  punchCount: 0,
  completedIntervalCount: 0,
  hasOpenInterval: false,
  isIncomplete: false,
  workedMilliseconds: 0,
  workedMinutes: 0,
};

const initialDay = {
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
  chronology: emptyChronology,
};

const recordedAt = '2026-08-14T11:02:00.000Z';
const punchId = '4b933e0b-876f-4aac-b59e-c07c81260b20';
const punchedDay = {
  ...initialDay,
  workState: 'WORKING',
  punchCount: 1,
  chronology: {
    ...emptyChronology,
    punches: [
      {
        id: punchId,
        kind: 'CLOCK_IN',
        originalOccurredAt: recordedAt,
        effectiveOccurredAt: recordedAt,
        appliedAdjustmentCount: 0,
      },
    ],
    punchCount: 1,
    hasOpenInterval: true,
    isIncomplete: true,
  },
};

const periodTotals = {
  startDate: '2026-08-14',
  endDate: '2026-08-14',
  finalizedDayCount: 0,
  completeDayCount: 0,
  incompleteDayCount: 0,
  provisionalDayCount: 1,
  expectedMinutes: 0,
  workedMinutes: 0,
  balanceMinutes: 0,
  overtimeMinutes: 0,
  missingMinutes: 0,
  knownPartialWorkedMinutes: 0,
  punchCount: 1,
  correctionCount: 0,
  statusCounts: {
    normal: 0,
    overtime: 0,
    missingHours: 0,
    incomplete: 0,
    holiday: 0,
    dayOff: 0,
    closed: 0,
  },
};

test('employee logs in, records an authoritative punch, and opens owned history', async ({
  page,
}) => {
  await page.addInitScript((session) => {
    let activeSession: typeof session | null = null;
    Object.defineProperty(window, 'phPonto', {
      configurable: true,
      value: {
        app: {
          getInfo: async () => ({
            productName: 'PH-Ponto',
            version: '0.1.0',
            platform: 'e2e',
            packaged: false,
          }),
        },
        auth: {
          restore: async () => ({ session: activeSession, persistence: 'ENCRYPTED' }),
          login: async (input: { login: string; password: string }) => {
            if (input.login !== 'marina.souza' || input.password !== 'SenhaSegura123!') {
              const error = new Error('Login ou senha inválidos.');
              Object.assign(error, { code: 'INVALID_CREDENTIALS', status: 401 });
              throw error;
            }
            activeSession = session;
            return { session: activeSession, persistence: 'ENCRYPTED' };
          },
          refresh: async () => ({ session: activeSession, persistence: 'ENCRYPTED' }),
          logout: async () => {
            activeSession = null;
            return {
              session: null,
              persistence: 'ENCRYPTED',
              remoteRevocation: 'CONFIRMED',
            };
          },
        },
      },
    });
  }, employeeSession);

  let currentDay = initialDay;
  await page.route(/^https?:\/\/(localhost|127\.0\.0\.1):3000\/.*/, async (route) => {
    const request = route.request();
    const url = new URL(request.url());

    if (url.pathname.includes('/avatar')) {
      await route.fulfill({ status: 404 });
      return;
    }

    expect(request.headers().authorization).toBe(`Bearer ${employeeSession.accessToken}`);

    if (url.pathname === '/attendance/today') {
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify(currentDay) });
      return;
    }

    if (url.pathname === '/attendance/monthly') {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          days: [],
          totals: { ...periodTotals, year: 2026, month: 8 },
        }),
      });
      return;
    }

    if (url.pathname === '/time-punches') {
      expect(request.method()).toBe('POST');
      expect(request.postData()).toBe('{}');
      expect(request.headers()['idempotency-key']).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      );
      currentDay = punchedDay;
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          punch: {
            id: punchId,
            employeeId: employeeSession.user.id,
            occurredAt: recordedAt,
            effectiveOccurredAt: recordedAt,
            kind: 'CLOCK_IN',
            origin: 'EMPLOYEE',
            createdByAdminId: null,
            insertionReason: null,
            adjustmentSequence: 0,
            createdAt: recordedAt,
          },
          dailySummary: punchedDay,
          idempotencyKey: request.headers()['idempotency-key'],
        }),
      });
      return;
    }

    if (url.pathname === '/attendance/history') {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ days: [punchedDay], totals: periodTotals }),
      });
      return;
    }

    await route.abort('failed');
  });

  await page.goto('/#/');
  await expect(page).toHaveTitle(/PH-Ponto/);
  await expect(page.getByRole('heading', { name: 'Bater Ponto' })).toBeVisible();

  await page.getByLabel('Login').fill('marina.souza');
  await page.getByLabel('Senha', { exact: true }).fill('SenhaSegura123!');
  await page.getByRole('button', { name: 'Entrar' }).click();

  await expect(page.getByRole('heading', { name: 'Seu ponto de hoje' })).toBeVisible();
  await page.getByRole('button', { name: 'Bater ponto' }).click();

  await expect(page.getByText('Ponto registrado com sucesso')).toBeVisible();
  await expect(page.getByText('Horário oficial: 08:02')).toBeVisible();
  await expect(page.getByRole('list', { name: 'Pontos registrados hoje' })).toContainText(
    'Entrada',
  );

  await page.getByRole('link', { name: 'Histórico' }).click();
  await expect(page.getByRole('heading', { name: 'Histórico de pontos' })).toBeVisible();
  await expect(page.getByRole('table')).toContainText('14 de ago. de 2026');
  await expect(page.getByRole('table')).toContainText('Trabalhando');
});
