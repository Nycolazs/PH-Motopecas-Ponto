import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CalendarRange, Edit3, GitPullRequest, LoaderCircle, Search } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { dailyStateLabel, dailyStateTone } from '../attendance/presentation.js';
import { useAuth } from '../auth/use-auth.js';
import { FeedbackPanel } from '../components/feedback-panel.js';
import { MyAdjustmentRequestsModal } from '../components/my-adjustment-requests-modal.js';
import { RequestAdjustmentModal } from '../components/request-adjustment-modal.js';
import {
  businessDateFromInstant,
  formatBusinessDate,
  resolveHistoryRange,
  type DateRange,
  type HistoryPreset,
} from '../lib/business-date.js';
import { formatDateBR, formatInstantTime, formatMinutes } from '../lib/format.js';

const presetLabels: Record<HistoryPreset, string> = {
  TODAY: 'Hoje',
  THIS_WEEK: 'Esta semana',
  THIS_MONTH: 'Este mês',
  PREVIOUS_MONTH: 'Mês anterior',
  CUSTOM: 'Período personalizado',
};

const customRangeSchema = z
  .object({
    from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Informe a data inicial.'),
    to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Informe a data final.'),
  })
  .superRefine((value, context) => {
    if (value.from > value.to) {
      context.addIssue({
        code: 'custom',
        path: ['to'],
        message: 'A data final deve ser igual ou posterior à inicial.',
      });
    }
    if (value.to > businessDateFromInstant()) {
      context.addIssue({
        code: 'custom',
        path: ['to'],
        message: 'A data final não pode estar no futuro.',
      });
    }
    const elapsed = Date.parse(`${value.to}T12:00:00Z`) - Date.parse(`${value.from}T12:00:00Z`);
    if (Number.isFinite(elapsed) && elapsed > 365 * 86_400_000) {
      context.addIssue({
        code: 'custom',
        path: ['to'],
        message: 'O período pode ter no máximo 366 dias.',
      });
    }
  });

type CustomRangeForm = z.infer<typeof customRangeSchema>;

