import { useEffect, useState } from 'react';
import { Download, LoaderCircle, RefreshCw, RotateCw } from 'lucide-react';

import type { UpdateStatus } from '../../shared/electron-api.js';

const timeFormatter = new Intl.DateTimeFormat('pt-BR', {
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'America/Sao_Paulo',
});

/** Live update status of the installed desktop client; `null` outside Electron. */
export function useUpdateStatus(): UpdateStatus | null {
  const [status, setStatus] = useState<UpdateStatus | null>(null);

  useEffect(() => {
    const bridge = window.phPonto;
    if (bridge === undefined) return;
    let active = true;
    const updates = bridge.updates;
    if (updates === undefined) {
      // Older preload without the update API: still show the installed version.
      void bridge.app
        .getInfo()
        .then((info) => {
          if (!active) return;
          setStatus({
            state: info.packaged ? 'idle' : 'disabled',
            currentVersion: info.version,
            availableVersion: null,
            percent: null,
            lastCheckedAt: null,
            updatedFrom: null,
          });
        })
        .catch(() => undefined);
      return () => {
        active = false;
      };
    }
    const unsubscribe = updates.onStatus((next) => {
      if (active) setStatus(next);
    });
    void updates
      .getStatus()
      .then((current) => {
        if (active) setStatus((previous) => previous ?? current);
      })
      .catch(() => undefined);
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  return status;
}

type Tone = 'ok' | 'busy' | 'ready' | 'warn' | 'muted';

interface Presentation {
  tone: Tone;
  text: string;
  detail?: string;
}

function describe(status: UpdateStatus): Presentation {
  const next = status.availableVersion ? `v${status.availableVersion}` : 'nova versão';
  const checkedAt = status.lastCheckedAt
    ? `Última verificação às ${timeFormatter.format(new Date(status.lastCheckedAt))}.`
    : undefined;
  switch (status.state) {
    case 'disabled':
      return { tone: 'muted', text: 'Versão de desenvolvimento' };
    case 'idle':
    case 'checking':
      return { tone: 'busy', text: 'Verificando atualizações…' };
    case 'up-to-date':
      return status.updatedFrom
        ? {
            tone: 'ok',
            text: `Atualizado agora (antes v${status.updatedFrom})`,
            ...(checkedAt ? { detail: checkedAt } : {}),
          }
        : { tone: 'ok', text: 'Atualizado', ...(checkedAt ? { detail: checkedAt } : {}) };
    case 'downloading':
      return {
        tone: 'busy',
        text: `Baixando ${next}${status.percent !== null ? ` · ${status.percent}%` : ''}`,
        detail: 'A atualização é baixada em segundo plano; pode continuar usando.',
      };
    case 'ready':
      return {
        tone: 'ready',
        text: `${next} pronta para instalar`,
        detail: 'Se ninguém usar o computador por alguns minutos, ela é instalada sozinha.',
      };
    case 'installing':
      return { tone: 'busy', text: 'Instalando e reiniciando…' };
    case 'manual':
      return {
        tone: 'warn',
        text: 'Nova versão disponível',
        detail: 'Neste computador a atualização precisa ser baixada manualmente.',
      };
    case 'error':
      return {
        tone: 'warn',
        text: 'Falha ao verificar',
        detail: 'Sem conexão com o servidor de atualizações. Uma nova tentativa é feita sozinha.',
      };
  }
}

/** Installed version and update state, shown on the desktop login screen. */
export function AppVersionBadge(): React.JSX.Element | null {
  const status = useUpdateStatus();
  const [busyAction, setBusyAction] = useState(false);
  if (status === null) return null;

  const updates = window.phPonto?.updates;
  const presentation = describe(status);
  const run = (action: () => Promise<unknown>): void => {
    setBusyAction(true);
    void action()
      .catch(() => undefined)
      .finally(() => setBusyAction(false));
  };

  return (
    <div className="app-version" data-tone={presentation.tone}>
      <div
        className="app-version-pill"
        role="status"
        aria-live="polite"
        title={presentation.detail}
      >
        {presentation.tone === 'busy' ? (
          <LoaderCircle className="app-version-spinner spin" aria-hidden="true" />
        ) : (
          <span className="app-version-dot" aria-hidden="true" />
        )}
        <span className="app-version-number">
          PH-Ponto <strong>v{status.currentVersion}</strong>
        </span>
        <span className="app-version-separator" aria-hidden="true" />
        <span className="app-version-state">{presentation.text}</span>

        {updates !== undefined && status.state === 'ready' && (
          <button
            type="button"
            className="app-version-action primary"
            disabled={busyAction}
            onClick={() => run(() => updates.installNow())}
          >
            <RotateCw aria-hidden="true" />
            Atualizar agora
          </button>
        )}
        {updates !== undefined && status.state === 'error' && (
          <button
            type="button"
            className="app-version-action"
            disabled={busyAction}
            onClick={() => run(() => updates.checkNow())}
          >
            <RefreshCw aria-hidden="true" />
            Tentar de novo
          </button>
        )}
        {updates !== undefined && status.state === 'up-to-date' && (
          <button
            type="button"
            className="app-version-icon-button"
            aria-label="Verificar atualizações agora"
            title="Verificar atualizações agora"
            disabled={busyAction}
            onClick={() => run(() => updates.checkNow())}
          >
            <RefreshCw aria-hidden="true" />
          </button>
        )}
        {updates !== undefined && status.state === 'manual' && (
          <button
            type="button"
            className="app-version-action primary"
            disabled={busyAction}
            onClick={() => run(() => updates.openDownloadPage())}
          >
            <Download aria-hidden="true" />
            Baixar
          </button>
        )}

        {status.state === 'downloading' && (
          <span
            className="app-version-progress"
            role="progressbar"
            aria-label="Download da atualização"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={status.percent ?? 0}
          >
            <span style={{ width: `${status.percent ?? 0}%` }} />
          </span>
        )}
      </div>
      {presentation.detail !== undefined && status.state !== 'up-to-date' && (
        <p className="app-version-detail">{presentation.detail}</p>
      )}
    </div>
  );
}
