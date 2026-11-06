import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthProvider } from '../../../auth/auth-context.js';
import { useAuth } from '../../../auth/use-auth.js';
import { ToastProvider } from '../../../components/toast-context.js';
import { adminSession, createBridge, jsonResponse } from '../../../test/fixtures.js';
import { TeamSchedulePage } from './team-schedule-page.js';
import { addDays, hoursLabel, minuteToTime, mondayOf, timeToMinute } from './schedule-ui.js';

const EMPLOYEE_ID = 'b0b1a6b9-8d98-48db-be01-8a1d7b8ab75f';
const WEEKDAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];

function cell(date: string, index: number, rest: boolean) {
  return {
    businessDate: date,
    weekday: WEEKDAYS[index % 7],
    status: rest ? 'REST' : 'WORK',
    startMinute: rest ? null : 480,
    endMinute: rest ? null : 1020,
    breakStartMinute: rest ? null : 720,
    breakEndMinute: rest ? null : 780,
    plannedMinutes: rest ? 0 : 480,
    source: 'EMPLOYEE_SCHEDULE',
    label: null,
    overrideId: null,
    overrideReason: null,
  };
}

function team(from: string) {
  const days = Array.from({ length: 14 }, (_, index) =>
    cell(addDays(from, index), index, index % 7 >= 5),
  );
  return {
    from,
    to: addDays(from, 13),
    settings: { hasCollectiveAgreement: null, sundayRestEveryWeeks: 3, minimumStaff: 2 },
    regimeToday: 'CLT atual: 44 horas semanais, 1 folga',
    employees: [
      {
        employeeId: EMPLOYEE_ID,
        name: 'MARIA DAS DORES',
        login: 'maria',
        hasAvatar: false,
        hasOwnSchedule: false,
        ownScheduleFrom: null,
        days,
        weeks: [
          {
            weekStart: from,
            plannedMinutes: 2400,
            restDays: 2,
            weeklyLimitMinutes: 2400,
            regimeLabel: 'EC 141',
          },
        ],
        issues: [
          {
            code: 'NO_SUNDAY_REST',
            severity: 'ERROR',
            businessDate: from,
            message: 'Semana de teste: só 1 folga.',
          },
        ],
      },
    ],
    coverage: days.map((day, index) => ({
      businessDate: day.businessDate,
      working: index % 7 >= 5 ? 0 : 1,
      storeOpen: index % 7 < 6,
      belowMinimum: index % 7 < 5,
    })),
  };
}

function installFetch() {
  const calls: string[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation((input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      calls.push(`${init?.method ?? 'GET'} ${url}`);
      if (url.includes('/employee-schedules/team')) {
        const from = new URL(url).searchParams.get('from')!;
        return Promise.resolve(jsonResponse(team(from)));
      }
      if (url.includes('/preview')) {
        return Promise.resolve(
          jsonResponse({ effectiveDate: '2026-12-14', days: [], weeks: [], issues: [] }),
        );
      }
      return Promise.resolve(jsonResponse({}));
    }),
  );
  return calls;
}

function AuthGate({ children }: { children: React.ReactNode }) {
  const { session } = useAuth();
  return session ? <>{children}</> : <div>Carregando sessão...</div>;
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <AuthProvider>
          <AuthGate>
            <MemoryRouter>
              <TeamSchedulePage />
            </MemoryRouter>
          </AuthGate>
        </AuthProvider>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

describe('schedule helpers', () => {
  it('converts times and formats hours', () => {
    expect(timeToMinute('08:30')).toBe(510);
    expect(timeToMinute('25:00')).toBeNull();
    expect(minuteToTime(1020)).toBe('17:00');
    expect(hoursLabel(2400)).toBe('40h');
    expect(hoursLabel(504)).toBe('8h24');
    expect(mondayOf('2026-12-20')).toBe('2026-12-14');
    expect(mondayOf('2026-12-14')).toBe('2026-12-14');
  });
});

describe('TeamSchedulePage', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'phPonto', {
      configurable: true,
      value: createBridge(adminSession),
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('shows the week, the rest days, the coverage and what needs attention', async () => {
    installFetch();
    renderPage();
    expect(await screen.findByText('Maria das Dores')).toBeInTheDocument();
    expect(screen.getAllByText('Folga').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('Pessoas trabalhando')).toBeInTheDocument();
    expect(screen.getByText('O que precisa de atenção')).toBeInTheDocument();
    expect(screen.getByText(/só 1 folga/)).toBeInTheDocument();
  });

  it('moves to the next week and opens the schedule editor', async () => {
    const calls = installFetch();
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Maria das Dores');
    await user.click(screen.getByRole('button', { name: 'Próxima semana' }));
    await waitFor(() =>
      expect(calls.filter((call) => call.includes('/employee-schedules/team'))).toHaveLength(2),
    );
    await user.click(screen.getByRole('button', { name: /Montar escala/ }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Escala de Maria das Dores')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: /Salvar escala/ })).toBeInTheDocument();
  });
});
