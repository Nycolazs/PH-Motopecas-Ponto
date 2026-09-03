import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';

import { AuthProvider } from './auth/auth-context.js';
import { useAuth } from './auth/use-auth.js';
import { AdminLayout } from './components/admin-layout.js';
import { EmployeeLayout } from './components/employee-layout.js';
import { ErrorBoundary } from './components/error-boundary.js';
import { LoadingScreen } from './components/loading-screen.js';
import { ToastProvider } from './components/toast-context.js';
import { AdminAuditPage } from './pages/admin/audit-page.js';
import { AdminDashboardPage } from './pages/admin/dashboard-page.js';
import { AdminEmployeeDetailPage } from './pages/admin/employee-detail-page.js';
import { AdminEmployeesPage } from './pages/admin/employees-page.js';
import { AdminPunchesPage } from './pages/admin/punches-page.js';
import { AdminReportsPage } from './pages/admin/reports-page.js';
import { AdminDownloadsPage } from './pages/admin/downloads-page.js';
import { AdminSettingsPage } from './pages/admin/settings-page.js';
import { AdminUsersPage } from './pages/admin/admins-page.js';
import { AdjustmentRequestsPage } from './pages/admin/adjustment-requests-page.js';
import { IncompletePunchesPage } from './pages/admin/incomplete-punches-page.js';
import { EmployeeHomePage } from './pages/employee-home-page.js';
import { HistoryPage } from './pages/history-page.js';
import { LoginPage } from './pages/login-page.js';

function AppRoutes(): React.JSX.Element {
  const { state, session } = useAuth();
  if (state === 'RESTORING') return <LoadingScreen />;

  if (state === 'ANONYMOUS' || session === null) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  // Admin routes (available in both Desktop and Web)
  if (session.user.role === 'ADMIN') {
    return (
      <Routes>
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<AdminDashboardPage />} />
          <Route path="solicitacoes" element={<AdjustmentRequestsPage />} />
          <Route path="incompletos" element={<IncompletePunchesPage />} />
          <Route path="funcionarios" element={<AdminEmployeesPage />} />
          <Route path="funcionarios/:id" element={<AdminEmployeeDetailPage />} />
          <Route path="pontos" element={<AdminPunchesPage />} />
          <Route path="relatorios" element={<AdminReportsPage />} />
          <Route path="aplicativo" element={<AdminDownloadsPage />} />
          <Route path="administradores" element={<AdminUsersPage />} />
          <Route path="configuracoes" element={<AdminSettingsPage />} />
          <Route path="auditoria" element={<AdminAuditPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Routes>
    );
  }

  // Employee routes (available in both Desktop and Web)
  return (
    <Routes>
      <Route element={<EmployeeLayout />}>
        <Route index element={<EmployeeHomePage />} />
        <Route path="historico" element={<HistoryPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export function App(): React.JSX.Element {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: false,
            refetchOnWindowFocus: true,
            staleTime: 5_000,
          },
          mutations: { retry: false },
        },
      }),
  );

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <ToastProvider>
            <HashRouter>
              <AppRoutes />
            </HashRouter>
          </ToastProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
