import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BUSINESS_TIME_ZONE, DISPLAY_LOCALE } from '@ph-ponto/shared';
import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  LoaderCircle,
  Timer,
  TrendingUp,
  X,
} from 'lucide-react';

import { ApiClientError } from '../api/client.js';
import type { DailyAttendance } from '../api/contracts.js';
import { dailyStateLabel, dailyStateTone } from '../attendance/presentation.js';
import { useAuth } from '../auth/use-auth.js';
import { FeedbackPanel } from '../components/feedback-panel.js';
import { currentBusinessMonth } from '../lib/business-date.js';
import { formatDateBR, formatInstantTime, formatMinutes } from '../lib/format.js';

const clockFormatter = new Intl.DateTimeFormat(DISPLAY_LOCALE, {
  timeZone: BUSINESS_TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
});

function useVisualClock(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1_000);
    return () => window.clearInterval(timer);
  }, []);
  return now;
}

import { Edit3, GitPullRequest } from 'lucide-react';
import { AvatarImage } from '../components/avatar-image.js';
import { AvatarModal } from '../components/avatar-modal.js';
import { RequestAdjustmentModal } from '../components/request-adjustment-modal.js';
import { MyAdjustmentRequestsModal } from '../components/my-adjustment-requests-modal.js';

function TodayTimeline({
  day,
  onSelectPunchForAdjustment,
}: {
  day: DailyAttendance;
  onSelectPunchForAdjustment: (punch: {
    id: string;
    originalOccurredAt: string;
    effectiveOccurredAt: string;
    kind: 'CLOCK_IN' | 'CLOCK_OUT';
  }) => void;
}): React.JSX.Element {
  if (day.chronology.punches.length === 0) {
    return (
      <div className="empty-timeline">
        <Clock3 aria-hidden="true" />
        <p>
          <strong>Nenhum ponto hoje</strong>
          Seu primeiro registro aparecerá aqui.
        </p>
      </div>
    );
  }

  return (
    <ol className="timeline-list" aria-label="Pontos registrados hoje">
      {day.chronology.punches.map((punch, index) => (
        <li key={punch.id} className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="timeline-index" aria-hidden="true">
              {index + 1}
            </span>
            <span>
              <strong>{punch.kind === 'CLOCK_IN' ? 'Entrada' : 'Saída'}</strong>
              {punch.appliedAdjustmentCount > 0 ? <small>Horário corrigido</small> : null}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <time dateTime={punch.effectiveOccurredAt}>
              {formatInstantTime(punch.effectiveOccurredAt)}
            </time>
            <button
              type="button"
              onClick={() => onSelectPunchForAdjustment(punch)}
              title="Solicitar ajuste deste ponto"
              aria-label={`Solicitar ajuste do ponto ${index + 1}`}
              className="p-1 text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition"
            >
              <Edit3 className="w-3.5 h-3.5" />
            </button>
          </div>
        </li>
      ))}
    </ol>
  );
}

function SummaryCard({
  label,
  value,
  icon,
  emphasis,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  emphasis?: 'positive' | 'negative';
}): React.JSX.Element {
  return (
    <div className="summary-card">
      <span className="summary-icon" aria-hidden="true">
        {icon}
      </span>
      <span>
        <small>{label}</small>
        <strong className={emphasis === undefined ? '' : emphasis}>{value}</strong>
      </span>
    </div>
  );
}

