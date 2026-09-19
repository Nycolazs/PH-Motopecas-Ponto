import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { promisify } from 'node:util';
import { _electron, expect } from '@playwright/test';

const employeeSession = {
  accessToken: 'release-smoke-access-token',
  accessTokenExpiresAt: '2026-12-31T23:59:59.000Z',
  user: {
    id: '11111111-1111-4111-8111-111111111111',
    name: 'Teste de Instalação',
    login: 'release.smoke',
    role: 'EMPLOYEE',
  },
};

const punchOccurredAt = '2026-09-19T12:00:00.000Z';
const dailySummary = {
  businessDate: '2026-09-19',
  isFinalized: false,
  status: null,
  workState: 'WORKING',
  expectedMinutes: 480,
  workedMinutes: 0,
  balanceMinutes: null,
  punchCount: 1,
  completedIntervalCount: 0,
  correctionCount: 0,
  expectationSource: 'WEEKLY_SCHEDULE',
  calendarStatus: null,
  exceptionName: null,
  chronology: {
    punches: [
      {
        id: '22222222-2222-4222-8222-222222222222',
        kind: 'CLOCK_IN',
        originalOccurredAt: punchOccurredAt,
        effectiveOccurredAt: punchOccurredAt,
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
};

const monthlySummary = {
  days: [dailySummary],
  totals: {
    startDate: '2026-09-01',
    endDate: '2026-09-19',
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
      vacation: 0,
    },
    year: 2026,
    month: 9,
  },
};

const punchResponse = {
  punch: {
    id: '22222222-2222-4222-8222-222222222222',
    employeeId: employeeSession.user.id,
    occurredAt: punchOccurredAt,
    effectiveOccurredAt: punchOccurredAt,
    kind: 'CLOCK_IN',
    origin: 'EMPLOYEE',
    createdByAdminId: null,
    insertionReason: null,
    adjustmentSequence: 0,
    createdAt: punchOccurredAt,
  },
  dailySummary,
  idempotencyKey: '33333333-3333-4333-8333-333333333333',
};

assert.equal(process.platform, 'win32', 'Run the installer smoke test on Windows');
const run = promisify(execFile);
const { version } = JSON.parse(await readFile('package.json', 'utf8'));
const installDirectory = resolve(process.env.RUNNER_TEMP, 'ph-ponto-installed');
const installer = resolve('release', `PH-Ponto-Setup-${version}.exe`);
const outputDirectory = resolve('release-smoke');
await mkdir(outputDirectory, { recursive: true });

await run(installer, ['/S', `/D=${installDirectory}`], { timeout: 120_000 });
const executable = resolve(installDirectory, 'ph-ponto.exe');
let application;
try {
  application = await _electron.launch({ executablePath: executable, timeout: 60_000 });
  const page = await application.firstWindow();
  const runtime = await application.evaluate(({ app, BrowserWindow }) => ({
    version: app.getVersion(),
    packaged: app.isPackaged,
    preferences: BrowserWindow.getAllWindows()[0].webContents.getLastWebPreferences(),
  }));
  assert.equal(runtime.version, version);
  assert.equal(runtime.packaged, true);
  assert.equal(runtime.preferences.sandbox, true);
  assert.equal(runtime.preferences.contextIsolation, true);
  assert.equal(runtime.preferences.nodeIntegration, false);

  // Isolate the installed client from production accounts and attendance records.
  await application.evaluate(({ ipcMain }, session) => {
    ipcMain.removeHandler('auth:login');
    ipcMain.removeHandler('auth:logout');
    ipcMain.handle('auth:login', () => ({
      ok: true,
      value: { session, persistence: 'MEMORY_ONLY' },
    }));
    ipcMain.handle('auth:logout', () => ({
      ok: true,
      value: { session: null, persistence: 'MEMORY_ONLY', remoteRevocation: 'CONFIRMED' },
    }));
  }, employeeSession);

  let offline = false;
  await page.route('https://ponto-api.phmotopecas.com/**', async (route) => {
    if (offline) return route.abort('internetdisconnected');
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/avatar')) return route.fulfill({ status: 404 });
    const body =
      path === '/attendance/today'
        ? dailySummary
        : path === '/attendance/monthly'
          ? monthlySummary
          : path === '/time-punches'
            ? punchResponse
            : undefined;
    if (body === undefined) return route.abort('failed');
    return route.fulfill({ status: path === '/time-punches' ? 201 : 200, json: body });
  });

  const login = async () => {
    await expect(page.getByRole('heading', { name: 'Bater Ponto' })).toBeVisible();
    await page.getByLabel('Login').fill('release.smoke');
    await page.getByLabel('Senha', { exact: true }).fill('LocalSmokeOnly123!');
    await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  };
  await login();
  await expect(page.getByRole('heading', { name: 'Seu ponto de hoje' })).toBeVisible();
  await page.getByRole('button', { name: 'Bater ponto' }).click();
  await expect(page.getByText('Ponto registrado com sucesso')).toBeVisible();
  await page.screenshot({ path: resolve(outputDirectory, 'installed-punch.png') });
  await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].hide());
  await expect(page.getByRole('heading', { name: 'Bater Ponto' })).toBeAttached({
    timeout: 15_000,
  });
  await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].show());
  await page.screenshot({ path: resolve(outputDirectory, 'idle-logout.png') });

  offline = true;
  await login();
  await expect(
    page.getByRole('heading', { name: 'Não foi possível carregar os dados' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Sair do PH-Ponto' }).click();
  await expect(page.getByRole('heading', { name: 'Bater Ponto' })).toBeVisible();
  console.log(
    `Installed PH-Ponto ${version}: login, punch, hidden-window inactivity logout, and offline UI passed.`,
  );
} finally {
  await application?.close();
  await run(resolve(installDirectory, 'Uninstall PH-Ponto.exe'), ['/S'], { timeout: 120_000 });
}
console.log('Windows silent installation and uninstallation passed.');
