import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Clock3, History, KeyRound, LogOut, RotateCw, WifiOff } from 'lucide-react';
import { NavLink, Outlet } from 'react-router-dom';

import { useAuth } from '../auth/use-auth.js';
import { Brand } from './brand.js';
import { ChangePasswordModal } from './change-password-modal.js';
import { ThemeButton } from './theme-button.js';
import { useToast } from './toast-context.js';

function useOnline(): boolean {
  const [online, setOnline] = useState(() => navigator.onLine);
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

export function EmployeeLayout(): React.JSX.Element {
  const { logout, session } = useAuth();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const online = useOnline();
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async (): Promise<void> => {
    setIsRefreshing(true);
    try {
      await Promise.all([
        queryClient.invalidateQueries(),
        queryClient.refetchQueries({ type: 'active' }),
      ]);
      showToast('success', 'Todos os dados e solicitações foram atualizados.', 'Atualizado');
    } catch {
      showToast('error', 'Falha ao atualizar dados.', 'Erro ao Atualizar');
    } finally {
      setTimeout(() => setIsRefreshing(false), 500);
    }
  };

  return (
    <div className="app-shell">
      <header className="app-header">
        <Brand compact />
        <nav aria-label="Navegação principal">
          <NavLink to="/" end>
            <Clock3 aria-hidden="true" /> Início
          </NavLink>
          <NavLink to="/historico">
            <History aria-hidden="true" /> Histórico
          </NavLink>
        </nav>
        <div className="header-actions">
          <button
            className={`icon-button ${isRefreshing ? 'opacity-70' : ''}`}
            type="button"
            aria-label="Atualizar dados e solicitações"
            title="Atualizar dados e solicitações"
            disabled={isRefreshing}
            onClick={() => void handleRefresh()}
          >
            <RotateCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} aria-hidden="true" />
          </button>
          <button
            className="icon-button"
            type="button"
            aria-label="Alterar minha senha"
            title="Alterar minha senha"
            onClick={() => setIsPasswordModalOpen(true)}
          >
            <KeyRound aria-hidden="true" />
          </button>
          <ThemeButton />
          <button
            className="icon-button"
            type="button"
            aria-label="Sair do PH-Ponto"
            title="Sair"
            onClick={() => {
              void logout().finally(() => queryClient.clear());
            }}
          >
            <LogOut aria-hidden="true" />
          </button>
        </div>
      </header>
      {!online && (
        <div className="offline-banner" role="status">
          <WifiOff aria-hidden="true" /> Sem conexão. O ponto só será registrado quando o servidor
          estiver disponível.
        </div>
      )}
      <main className="employee-content">
        <Outlet context={{ employeeName: session?.user.name ?? '' }} />
      </main>

      <ChangePasswordModal
        isOpen={isPasswordModalOpen}
        onClose={() => setIsPasswordModalOpen(false)}
      />
    </div>
  );
}
