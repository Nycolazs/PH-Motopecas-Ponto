import { CircleAlert, LockKeyhole, RefreshCw, ServerOff, WifiOff } from 'lucide-react';

import { ApiClientError } from '../api/client.js';

interface FeedbackPanelProps {
  error: unknown;
  onRetry?: () => void;
  compact?: boolean;
}

export function FeedbackPanel({
  error,
  onRetry,
  compact = false,
}: FeedbackPanelProps): React.JSX.Element {
  const apiError = error instanceof ApiClientError ? error : null;
  const forbidden = apiError?.status === 403;
  const offline = apiError?.kind === 'NETWORK' && !navigator.onLine;
  const title = forbidden
    ? 'Acesso não permitido'
    : offline
      ? 'Você está sem conexão'
      : apiError?.kind === 'INVALID_RESPONSE'
        ? 'Resposta inesperada do servidor'
        : 'Não foi possível carregar os dados';
  const message = forbidden
    ? 'Seu perfil não tem permissão para consultar estas informações.'
    : (apiError?.message ?? 'Tente novamente em alguns instantes.');
  const Icon = forbidden
    ? LockKeyhole
    : offline
      ? WifiOff
      : apiError?.kind === 'NETWORK'
        ? ServerOff
        : CircleAlert;

  return (
    <section className={compact ? 'feedback-panel compact' : 'feedback-panel'} role="alert">
      <Icon aria-hidden="true" />
      <div>
        <h2>{title}</h2>
        <p>{message}</p>
        {onRetry === undefined ? null : (
          <button className="secondary-button" type="button" onClick={onRetry}>
            <RefreshCw aria-hidden="true" />
            Tentar novamente
          </button>
        )}
      </div>
    </section>
  );
}
