import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  Clock,
  FileText,
  LayoutDashboard,
  LogOut,
  MonitorDown,
  ScrollText,
  Settings,
  ShieldCheck,
  Users,
  WifiOff,
} from 'lucide-react';
import { NavLink, Outlet } from 'react-router-dom';

import { useAuth } from '../auth/use-auth.js';
import { AvatarImage } from './avatar-image.js';
import { Brand } from './brand.js';
import { ThemeButton } from './theme-button.js';

function useOnline(): boolean {
  const [online, setOnline] = useState(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  );
  useEffect(() => {
    const goOnline = (): void => setOnline(true);
    const goOffline = (): void => setOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);
  return online;
}

import { BUSINESS_TIME_ZONE } from '@ph-ponto/shared';

function useFortalezaClock(): string {
  const [time, setTime] = useState('');

  useEffect(() => {
    const update = (): void => {
      const now = new Date();
      setTime(
        now.toLocaleTimeString('pt-BR', {
          timeZone: BUSINESS_TIME_ZONE,
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }),
      );
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  return time;
}

import { GitPullRequest } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

export function AdminLayout(): React.JSX.Element {
  const { logout, session, api } = useAuth();
  const queryClient = useQueryClient();
  const online = useOnline();
  const fortalezaClock = useFortalezaClock();

  const { data: pendingData } = useQuery({
    queryKey: ['pending-adjustments-count'],
    queryFn: ({ signal }) => api.getPendingAdjustmentRequestsCount(signal),
    refetchInterval: 30_000,
    staleTime: 10_000,
  });

  const pendingCount = pendingData?.pendingCount ?? 0;

  const navItems = [
    { to: '/admin', label: 'Visão geral', icon: LayoutDashboard, end: true },
    {
      to: '/admin/solicitacoes',
      label: 'Solicitações',
      icon: GitPullRequest,
      badge: pendingCount,
      end: false,
    },
    { to: '/admin/funcionarios', label: 'Funcionários', icon: Users, end: false },
    { to: '/admin/pontos', label: 'Pontos', icon: Clock, end: false },
    { to: '/admin/relatorios', label: 'Relatórios', icon: FileText, end: false },
    { to: '/admin/aplicativo', label: 'Aplicativo Desktop', icon: MonitorDown, end: false },
    { to: '/admin/administradores', label: 'Administradores', icon: ShieldCheck, end: false },
    { to: '/admin/configuracoes', label: 'Configurações', icon: Settings, end: false },
    { to: '/admin/auditoria', label: 'Auditoria', icon: ScrollText, end: false },
  ];

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans">
      {/* Sidebar */}
      <aside className="w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col shrink-0 select-none">
        <div className="p-5 border-b border-slate-200 dark:border-slate-800">
          <Brand />
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto" aria-label="Navegação administrativa">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `flex items-center justify-between px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-xs font-semibold'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
                  }`
                }
              >
                <div className="flex items-center">
                  <Icon className="w-4 h-4 mr-3 shrink-0" />
                  <span>{item.label}</span>
                </div>
                {item.badge !== undefined && item.badge > 0 ? (
                  <span className="px-2 py-0.5 text-xs font-extrabold rounded-full bg-amber-500 text-slate-950 shadow-sm animate-pulse">
                    {item.badge}
                  </span>
                ) : null}
              </NavLink>
            );
          })}
        </nav>

        {/* User profile & logout */}
        <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center justify-between p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-2xs">
            <div className="flex items-center space-x-2.5 overflow-hidden">
              <AvatarImage
                userId={session?.user.id ?? ''}
                name={session?.user.name ?? 'Administrador'}
                size="sm"
              />
              <div className="overflow-hidden">
                <div className="text-xs font-bold truncate text-slate-900 dark:text-white">
                  {session?.user.name}
                </div>
                <div className="text-[10px] text-blue-600 dark:text-blue-400 font-semibold uppercase tracking-wider">
                  Administrador
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-1 shrink-0">
              <button
                type="button"
                onClick={() => {
                  void logout().finally(() => queryClient.clear());
                }}
                title="Sair do sistema"
                aria-label="Sair"
                className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-md transition-colors"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header */}
        <header className="h-16 px-6 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0 shadow-2xs">
          <div className="flex items-center space-x-3">
            <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 font-mono">
              Fortaleza: {fortalezaClock || '--:--:--'}
            </span>
          </div>

          <div className="flex items-center space-x-3">
            <ThemeButton />
          </div>
        </header>

        {/* Offline alerts */}
        {!online && (
          <div className="bg-rose-600 text-white px-4 py-2 text-xs font-semibold flex items-center justify-center space-x-2 shrink-0">
            <WifiOff className="w-4 h-4" />
            <span>
              Sem conexão com a rede. Alterações administrativas não serão salvas até a reconexão.
            </span>
          </div>
        )}

        {/* Dynamic Page View */}
        <main className="flex-1 p-6 overflow-y-auto min-w-0 bg-slate-50 dark:bg-slate-950">
          <div className="max-w-7xl mx-auto space-y-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