export function EmployeeHomePage(): React.JSX.Element {
  const { api, session } = useAuth();
  const queryClient = useQueryClient();
  const now = useVisualClock();
  const [successTime, setSuccessTime] = useState<string | null>(null);
  const [selectedPunchForAdjustment, setSelectedPunchForAdjustment] = useState<{
    id: string;
    originalOccurredAt: string;
    effectiveOccurredAt: string;
    kind: 'CLOCK_IN' | 'CLOCK_OUT';
  } | null>(null);
  const [showMyRequestsModal, setShowMyRequestsModal] = useState(false);
  const [showAvatarModal, setShowAvatarModal] = useState(false);
  const [avatarVersion, setAvatarVersion] = useState(() => Date.now());
  const pendingIdempotencyKey = useRef<string | null>(null);
  const employeeId = session?.user.id ?? '';
  const month = currentBusinessMonth(now);
  const today = useQuery({
    queryKey: ['attendance', employeeId, 'today'],
    queryFn: ({ signal }) => api.getToday(signal),
    refetchInterval: 15_000,
  });
  const monthly = useQuery({
    queryKey: ['attendance', employeeId, 'monthly', month],
    queryFn: ({ signal }) => api.getMonthly(month, signal),
    refetchInterval: 30_000,
  });
  const punch = useMutation({
    mutationFn: async () => {
      pendingIdempotencyKey.current ??= crypto.randomUUID();
      return api.createPunch(pendingIdempotencyKey.current);
    },
    onSuccess: (result) => {
      pendingIdempotencyKey.current = null;
      setSuccessTime(result.punch.effectiveOccurredAt);
      queryClient.setQueryData(['attendance', employeeId, 'today'], result.dailySummary);
      void queryClient.invalidateQueries({ queryKey: ['attendance', employeeId, 'monthly'] });
      void queryClient.invalidateQueries({ queryKey: ['attendance', employeeId, 'history'] });
      window.phPonto?.app.checkForUpdatesInBackground?.();
    },
    onError: (error) => {
      if (!(error instanceof ApiClientError) || error.kind === 'HTTP') {
        pendingIdempotencyKey.current = null;
      }
      if (error instanceof ApiClientError && error.status === 409) {
        void queryClient.invalidateQueries({ queryKey: ['attendance', employeeId, 'today'] });
      }
    },
  });

  const startPunch = (): void => {
    setSuccessTime(null);
    punch.reset();
    punch.mutate();
  };

  if (today.isPending) {
    return (
      <div className="page-loading" aria-live="polite" aria-busy="true">
        <LoaderCircle className="spin" aria-hidden="true" />
        <p>Carregando seu expediente…</p>
      </div>
    );
  }

  if (today.isError) {
    return <FeedbackPanel error={today.error} onRetry={() => void today.refetch()} />;
  }

  const day = today.data;
  const balanceTone =
    day.balanceMinutes === null || day.balanceMinutes === 0
      ? undefined
      : day.balanceMinutes > 0
        ? 'positive'
        : 'negative';
  const punchUnavailable = punch.error instanceof ApiClientError && punch.error.kind === 'NETWORK';

  return (
    <div className="employee-page home-page">
      <header className="employee-page-heading">
        <div className="employee-identity">
          <button
            type="button"
            onClick={() => setShowAvatarModal(true)}
            className="group relative cursor-pointer border-0 bg-transparent p-0 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 shrink-0"
            title="Alterar minha foto de perfil"
            aria-label="Alterar minha foto de perfil"
          >
            <AvatarImage
              userId={employeeId}
              name={session?.user.name ?? ''}
              size="lg"
              cacheKey={avatarVersion}
              className="w-[49px] h-[49px] rounded-full text-sm font-bold shadow-xs ring-1 ring-blue-500/20 group-hover:opacity-90 group-hover:ring-blue-500/60 transition"
            />
          </button>
          <span>
            <p className="eyebrow">Olá, {session?.user.name.split(' ')[0]}</p>
            <h1>Seu ponto de hoje</h1>
          </span>
        </div>
        <div
          className="business-clock"
          aria-label={`Horário de Fortaleza: ${clockFormatter.format(now)}`}
        >
          <time dateTime={now.toISOString()}>{clockFormatter.format(now)}</time>
          <span>{formatDateBR(now)}</span>
        </div>
      </header>

      {successTime !== null && (
        <div className="success-banner" role="status">
          <CheckCircle2 aria-hidden="true" />
          <span>
            <strong>Ponto registrado com sucesso</strong>
            Horário oficial: {formatInstantTime(successTime)}
          </span>
          <button
            type="button"
            aria-label="Fechar confirmação"
            onClick={() => setSuccessTime(null)}
          >
            <X aria-hidden="true" />
          </button>
        </div>
      )}

      <div className="home-grid">
        <section className="punch-panel" aria-labelledby="punch-title">
          <div>
            <p className="eyebrow">Status atual</p>
            <span className={`state-pill ${dailyStateTone(day)}`}>{dailyStateLabel(day)}</span>
            <h2 id="punch-title">Registre seu horário</h2>
            <p>O servidor confirma o horário oficial de cada registro.</p>
          </div>
          <button
            className="punch-button"
            type="button"
            aria-label={punch.isPending ? 'Registrando ponto' : 'Bater ponto'}
            disabled={punch.isPending}
            onClick={startPunch}
          >
            {punch.isPending ? (
              <LoaderCircle className="spin" aria-hidden="true" />
            ) : (
              <Clock3 aria-hidden="true" />
            )}
            <span>{punch.isPending ? 'Registrando…' : 'Bater ponto'}</span>
            <small>
              {punch.isPending ? 'Aguarde a confirmação' : 'Horário definido pelo servidor'}
            </small>
          </button>
          {punch.isError && (
            <div className="punch-error" role="alert">
              <strong>O ponto não foi confirmado.</strong>
              <span>
                {punchUnavailable
                  ? 'Não foi possível registrar o ponto porque o servidor está indisponível. Tente novamente em alguns instantes.'
                  : punch.error instanceof ApiClientError
                    ? punch.error.message
                    : 'Não foi possível registrar o ponto. Tente novamente.'}
              </span>
              {punchUnavailable && (
                <button className="secondary-button" type="button" onClick={startPunch}>
                  Tentar novamente
                </button>
              )}
            </div>
          )}
        </section>

        <section className="timeline-panel" aria-labelledby="timeline-title">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Linha do tempo</p>
              <h2 id="timeline-title">Registros de hoje</h2>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowMyRequestsModal(true)}
                className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition"
              >
                <GitPullRequest className="w-3.5 h-3.5" />
                Minhas Solicitações
              </button>
              <span className="count-badge">{day.punchCount}</span>
            </div>
          </div>
          <TodayTimeline
            day={day}
            onSelectPunchForAdjustment={(selected) => setSelectedPunchForAdjustment(selected)}
          />
        </section>
      </div>

      <RequestAdjustmentModal
        isOpen={selectedPunchForAdjustment !== null}
        onClose={() => setSelectedPunchForAdjustment(null)}
        punch={selectedPunchForAdjustment}
        businessDate={day.businessDate}
      />

      <MyAdjustmentRequestsModal
        isOpen={showMyRequestsModal}
        onClose={() => setShowMyRequestsModal(false)}
      />

      {showAvatarModal && employeeId && (
        <AvatarModal
          isOpen={showAvatarModal}
          onClose={() => setShowAvatarModal(false)}
          userId={employeeId}
          userName={session?.user.name ?? ''}
          hasAvatar={true}
          onAvatarUpdated={() => {
            setAvatarVersion(Date.now());
            void queryClient.invalidateQueries({ queryKey: ['users'] });
            void queryClient.invalidateQueries({ queryKey: ['employees'] });
          }}
        />
      )}

      <section className="summary-grid" aria-label="Resumo de horas">
        <SummaryCard
          label="Trabalhado hoje"
          value={formatMinutes(day.workedMinutes)}
          icon={<Timer />}
        />
        <SummaryCard
          label="Esperado hoje"
          value={formatMinutes(day.expectedMinutes)}
          icon={<CalendarDays />}
        />
        <SummaryCard
          label="Saldo do dia"
          value={formatMinutes(day.balanceMinutes, true)}
          {...(balanceTone === undefined ? {} : { emphasis: balanceTone })}
          icon={<TrendingUp />}
        />
        {monthly.isPending ? (
          <div className="summary-card loading" aria-label="Carregando saldo do mês">
            <LoaderCircle className="spin" aria-hidden="true" />
            <span>
              <small>Saldo do mês</small>
              <strong>Carregando…</strong>
            </span>
          </div>
        ) : monthly.isError ? (
          <div className="summary-card error">
            <Clock3 aria-hidden="true" />
            <span>
              <small>Saldo do mês</small>
              <button type="button" onClick={() => void monthly.refetch()}>
                Tentar novamente
              </button>
            </span>
          </div>
        ) : (
          <SummaryCard
            label="Saldo do mês"
            value={formatMinutes(monthly.data.totals.balanceMinutes, true)}
            {...(monthly.data.totals.balanceMinutes === 0
              ? {}
              : {
                  emphasis:
                    monthly.data.totals.balanceMinutes > 0
                      ? ('positive' as const)
                      : ('negative' as const),
                })}
            icon={<Clock3 />}
          />
        )}
      </section>
    </div>
  );
}
