import { expect, test } from '@playwright/test';

const adminSession = {
  accessToken: 'admin-access-token',
  accessTokenExpiresAt: '2026-08-14T23:59:59.000Z',
  user: {
    id: '11111111-1111-4111-8111-111111111111',
    name: 'Carlos Administrador',
    login: 'carlos.admin',
    role: 'ADMIN' as const,
  },
};

const overviewData = {
  businessDate: '2026-08-14',
  totalActiveEmployees: 5,
  clockedInTodayCount: 4,
  currentlyWorkingCount: 3,
  incompleteCount: 0,
  notClockedInCount: 1,
  employees: [
    {
      id: '8f876ef4-dff4-4d58-91bc-e964d75c03da',
      name: 'Marina Souza',
      login: 'marina.souza',
      hasAvatar: false,
      status: null,
      workState: 'WORKING' as const,
      workedMinutes: 120,
      expectedMinutes: 480,
      balanceMinutes: -360,
      punchCount: 1,
      completedIntervalCount: 0,
      correctionCount: 0,
      lastPunchAt: '2026-08-14T11:00:00.000Z',
      lastPunchKind: 'CLOCK_IN' as const,
    },
  ],
  recentPunches: [
    {
      id: '4b933e0b-876f-4aac-b59e-c07c81260b20',
      employeeId: '8f876ef4-dff4-4d58-91bc-e964d75c03da',
      employeeName: 'Marina Souza',
      occurredAt: '2026-08-14T11:00:00.000Z',
      effectiveOccurredAt: '2026-08-14T11:00:00.000Z',
      kind: 'CLOCK_IN' as const,
      origin: 'EMPLOYEE' as const,
      adjustmentSequence: 0,
    },
  ],
  recentAdjustments: [],
};

const employeesData = {
  items: [
    {
      id: '8f876ef4-dff4-4d58-91bc-e964d75c03da',
      name: 'Marina Souza',
      login: 'marina.souza',
      role: 'EMPLOYEE',
      isActive: true,
      accessEnabled: true,
      hasAvatar: false,
      createdAt: '2026-08-01T10:00:00.000Z',
      updatedAt: '2026-08-01T10:00:00.000Z',
    },
  ],
  pagination: {
    page: 1,
    limit: 10,
    total: 1,
    totalPages: 1,
  },
};

test('admin logs in, views operational dashboard and navigates admin modules', async ({ page }) => {
  await page.route(/^https?:\/\/(localhost|127\.0\.0\.1):3000\/.*/, async (route) => {
    const request = route.request();
    const url = new URL(request.url());

    if (url.pathname === '/auth/login') {
      const postData = JSON.parse(request.postData() || '{}');
      if (postData.login === 'carlos.admin' && postData.password === 'AdminSeguro123!') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            accessToken: adminSession.accessToken,
            refreshToken: 'admin-refresh-token',
            accessTokenExpiresInSeconds: 300,
            user: adminSession.user,
          }),
        });
        return;
      }
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 401,
          code: 'INVALID_CREDENTIALS',
          message: 'Login ou senha inválidos.',
        }),
      });
      return;
    }

    if (url.pathname === '/company/setup-status') {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          completionPercentage: 100,
          milestones: [
            {
              key: 'company',
              title: 'Dados da Empresa',
              description: 'Empresa cadastrada',
              completed: true,
              href: '/admin/empresa',
            },
            {
              key: 'culture',
              title: 'Manual de Cultura',
              description: 'Cultura publicada',
              completed: true,
              href: '/admin/documentos/cultura',
            },
            {
              key: 'regulations',
              title: 'Regimento Interno',
              description: 'Regimento publicado',
              completed: true,
              href: '/admin/documentos/regimento',
            },
            {
              key: 'job_roles',
              title: 'Cargos e Funções',
              description: 'Cargos cadastrados',
              completed: true,
              href: '/admin/cargos',
            },
            {
              key: 'employees',
              title: 'Cadastro de Colaboradores',
              description: 'Colaboradores cadastrados',
              completed: true,
              href: '/admin/funcionarios',
            },
            {
              key: 'assignment',
              title: 'Cargos e Termos de Ciência',
              description: 'Termos e cargos atribuídos',
              completed: true,
              href: '/admin/documentos/ciencia',
            },
          ],
        }),
      });
      return;
    }

    if (url.pathname === '/company') {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'c0000000-0000-4000-8000-000000000001',
          tradeName: 'PH Motopeças',
          corporateName: 'PH Motopeças Ltda',
          cnpj: '12.345.678/0001-90',
          address: 'Rua Exemplo, 123',
          city: 'São Paulo',
          state: 'SP',
          zipCode: '01000-000',
          phone: '(11) 99999-9999',
          email: 'contato@phmotos.com.br',
        }),
      });
      return;
    }

    if (url.pathname === '/attendance/incompletes') {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ totalIncompleteDays: 0, items: [] }),
      });
      return;
    }

    if (url.pathname.includes('/avatar')) {
      await route.fulfill({ status: 404, body: '' });
      return;
    }

    if (url.pathname === '/adjustment-requests/pending-count') {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ pendingCount: 0 }),
      });
      return;
    }

    if (url.pathname === '/attendance/overview') {
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify(overviewData) });
      return;
    }

    if (url.pathname === '/employees') {
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify(employeesData) });
      return;
    }

    console.log('UNHANDLED ROUTE:', url.pathname, url.search);
    await route.abort('failed');
  });

  page.on('console', (msg) => console.log('BROWSER CONSOLE:', msg.type(), msg.text()));

  await page.goto('/#/');
  await expect(page).toHaveTitle(/PH-Ponto/);
  await expect(page.getByRole('heading', { name: 'Entrar no Painel' })).toBeVisible();

  await page.getByLabel('Login').fill('carlos.admin');
  await page.getByLabel('Senha', { exact: true }).fill('AdminSeguro123!');
  await page.getByRole('button', { name: 'Entrar' }).click();

  // Wait for admin header on setup dashboard
  await expect(page.getByText('Carlos Administrador')).toBeVisible();
  await expect(page.getByRole('heading', { name: /Bem-vindo ao painel/i })).toBeVisible();

  // Navigate to Operational Dashboard
  await page.getByRole('link', { name: 'Painel Operacional' }).click();
  await expect(page.getByRole('heading', { name: 'Painel Operacional' })).toBeVisible();

  // Check metric card and table
  await expect(page.getByText('Colaboradores ativos')).toBeVisible();
  await expect(page.getByRole('table').getByText('Marina Souza')).toBeVisible();

  // Navigate to Employees Page
  await page.getByRole('link', { name: 'Colaboradores' }).click();
  await expect(page.getByRole('heading', { name: 'Gestão de Funcionários' })).toBeVisible();
  await expect(page.getByRole('table')).toContainText('Marina Souza');
  await expect(page.getByRole('table')).toContainText('marina.souza');
});
