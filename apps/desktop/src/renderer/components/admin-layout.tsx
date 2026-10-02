import { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Briefcase,
  Building2,
  ChevronDown,
  Clock,
  FileText,
  FolderArchive,
  GitPullRequest,
  LayoutDashboard,
  LogOut,
  MonitorDown,
  ScrollText,
  Settings,
  ShieldCheck,
  Users,
  WifiOff,
} from 'lucide-react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { BUSINESS_TIME_ZONE } from '@ph-ponto/shared';

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

function useBusinessClock(): string {
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

interface NavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  end?: boolean;
  badge?: number;
}

interface NavGroup {
  id: string;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
  items: NavItem[];
}

export function AdminLayout(): React.JSX.Element {
  const { logout, session, api } = useAuth();
  const online = useOnline();
  const businessClock = useBusinessClock();
  const location = useLocation();
  const pathname = location.pathname;
  const mainScrollRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (typeof mainScrollRef.current?.scrollTo === 'function') {
      mainScrollRef.current.scrollTo({ top: 0, behavior: 'instant' });
    }
  }, [pathname]);

  const { data: pendingData } = useQuery({
    queryKey: ['pending-adjustments-count'],
    queryFn: ({ signal }) => api.getPendingAdjustmentRequestsCount(signal),
    refetchInterval: 30_000,
    staleTime: 10_000,
  });

  const { data: incompleteData } = useQuery({
    queryKey: ['admin-incomplete-count'],
    queryFn: ({ signal }) => api.getAdminIncompleteDays(undefined, signal),
    refetchInterval: 30_000,
    staleTime: 10_000,
  });

  const pendingCount = pendingData?.pendingCount ?? 0;
  const incompleteCount = incompleteData?.totalIncompleteDays ?? 0;
  const frequencyTotalBadge = pendingCount + incompleteCount;

  // Top level quick items (always visible, core operational actions)
  const quickItems: NavItem[] = [
    { to: '/admin', label: 'Início & Metas', icon: LayoutDashboard, end: true },
    { to: '/admin/gestao', label: 'Painel Operacional', icon: Clock, end: false },
  ];

  // Collapsible accordion groups
  const navGroups: NavGroup[] = [
    {
      id: 'frequencia',
      title: 'Ponto & Frequência',
      icon: Users,
      badge: frequencyTotalBadge,
      items: [
        { to: '/admin/funcionarios', label: 'Colaboradores', icon: Users, end: false },
        { to: '/admin/pontos', label: 'Registros de Ponto', icon: Clock, end: false },
        {
          to: '/admin/solicitacoes',
          label: 'Solicitações de Ajuste',
          icon: GitPullRequest,
          badge: pendingCount,
          end: false,
        },
        {
          to: '/admin/incompletos',
          label: 'Espelhos Incompletos',
          icon: AlertTriangle,
          badge: incompleteCount,
          end: false,
        },
        { to: '/admin/relatorios', label: 'Relatórios & Espelho', icon: FileText, end: false },
      ],
    },
    {
      id: 'sistema',
      title: 'Empresa & Sistema',
      icon: Building2,
      items: [
        { to: '/admin/empresa', label: 'Minha Empresa', icon: Building2, end: false },
        { to: '/admin/cargos', label: 'Cargos & Funções', icon: Briefcase, end: false },
        { to: '/admin/administradores', label: 'Administradores', icon: ShieldCheck, end: false },
        { to: '/admin/configuracoes', label: 'Jornadas & Regras', icon: Settings, end: false },
        { to: '/admin/auditoria', label: 'Trilha de Auditoria', icon: ScrollText, end: false },
        { to: '/admin/aplicativo', label: 'Aplicativo Desktop', icon: MonitorDown, end: false },
      ],
    },
  ];

  // Accordion state: by default, auto-expand the group that contains current active path
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {
      frequencia: false,
      sistema: false,
    };
    if (
      pathname.startsWith('/admin/funcionarios') ||
      pathname.startsWith('/admin/pontos') ||
      pathname.startsWith('/admin/solicitacoes') ||
      pathname.startsWith('/admin/incompletos') ||
      pathname.startsWith('/admin/relatorios')
    ) {
      initial.frequencia = true;
    } else if (
      pathname.startsWith('/admin/empresa') ||
      pathname.startsWith('/admin/cargos') ||
      pathname.startsWith('/admin/administradores') ||
      pathname.startsWith('/admin/configuracoes') ||
      pathname.startsWith('/admin/auditoria') ||
      pathname.startsWith('/admin/aplicativo')
    ) {
      initial.sistema = true;
    }
    return initial;
  });

  // Ensure active group is opened on route changes
  useEffect(() => {
    let activeKey: string | null = null;
    if (
      pathname.startsWith('/admin/funcionarios') ||
      pathname.startsWith('/admin/pontos') ||
      pathname.startsWith('/admin/solicitacoes') ||
      pathname.startsWith('/admin/incompletos') ||
      pathname.startsWith('/admin/relatorios')
    ) {
      activeKey = 'frequencia';
    } else if (
      pathname.startsWith('/admin/empresa') ||
      pathname.startsWith('/admin/cargos') ||
      pathname.startsWith('/admin/administradores') ||
      pathname.startsWith('/admin/configuracoes') ||
      pathname.startsWith('/admin/auditoria') ||
      pathname.startsWith('/admin/aplicativo')
    ) {
      activeKey = 'sistema';
    }

    setOpenGroups({
      frequencia: activeKey === 'frequencia',
      sistema: activeKey === 'sistema',
    });
  }, [pathname]);

  const toggleGroup = (id: string): void => {
    setOpenGroups((prev) => {
      const willBeOpen = !prev[id];
      return {
        frequencia: false,
        sistema: false,
        [id]: willBeOpen,
      };
    });
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans">
      {/* Sidebar with wider footprint for professional legibility */}
      <aside className="w-72 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col shrink-0 select-none shadow-xs">
        <div className="p-4 px-5 border-b border-slate-200 dark:border-slate-800">
          <Brand />
        </div>

        <nav
          className="flex-1 p-3 space-y-4 overflow-y-auto custom-scrollbar"
          aria-label="Navegação administrativa"
        >
          {/* Quick Core Actions (Always direct and easily accessible) */}
          <div className="space-y-1">
            <div className="px-3 py-1 text-2xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Visão Geral
            </div>
            {quickItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={Boolean(item.end)}
                  className={({ isActive }) =>
                    `flex items-center justify-between px-3 py-2 rounded-xl text-xs sm:text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-blue-600 text-white shadow-xs font-semibold'
                        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
                    }`
                  }
                >
                  <div className="flex items-center min-w-0">
                    <Icon className="w-4 h-4 mr-2.5 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </div>
                </NavLink>
              );
            })}
          </div>

          {/* Collapsible Accordion Modules */}
          <div className="space-y-1.5 pt-1 border-t border-slate-100 dark:border-slate-800/80">
            <div className="px-3 py-1 text-2xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Módulos do Sistema
            </div>

            {/* Documentos & RH - Direct Module Link */}
            <NavLink
              to="/admin/documentos/gerar"
              className={() => {
                const isDocActive = pathname.startsWith('/admin/documentos');
                return `w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
                  isDocActive
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100/70 dark:hover:bg-slate-800/60'
                }`;
              }}
            >
              <div className="flex items-center min-w-0">
                <div
                  className={`w-6 h-6 rounded-lg flex items-center justify-center mr-2.5 shrink-0 transition-colors ${
                    pathname.startsWith('/admin/documentos')
                      ? 'bg-white/20 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                  }`}
                >
                  <FolderArchive className="w-3.5 h-3.5" />
                </div>
                <span className="truncate">Documentos & RH</span>
              </div>
            </NavLink>

            {navGroups.map((group) => {
              const GroupIcon = group.icon;
              const isOpen = Boolean(openGroups[group.id]);
              const isGroupActive = group.items.some((item) =>
                item.end ? pathname === item.to : pathname.startsWith(item.to),
              );

              return (
                <div key={group.id} className="rounded-xl overflow-hidden">
                  {/* Accordion Group Trigger Button */}
                  <button
                    type="button"
                    onClick={() => toggleGroup(group.id)}
                    aria-expanded={isOpen}
                    aria-label={group.title}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
                      isGroupActive
                        ? 'bg-slate-100 dark:bg-slate-800 text-blue-600 dark:text-blue-400'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100/70 dark:hover:bg-slate-800/60'
                    }`}
                  >
                    <div className="flex items-center min-w-0">
                      <div
                        className={`w-6 h-6 rounded-lg flex items-center justify-center mr-2.5 shrink-0 transition-colors ${
                          isGroupActive
                            ? 'bg-blue-100 dark:bg-blue-900/60 text-blue-600 dark:text-blue-400'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                        }`}
                      >
                        <GroupIcon className="w-3.5 h-3.5" />
                      </div>
                      <span className="truncate">{group.title}</span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0 ml-2">
                      {group.badge !== undefined && group.badge > 0 && !isOpen && (
                        <span className="px-1.5 py-0.5 text-2xs font-black rounded-full bg-amber-500 text-slate-950 shadow-xs animate-pulse">
                          {group.badge}
                        </span>
                      )}
                      <ChevronDown
                        className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${
                          isOpen ? 'rotate-180' : ''
                        }`}
                      />
                    </div>
                  </button>

                  {/* Accordion Smooth Height Drawer */}
                  <div
                    className={`grid transition-all duration-200 ease-in-out ${
                      isOpen
                        ? 'grid-rows-[1fr] opacity-100 mt-1 mb-1'
                        : 'grid-rows-[0fr] opacity-0 pointer-events-none'
                    }`}
                  >
                    <div className="overflow-hidden">
                      <div className="border-l-2 border-slate-200 dark:border-slate-800 ml-4 pl-2 space-y-0.5">
                        {group.items.map((item) => {
                          const Icon = item.icon;
                          return (
                            <NavLink
                              key={item.to}
                              to={item.to}
                              end={Boolean(item.end)}
                              className={({ isActive }) =>
                                `flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                                  isActive
                                    ? 'bg-blue-600 text-white shadow-xs font-semibold'
                                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/80 hover:text-slate-900 dark:hover:text-white'
                                }`
                              }
                            >
                              <div className="flex items-center min-w-0">
                                <Icon className="w-3.5 h-3.5 mr-2 shrink-0 opacity-80" />
                                <span className="truncate">{item.label}</span>
                              </div>
                              {item.badge !== undefined && item.badge > 0 ? (
                                <span className="px-1.5 py-0.2 text-2xs font-extrabold rounded-full bg-amber-500 text-slate-950 shadow-xs ml-1 shrink-0">
                                  {item.badge}
                                </span>
                              ) : null}
                            </NavLink>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </nav>

        {/* User Profile & Logout */}
        <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center justify-between p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-2xs">
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
                onClick={() => void logout()}
                title="Sair do sistema"
                aria-label="Sair"
                className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors"
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
              Fortaleza: {businessClock || '--:--:--'}
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
        <main
          ref={mainScrollRef}
          className="flex-1 p-6 overflow-y-auto min-w-0 bg-slate-50 dark:bg-slate-950"
        >
          <div key={pathname} className="max-w-7xl mx-auto space-y-6 page-transition">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
