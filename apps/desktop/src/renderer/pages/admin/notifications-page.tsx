import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Loader2,
  MessageCircle,
  QrCode,
  RefreshCw,
  Send,
  Smartphone,
  Unplug,
  Users,
  XCircle,
} from 'lucide-react';
import { Link } from 'react-router-dom';

import { ApiClientError } from '../../api/client.js';
import type {
  LateArrivalSettings,
  NotificationOutboxItem,
  NotificationRecipient,
  WhatsappStatus,
} from '../../api/contracts.js';
import { useApiClient } from '../../auth/use-auth.js';
import { FeedbackPanel } from '../../components/feedback-panel.js';
import { PageHeader, headerButton } from '../../components/page-header.js';
import { useToast } from '../../components/toast-context.js';
import { formatDisplayName, formatInstantDateTime } from '../../lib/format.js';

const CARD =
  'rounded-xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900';

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiClientError ? error.message : fallback;
}

/**
 * Masks what the administrator types as a Brazilian phone: (85) 99999-0000.
 * Numbers typed with "+" keep the international form (+ and digits only).
 */
export function maskWhatsappInput(value: string): string {
  if (value.trim().startsWith('+')) return `+${value.replace(/\D/g, '').slice(0, 15)}`;
  let digits = value.replace(/\D/g, '');
  if (digits.length > 11 && digits.startsWith('55')) digits = digits.slice(2);
  digits = digits.slice(0, 11);
  if (digits.length === 0) return '';
  if (digits.length <= 2) return `(${digits}`;
  const area = digits.slice(0, 2);
  const local = digits.slice(2);
  const split = local.length > 8 ? 5 : 4;
  if (local.length <= split) return `(${area}) ${local}`;
  return `(${area}) ${local.slice(0, split)}-${local.slice(split)}`;
}

/** Whether a masked value is complete enough to save (DDD + 8 or 9 digits). */
export function isCompleteWhatsapp(value: string): boolean {
  const digits = value.replace(/\D/g, '');
  return value.trim().startsWith('+')
    ? digits.length >= 10
    : digits.length === 10 || digits.length === 11;
}

/** Formats 5585999990000 as +55 (85) 99999-0000 for display. */
export function formatWhatsapp(phone: string | null): string {
  if (!phone) return '';
  const match = /^55(\d{2})(\d{4,5})(\d{4})$/.exec(phone);
  return match ? `(${match[1]}) ${match[2]}-${match[3]}` : `+${phone}`;
}

const STATE_LABEL: Record<WhatsappStatus['state'], { label: string; tone: string }> = {
  CONNECTED: {
    label: 'Conectado',
    tone: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300',
  },
  WAITING_QR: {
    label: 'Aguardando leitura do QR Code',
    tone: 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300',
  },
  CONNECTING: {
    label: 'Conectando...',
    tone: 'bg-sky-50 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300',
  },
  DISCONNECTED: {
    label: 'Desconectado',
    tone: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  },
  ERROR: {
    label: 'Erro na conexão',
    tone: 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300',
  },
  UNAVAILABLE: {
    label: 'Serviço indisponível',
    tone: 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300',
  },
  NOT_CONFIGURED: {
    label: 'Não configurado no servidor',
    tone: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  },
};

export function AdminNotificationsPage(): React.JSX.Element {
  const api = useApiClient();
  const settingsQuery = useQuery({
    queryKey: ['notification-settings'],
    queryFn: ({ signal }) => api.getNotificationSettings(signal),
  });

  return (
    <div className="space-y-5">
      <PageHeader
        title="Alertas no WhatsApp"
        icon={MessageCircle}
        description="Avise os administradores pelo WhatsApp quando um colaborador chegar atrasado."
      />
      {settingsQuery.isError ? (
        <FeedbackPanel error={settingsQuery.error} onRetry={() => void settingsQuery.refetch()} />
      ) : settingsQuery.isLoading || !settingsQuery.data ? (
        <div
          className={`${CARD} flex items-center justify-center gap-2 py-12 text-sm text-slate-500`}
        >
          <Loader2 className="h-5 w-5 animate-spin text-blue-600" aria-hidden="true" />
          Carregando configurações...
        </div>
      ) : (
        <>
          <WhatsappConnectionCard status={settingsQuery.data.whatsapp} />
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
            <LateArrivalCard settings={settingsQuery.data.lateArrival} />
            <RecipientsCard
              recipients={settingsQuery.data.recipients}
              whatsappConnected={settingsQuery.data.whatsapp.state === 'CONNECTED'}
            />
          </div>
          <OutboxCard />
        </>
      )}
    </div>
  );
}