export function HistoryPage(): React.JSX.Element {
  const { api, session } = useAuth();
  const initialRange = useMemo(() => resolveHistoryRange('THIS_WEEK'), []);
  const [preset, setPreset] = useState<HistoryPreset>('THIS_WEEK');
  const [range, setRange] = useState<DateRange>(initialRange);
  const [selectedPunchForAdjustment, setSelectedPunchForAdjustment] = useState<{
    id: string;
    originalOccurredAt: string;
    effectiveOccurredAt: string;
    kind: 'CLOCK_IN' | 'CLOCK_OUT';
    businessDate: string;
  } | null>(null);
  const [showMyRequestsModal, setShowMyRequestsModal] = useState(false);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<CustomRangeForm>({ defaultValues: initialRange });
  const history = useQuery({
    queryKey: ['attendance', session?.user.id ?? '', 'history', range.from, range.to],
    queryFn: ({ signal }) => api.getHistory(range.from, range.to, signal),
  });

  const selectPreset = (nextPreset: Exclude<HistoryPreset, 'CUSTOM'>): void => {
    setPreset(nextPreset);
    setRange(resolveHistoryRange(nextPreset));
  };

  const applyCustomRange = (values: CustomRangeForm): void => {
    const parsed = customRangeSchema.safeParse(values);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const field = issue.path[0];
        if (field === 'from' || field === 'to') setError(field, { message: issue.message });
      }
      return;
    }
    setRange(parsed.data);
  };

  return (
    <div className="employee-page history-page">
      <header className="employee-page-heading history-heading">
        <div>
          <p className="eyebrow">Minha jornada</p>
          <h1>Histórico de pontos</h1>
          <p>Consulte seus registros, horas esperadas e saldo por período.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setShowMyRequestsModal(true)}
            className="px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs transition"
          >
            <GitPullRequest className="w-3.5 h-3.5" />
            Minhas Solicitações
          </button>
          <div className="range-summary">
            <CalendarRange aria-hidden="true" />
            <span>
              {formatDateBR(range.from)} — {formatDateBR(range.to)}
            </span>
          </div>
        </div>
      </header>

      <section className="history-filters" aria-label="Filtros do histórico">
        <div className="filter-tabs" role="group" aria-label="Períodos rápidos">
          {(Object.keys(presetLabels) as HistoryPreset[]).map((item) => (
            <button
              type="button"
              key={item}
              className={preset === item ? 'active' : ''}
              aria-pressed={preset === item}
              onClick={() => {
                if (item === 'CUSTOM') setPreset('CUSTOM');
                else selectPreset(item);
              }}
            >
              {presetLabels[item]}
            </button>
          ))}
        </div>
        {preset === 'CUSTOM' && (
          <form
            className="custom-range"
            onSubmit={(event) => void handleSubmit(applyCustomRange)(event)}
            noValidate
          >
            <div>
              <label htmlFor="range-from">Data inicial</label>
              <input
                id="range-from"
                type="date"
                max={businessDateFromInstant()}
                aria-invalid={errors.from !== undefined}
                {...register('from')}
              />
              {errors.from !== undefined && <p className="field-error">{errors.from.message}</p>}
            </div>
            <div>
              <label htmlFor="range-to">Data final</label>
              <input
                id="range-to"
                type="date"
                max={businessDateFromInstant()}
                aria-invalid={errors.to !== undefined}
                {...register('to')}
              />
              {errors.to !== undefined && <p className="field-error">{errors.to.message}</p>}
            </div>
            <button className="secondary-button" type="submit">
              <Search aria-hidden="true" /> Aplicar período
            </button>
          </form>
        )}
      </section>

      {history.isPending ? (
        <div className="page-loading compact" aria-live="polite" aria-busy="true">
          <LoaderCircle className="spin" aria-hidden="true" />
          <p>Carregando histórico…</p>
        </div>
      ) : history.isError ? (
        <FeedbackPanel error={history.error} onRetry={() => void history.refetch()} compact />
      ) : history.data.days.length === 0 ? (
        <div className="empty-history">
          <CalendarRange aria-hidden="true" />
          <h2>Nenhum dia encontrado</h2>
          <p>Não há registros para o período selecionado.</p>
        </div>
      ) : (
        <>
          <section className="history-totals" aria-label="Totais do período">
            <span>
              <small>Trabalhado</small>
              <strong>{formatMinutes(history.data.totals.workedMinutes)}</strong>
            </span>
            <span>
              <small>Esperado</small>
              <strong>{formatMinutes(history.data.totals.expectedMinutes)}</strong>
            </span>
            <span>
              <small>Saldo</small>
              <strong
                className={
                  history.data.totals.balanceMinutes < 0
                    ? 'negative'
                    : history.data.totals.balanceMinutes > 0
                      ? 'positive'
                      : ''
                }
              >
                {formatMinutes(history.data.totals.balanceMinutes, true)}
              </strong>
            </span>
            <span>
              <small>Dias incompletos</small>
              <strong>{history.data.totals.incompleteDayCount}</strong>
            </span>
          </section>

          <section className="history-table-panel" aria-labelledby="history-list-title">
            <h2 id="history-list-title" className="sr-only">
              Dias do período
            </h2>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Status</th>
                    <th>Pontos</th>
                    <th>Trabalhado</th>
                    <th>Esperado</th>
                    <th>Saldo</th>
                  </tr>
                </thead>
                <tbody>
                  {history.data.days.map((day) => (
                    <tr key={day.businessDate}>
                      <td>
                        <time dateTime={day.businessDate}>
                          {formatBusinessDate(day.businessDate)}
                        </time>
                      </td>
                      <td>
                        <span className={`state-pill small ${dailyStateTone(day)}`}>
                          {dailyStateLabel(day)}
                        </span>
                      </td>
                      <td>
                        {day.chronology.punches.length === 0 ? (
                          <span className="muted">—</span>
                        ) : (
                          <span className="punch-times">
                            {day.chronology.punches.map((item) => (
                              <span key={item.id} className="inline-flex items-center gap-1 group">
                                <time dateTime={item.effectiveOccurredAt}>
                                  {formatInstantTime(item.effectiveOccurredAt)}
                                </time>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setSelectedPunchForAdjustment({
                                      id: item.id,
                                      originalOccurredAt: item.originalOccurredAt,
                                      effectiveOccurredAt: item.effectiveOccurredAt,
                                      kind: item.kind,
                                      businessDate: day.businessDate,
                                    })
                                  }
                                  title="Solicitar ajuste deste ponto"
                                  aria-label="Solicitar ajuste do ponto"
                                  className="text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 p-0.5 rounded transition opacity-60 group-hover:opacity-100"
                                >
                                  <Edit3 className="w-3 h-3" />
                                </button>
                              </span>
                            ))}
                          </span>
                        )}
                      </td>
                      <td>{formatMinutes(day.workedMinutes)}</td>
                      <td>{formatMinutes(day.expectedMinutes)}</td>
                      <td
                        className={
                          day.balanceMinutes !== null && day.balanceMinutes < 0
                            ? 'negative'
                            : day.balanceMinutes !== null && day.balanceMinutes > 0
                              ? 'positive'
                              : ''
                        }
                      >
                        {formatMinutes(day.balanceMinutes, true)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      {selectedPunchForAdjustment && (
        <RequestAdjustmentModal
          isOpen={true}
          onClose={() => setSelectedPunchForAdjustment(null)}
          punch={selectedPunchForAdjustment}
          businessDate={selectedPunchForAdjustment.businessDate}
        />
      )}

      <MyAdjustmentRequestsModal
        isOpen={showMyRequestsModal}
        onClose={() => setShowMyRequestsModal(false)}
      />
    </div>
  );
}