function WhatsappConnectionCard({ status }: { status: WhatsappStatus }): React.JSX.Element {
  const api = useApiClient();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const waiting = status.state === 'WAITING_QR' || status.state === 'CONNECTING';

  // While pairing, refresh the QR code and the status every few seconds.
  const qrQuery = useQuery({
    queryKey: ['whatsapp-qr'],
    queryFn: ({ signal }) => api.getWhatsappQr(signal),
    enabled: waiting,
    refetchInterval: 4_000,
  });
  useEffect(() => {
    const next = qrQuery.data?.status.state;
    if (next !== undefined && next !== status.state) {
      void queryClient.invalidateQueries({ queryKey: ['notification-settings'] });
      if (next === 'CONNECTED') toast.success('WhatsApp conectado com sucesso.');
    }
  }, [qrQuery.data, status.state, queryClient, toast]);

  const connect = useMutation({
    mutationFn: () => api.connectWhatsapp(),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['notification-settings'] }),
    onError: (error) => toast.error(errorMessage(error, 'Não foi possível iniciar a conexão.')),
  });
  const disconnect = useMutation({
    mutationFn: () => api.disconnectWhatsapp(),
    onSuccess: () => {
      setConfirmDisconnect(false);
      toast.success('WhatsApp desconectado.');
      void queryClient.invalidateQueries({ queryKey: ['notification-settings'] });
    },
    onError: (error) => toast.error(errorMessage(error, 'Não foi possível desconectar.')),
  });

  const badge = STATE_LABEL[status.state];
  const qrCode = qrQuery.data?.qrCode ?? null;

  return (
    <section aria-labelledby="whatsapp-title" className={CARD}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <h2
            id="whatsapp-title"
            className="flex items-center gap-2 text-base font-bold text-slate-900 dark:text-white"
          >
            <Smartphone className="h-4 w-4 text-emerald-600" aria-hidden="true" />
            WhatsApp da loja
          </h2>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${badge.tone}`}>
              {badge.label}
            </span>
            {status.state === 'CONNECTED' && status.phone && (
              <span className="text-slate-600 dark:text-slate-300">
                Enviando pelo número <strong>{formatWhatsapp(status.phone)}</strong>
              </span>
            )}
          </div>
          <p className="mt-2 max-w-2xl text-xs text-slate-500 dark:text-slate-400">
            {status.state === 'NOT_CONFIGURED'
              ? 'O serviço de WhatsApp ainda não foi instalado no servidor. Fale com o suporte técnico para ativar.'
              : status.state === 'UNAVAILABLE'
                ? 'O serviço de WhatsApp do servidor não respondeu. Ele reinicia sozinho; tente novamente em instantes.'
                : status.state === 'CONNECTED'
                  ? 'Os alertas são enviados por este número. Ele precisa continuar com o WhatsApp instalado e com internet.'
                  : 'Use um número de WhatsApp da loja (de preferência um chip só para isso). As mensagens saem desse número.'}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {(status.state === 'DISCONNECTED' || status.state === 'ERROR') && (
            <button
              type="button"
              className={headerButton.primary}
              onClick={() => connect.mutate()}
              disabled={connect.isPending}
            >
              {connect.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <QrCode className="h-4 w-4" aria-hidden="true" />
              )}
              Conectar WhatsApp
            </button>
          )}
          {status.state === 'CONNECTED' &&
            (confirmDisconnect ? (
              <>
                <button
                  type="button"
                  className={headerButton.danger}
                  onClick={() => disconnect.mutate()}
                  disabled={disconnect.isPending}
                >
                  <Unplug className="h-4 w-4" aria-hidden="true" />
                  Confirmar desconexão
                </button>
                <button
                  type="button"
                  className={headerButton.secondary}
                  onClick={() => setConfirmDisconnect(false)}
                >
                  Cancelar
                </button>
              </>
            ) : (
              <button
                type="button"
                className={headerButton.secondary}
                onClick={() => setConfirmDisconnect(true)}
              >
                <Unplug className="h-4 w-4" aria-hidden="true" />
                Desconectar
              </button>
            ))}
        </div>
      </div>

      {waiting && (
        <div className="mt-5 flex flex-col items-center gap-5 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5 dark:border-slate-700 dark:bg-slate-800/40 md:flex-row md:items-start">
          <div className="flex h-56 w-56 shrink-0 items-center justify-center rounded-lg bg-white p-2 shadow-xs">
            {qrCode ? (
              <img src={qrCode} alt="QR Code para conectar o WhatsApp" className="h-full w-full" />
            ) : (
              <Loader2
                className="h-8 w-8 animate-spin text-slate-400"
                aria-label="Gerando QR Code"
              />
            )}
          </div>
          <ol className="list-decimal space-y-2 pl-5 text-sm text-slate-700 dark:text-slate-200">
            <li>Abra o WhatsApp no celular da loja.</li>
            <li>
              Toque em <strong>Mais opções (⋮)</strong> ou <strong>Configurações</strong> e depois
              em <strong>Aparelhos conectados</strong>.
            </li>
            <li>
              Toque em <strong>Conectar um aparelho</strong> e aponte a câmera para o QR Code.
            </li>
            <li className="text-xs text-slate-500 dark:text-slate-400">
              O código se renova sozinho. Esta tela atualiza assim que a conexão for concluída.
            </li>
          </ol>
        </div>
      )}
    </section>
  );
}

function LateArrivalCard({ settings }: { settings: LateArrivalSettings }): React.JSX.Element {
  const api = useApiClient();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [draftEnabled, setDraftEnabled] = useState(settings.enabled);
  useEffect(() => setDraftEnabled(settings.enabled), [settings.enabled]);
  const dirty = draftEnabled !== settings.enabled;
  const tolerance = settings.toleranceMinutes;

  const save = useMutation({
    mutationFn: () => api.updateLateArrivalSettings({ enabled: draftEnabled }),
    onSuccess: () => {
      toast.success(
        draftEnabled ? 'Alertas de atraso ativados.' : 'Alertas de atraso desativados.',
      );
      void queryClient.invalidateQueries({ queryKey: ['notification-settings'] });
    },
    onError: (error) => toast.error(errorMessage(error, 'Não foi possível salvar.')),
  });

  return (
    <section aria-labelledby="late-title" className={CARD}>
      <h2
        id="late-title"
        className="flex items-center gap-2 text-base font-bold text-slate-900 dark:text-white"
      >
        <Clock className="h-4 w-4 text-amber-600" aria-hidden="true" />
        Regra do atraso
      </h2>
      <label className="mt-4 flex cursor-pointer items-center gap-3 text-sm font-medium text-slate-800 dark:text-slate-100">
        <input
          type="checkbox"
          checked={draftEnabled}
          onChange={(event) => setDraftEnabled(event.target.checked)}
          className="h-4 w-4 rounded border-slate-300 text-blue-600"
        />
        Enviar alerta de atraso
      </label>
      <dl className="mt-4 rounded-lg border border-slate-200 p-3 dark:border-slate-800">
        <dt className="text-xs font-semibold text-slate-500 dark:text-slate-400">Tolerância</dt>
        <dd className="mt-0.5 text-lg font-bold text-slate-900 dark:text-white">
          {tolerance} {tolerance === 1 ? 'minuto' : 'minutos'}
        </dd>
        <dd className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          {settings.source === 'REGULATION' ? (
            <>
              Definida no Regimento Interno
              {settings.regulationVersion !== null ? ` (versão ${settings.regulationVersion})` : ''}
              .
            </>
          ) : (
            <>Padrão de 5 minutos: ainda não há Regimento Interno publicado.</>
          )}{' '}
          <Link
            to="/admin/documentos/regimento"
            className="font-semibold text-blue-600 hover:underline dark:text-blue-400"
          >
            Alterar no Regimento
          </Link>
        </dd>
      </dl>
      <p className="mt-4 rounded-lg bg-slate-50 p-3 text-xs leading-relaxed text-slate-600 dark:bg-slate-800/50 dark:text-slate-300">
        {draftEnabled
          ? `Se a primeira entrada do dia for registrada mais de ${tolerance} min depois do horário de abertura, os administradores marcados recebem o nome do colaborador e a hora em que ele entrou. Folgas, feriados e férias não geram alerta.`
          : 'Nenhum alerta de atraso será enviado.'}
      </p>
      <button
        type="button"
        className={`${headerButton.primary} mt-4`}
        onClick={() => save.mutate()}
        disabled={!dirty || save.isPending}
      >
        {save.isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
        Salvar regra
      </button>
    </section>
  );
}

function RecipientsCard({
  recipients,
  whatsappConnected,
}: {
  recipients: NotificationRecipient[];
  whatsappConnected: boolean;
}): React.JSX.Element {
  return (
    <section aria-labelledby="recipients-title" className={CARD}>
      <h2
        id="recipients-title"
        className="flex items-center gap-2 text-base font-bold text-slate-900 dark:text-white"
      >
        <Users className="h-4 w-4 text-blue-600" aria-hidden="true" />
        Quem recebe os alertas
      </h2>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
        Informe o WhatsApp de cada administrador que deve ser avisado.
      </p>
      <ul className="mt-4 divide-y divide-slate-100 dark:divide-slate-800">
        {recipients.map((recipient) => (
          <RecipientRow
            key={recipient.userId}
            recipient={recipient}
            whatsappConnected={whatsappConnected}
          />
        ))}
      </ul>
    </section>
  );
}

function RecipientRow({
  recipient,
  whatsappConnected,
}: {
  recipient: NotificationRecipient;
  whatsappConnected: boolean;
}): React.JSX.Element {
  const api = useApiClient();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [phone, setPhone] = useState(formatWhatsapp(recipient.whatsappPhone));
  const [alerts, setAlerts] = useState(recipient.lateArrivalAlerts);
  useEffect(() => {
    setPhone(formatWhatsapp(recipient.whatsappPhone));
    setAlerts(recipient.lateArrivalAlerts);
  }, [recipient.whatsappPhone, recipient.lateArrivalAlerts]);

  const dirty =
    phone !== formatWhatsapp(recipient.whatsappPhone) || alerts !== recipient.lateArrivalAlerts;
  const phoneIncomplete = phone.trim() !== '' && !isCompleteWhatsapp(phone);
  const name = formatDisplayName(recipient.name);

  const save = useMutation({
    mutationFn: () =>
      api.updateNotificationRecipient(recipient.userId, {
        whatsappPhone: phone.trim() === '' ? null : phone,
        lateArrivalAlerts: phone.trim() === '' ? false : alerts,
      }),
    onSuccess: () => {
      toast.success(`Contato de ${name} salvo.`);
      void queryClient.invalidateQueries({ queryKey: ['notification-settings'] });
    },
    onError: (error) => toast.error(errorMessage(error, 'Não foi possível salvar o contato.')),
  });
  const test = useMutation({
    mutationFn: () => api.sendNotificationTest(recipient.userId),
    onSuccess: () => {
      toast.success(`Mensagem de teste enviada para ${name}.`);
      void queryClient.invalidateQueries({ queryKey: ['notification-outbox'] });
    },
    onError: (error) => toast.error(errorMessage(error, 'Não foi possível enviar o teste.')),
  });

  return (
    <li className="flex flex-col gap-3 py-3 lg:flex-row lg:items-center">
      <div className="min-w-0 lg:w-48">
        <div className="truncate text-sm font-semibold text-slate-900 dark:text-white">{name}</div>
        <div className="text-[11px] text-slate-500">@{recipient.login}</div>
      </div>
      <div className="flex flex-1 flex-wrap items-center gap-3">
        <input
          type="tel"
          value={phone}
          onChange={(event) => setPhone(maskWhatsappInput(event.target.value))}
          placeholder="(85) 99999-0000"
          inputMode="tel"
          autoComplete="tel"
          maxLength={20}
          aria-label={`WhatsApp de ${name}`}
          aria-invalid={phoneIncomplete}
          aria-describedby={phoneIncomplete ? `phone-hint-${recipient.userId}` : undefined}
          className="h-9 w-44 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
        />
        <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-200">
          <input
            type="checkbox"
            checked={alerts}
            disabled={phone.trim() === ''}
            onChange={(event) => setAlerts(event.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-blue-600"
          />
          Recebe alertas de atraso
        </label>
        {phoneIncomplete && (
          <p
            id={`phone-hint-${recipient.userId}`}
            role="alert"
            className="w-full text-xs font-semibold text-rose-600"
          >
            Número incompleto: use DDD + número, ex.: (85) 99999-0000.
          </p>
        )}
      </div>
      <div className="flex shrink-0 gap-2">
        <button
          type="button"
          className={headerButton.secondary}
          onClick={() => test.mutate()}
          disabled={!recipient.whatsappPhone || !whatsappConnected || dirty || test.isPending}
          title={
            !whatsappConnected
              ? 'Conecte o WhatsApp da loja para enviar testes.'
              : dirty
                ? 'Salve o contato antes de testar.'
                : undefined
          }
        >
          <Send className="h-4 w-4" aria-hidden="true" />
          Testar
        </button>
        <button
          type="button"
          className={headerButton.primary}
          onClick={() => save.mutate()}
          disabled={!dirty || phoneIncomplete || save.isPending}
        >
          {save.isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          Salvar
        </button>
      </div>
    </li>
  );
}

function OutboxCard(): React.JSX.Element {
  const api = useApiClient();
  const outbox = useQuery({
    queryKey: ['notification-outbox'],
    queryFn: ({ signal }) => api.getNotificationOutbox(signal),
    refetchInterval: 15_000,
  });

  return (
    <section aria-labelledby="outbox-title" className={`${CARD} p-0`}>
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3 dark:border-slate-800">
        <h2 id="outbox-title" className="text-base font-bold text-slate-900 dark:text-white">
          Últimas mensagens
        </h2>
        <button
          type="button"
          onClick={() => void outbox.refetch()}
          className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 cursor-pointer"
          aria-label="Atualizar lista de mensagens"
        >
          <RefreshCw className={`h-4 w-4 ${outbox.isFetching ? 'animate-spin' : ''}`} />
        </button>
      </div>
      {outbox.isError ? (
        <div className="p-4">
          <FeedbackPanel error={outbox.error} onRetry={() => void outbox.refetch()} compact />
        </div>
      ) : !outbox.data || outbox.data.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
          {outbox.isLoading ? 'Carregando...' : 'Nenhuma mensagem enviada ainda.'}
        </p>
      ) : (
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {outbox.data.map((item) => (
            <OutboxRow key={item.id} item={item} />
          ))}
        </ul>
      )}
    </section>
  );
}

function OutboxRow({ item }: { item: NotificationOutboxItem }): React.JSX.Element {
  const status =
    item.status === 'SENT'
      ? { icon: CheckCircle2, label: 'Enviada', tone: 'text-emerald-600' }
      : item.status === 'FAILED'
        ? { icon: XCircle, label: 'Falhou', tone: 'text-rose-600' }
        : { icon: AlertTriangle, label: 'Na fila', tone: 'text-amber-600' };
  const StatusIcon = status.icon;
  return (
    <li className="flex flex-col gap-1 px-5 py-3 text-sm md:flex-row md:items-center md:gap-4">
      <span className="w-36 shrink-0 text-xs tabular-nums text-slate-500">
        {formatInstantDateTime(item.createdAt)}
      </span>
      <span className="min-w-0 flex-1 text-slate-800 dark:text-slate-100">
        {item.kind === 'TEST'
          ? 'Mensagem de teste'
          : `Atraso de ${item.subjectName ? formatDisplayName(item.subjectName) : 'colaborador'}`}
        <span className="text-slate-400">
          {' '}
          →{' '}
          {item.recipientName ? formatDisplayName(item.recipientName) : formatWhatsapp(item.phone)}
        </span>
        {item.status !== 'SENT' && item.lastError && (
          <span className="block text-xs text-slate-500">{item.lastError}</span>
        )}
      </span>
      <span
        className={`inline-flex shrink-0 items-center gap-1 text-xs font-semibold ${status.tone}`}
      >
        <StatusIcon className="h-3.5 w-3.5" aria-hidden="true" />
        {status.label}
      </span>
    </li>
  );
}
