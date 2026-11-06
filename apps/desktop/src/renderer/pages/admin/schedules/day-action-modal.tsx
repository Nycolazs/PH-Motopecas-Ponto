import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeftRight, CalendarOff, Clock, Info, Loader2, Undo2 } from 'lucide-react';

import { ApiClientError } from '../../../api/client.js';
import type { ScheduleCell } from '../../../api/schedule-contracts.js';
import { useApiClient } from '../../../auth/use-auth.js';
import { Modal } from '../../../components/modal.js';
import { useToast } from '../../../components/toast-context.js';
import { businessDateFromInstant } from '../../../lib/business-date.js';
import { formatDisplayName } from '../../../lib/format.js';
import { IssueList } from './schedule-editor-modal.js';
import {
  dayMonth,
  minuteToTime,
  shiftLabel,
  statusLabel,
  timeToMinute,
  WEEKDAY_LONG,
} from './schedule-ui.js';

type Action = 'SWAP' | 'DAY_OFF' | 'HOURS' | 'UNDO';

interface DayActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  employee: { id: string; name: string };
  cell: ScheduleCell | null;
  /** The person's other days on screen, to pick the other side of a swap. */
  otherDays: readonly ScheduleCell[];
}

function describe(cell: ScheduleCell): string {
  return `${WEEKDAY_LONG[cell.weekday]}, ${dayMonth(cell.businessDate)}`;
}

/** Changes one day of one person: move a rest day, give a day off, change hours, or undo. */
export function DayActionModal({
  isOpen,
  onClose,
  employee,
  cell,
  otherDays,
}: DayActionModalProps): React.JSX.Element | null {
  const api = useApiClient();
  const toast = useToast();
  const queryClient = useQueryClient();
  const today = businessDateFromInstant();
  const [action, setAction] = useState<Action>('SWAP');
  const [otherDate, setOtherDate] = useState('');
  const [note, setNote] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [breakStart, setBreakStart] = useState('');
  const [breakEnd, setBreakEnd] = useState('');
  const [problems, setProblems] = useState<string[]>([]);
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || cell === null) return;
    setAction(cell.overrideId ? 'UNDO' : 'SWAP');
    setOtherDate('');
    setNote('');
    setStart(minuteToTime(cell.startMinute) || '08:00');
    setEnd(minuteToTime(cell.endMinute) || '17:00');
    setBreakStart(minuteToTime(cell.breakStartMinute));
    setBreakEnd(minuteToTime(cell.breakEndMinute));
    setProblems([]);
    setConfirm(false);
    setError(null);
  }, [isOpen, cell]);

  const isRest = cell?.status === 'REST';
  const swapTargetStatus = isRest ? 'WORK' : 'REST';
  const candidates = otherDays.filter(
    (day) =>
      day.businessDate >= today &&
      day.businessDate !== cell?.businessDate &&
      day.status === swapTargetStatus &&
      day.overrideId === null,
  );

  const run = useMutation({
    mutationFn: async () => {
      if (cell === null) return;
      const trimmed = note.trim();
      if (action === 'UNDO') {
        await api.revokeScheduleOverride(cell.overrideId!, trimmed);
        return;
      }
      if (action === 'SWAP') {
        await api.moveRestDay({
          employeeId: employee.id,
          restDate: isRest ? cell.businessDate : otherDate,
          newRestDate: isRest ? otherDate : cell.businessDate,
          note: trimmed,
          confirmIssues: confirm,
        });
        return;
      }
      await api.createScheduleAdjustment({
        employeeId: employee.id,
        businessDate: cell.businessDate,
        note: trimmed,
        ...(action === 'DAY_OFF'
          ? { isWorkday: false }
          : {
              isWorkday: true,
              startMinute: timeToMinute(start),
              endMinute: timeToMinute(end),
              breakStartMinute: timeToMinute(breakStart),
              breakEndMinute: timeToMinute(breakEnd),
            }),
      });
    },
    onSuccess: async () => {
      toast.success(action === 'UNDO' ? 'Alteração desfeita.' : 'Escala do dia atualizada.');
      await queryClient.invalidateQueries({ queryKey: ['team-schedule'] });
      await queryClient.invalidateQueries({ queryKey: ['employee-schedule', employee.id] });
      onClose();
    },
    onError: (err) => {
      if (err instanceof ApiClientError && err.code === 'SCHEDULE_COMPLIANCE_ISSUES') {
        setProblems(Object.values(err.details ?? {}).flat());
        setError(err.message);
        return;
      }
      setError(err instanceof ApiClientError ? err.message : 'Não foi possível salvar.');
    },
  });

  if (cell === null) return null;
  const name = formatDisplayName(employee.name);
  const isPast = cell.businessDate < today;
  const editable =
    !isPast && (cell.status === 'WORK' || cell.status === 'REST' || cell.overrideId !== null);
  const noteValid = note.trim().length >= 3;
  const ready =
    noteValid &&
    (action !== 'SWAP' || otherDate !== '') &&
    (action !== 'HOURS' || (timeToMinute(start) !== null && timeToMinute(end) !== null)) &&
    (problems.length === 0 || confirm);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`${name} · ${describe(cell)}`} maxWidth="lg">
      <div className="space-y-4 text-sm">
        <p className="rounded-lg bg-slate-50 p-3 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
          Hoje está como:{' '}
          <strong>
            {cell.status === 'WORK' ? `trabalho, ${shiftLabel(cell)}` : statusLabel(cell.status)}
          </strong>
          {cell.label ? ` (${cell.label})` : ''}.
        </p>

        {!editable && (
          <p className="flex items-start gap-2 rounded-lg bg-blue-50 p-3 text-blue-900 dark:bg-blue-950/40 dark:text-blue-200">
            <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            {isPast
              ? 'Dias que já passaram não mudam aqui. Para corrigir batidas, use Registros de Ponto.'
              : 'Feriados, férias, abonos e atestados são controlados nas telas próprias.'}
          </p>
        )}

        {editable && (
          <>
            <div
              className="grid gap-2 sm:grid-cols-2"
              role="radiogroup"
              aria-label="O que deseja fazer?"
            >
              {cell.overrideId !== null ? (
                <Choice
                  active={action === 'UNDO'}
                  icon={Undo2}
                  title={cell.overrideReason === 'SWAP' ? 'Desfazer a troca' : 'Desfazer o ajuste'}
                  text="Volta ao que a escala previa."
                  onClick={() => setAction('UNDO')}
                />
              ) : (
                <>
                  <Choice
                    active={action === 'SWAP'}
                    icon={ArrowLeftRight}
                    title={isRest ? 'Trocar esta folga de dia' : 'Trocar com uma folga'}
                    text={
                      isRest
                        ? 'Trabalha hoje e folga em outro dia.'
                        : 'Folga hoje e trabalha numa folga.'
                    }
                    onClick={() => setAction('SWAP')}
                  />
                  {!isRest && (
                    <Choice
                      active={action === 'DAY_OFF'}
                      icon={CalendarOff}
                      title="Dar folga só neste dia"
                      text="O dia não conta como falta."
                      onClick={() => setAction('DAY_OFF')}
                    />
                  )}
                  <Choice
                    active={action === 'HOURS'}
                    icon={Clock}
                    title={isRest ? 'Trabalhar neste dia' : 'Mudar o horário deste dia'}
                    text="Só para esta data."
                    onClick={() => setAction('HOURS')}
                  />
                </>
              )}
            </div>

            {action === 'SWAP' && cell.overrideId === null && (
              <label className="block">
                <span className="mb-1 block font-semibold text-slate-700 dark:text-slate-200">
                  {isRest ? 'Qual dia vira a nova folga?' : 'Em qual folga a pessoa vai trabalhar?'}
                </span>
                {candidates.length === 0 ? (
                  <p className="text-xs text-slate-500">
                    Nenhum dia disponível nesta tela. Avance a semana e tente de novo.
                  </p>
                ) : (
                  <select
                    value={otherDate}
                    onChange={(event) => {
                      setOtherDate(event.target.value);
                      setProblems([]);
                      setConfirm(false);
                    }}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-600 dark:bg-slate-800"
                  >
                    <option value="">Escolha o dia…</option>
                    {candidates.map((day) => (
                      <option key={day.businessDate} value={day.businessDate}>
                        {describe(day)}
                        {day.status === 'WORK' ? ` (${shiftLabel(day)})` : ' (folga)'}
                      </option>
                    ))}
                  </select>
                )}
              </label>
            )}

            {action === 'HOURS' && (
              <div className="flex flex-wrap gap-3">
                {(
                  [
                    ['Entrada', start, setStart],
                    ['Saída', end, setEnd],
                    ['Almoço de', breakStart, setBreakStart],
                    ['até', breakEnd, setBreakEnd],
                  ] as const
                ).map(([label, value, setter]) => (
                  <label key={label} className="block">
                    <span className="mb-1 block text-xs text-slate-500">{label}</span>
                    <input
                      type="time"
                      value={value}
                      onChange={(event) => setter(event.target.value)}
                      className="w-[8rem] rounded-lg border border-slate-300 bg-white px-2 py-1.5 dark:border-slate-600 dark:bg-slate-800"
                    />
                  </label>
                ))}
              </div>
            )}

            <label className="block">
              <span className="mb-1 block font-semibold text-slate-700 dark:text-slate-200">
                Motivo
              </span>
              <input
                value={note}
                maxLength={240}
                onChange={(event) => setNote(event.target.value)}
                placeholder={
                  action === 'UNDO' ? 'Ex.: Combinado desfeito' : 'Ex.: Pedido do colaborador'
                }
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-600 dark:bg-slate-800"
              />
              {!noteValid && note.length > 0 && (
                <span className="text-xs text-red-600">Escreva pelo menos 3 letras.</span>
              )}
            </label>

            <IssueList title="Fora das regras de jornada" tone="error" items={problems} />
            {problems.length > 0 && (
              <label className="flex items-start gap-2 text-xs text-red-900 dark:text-red-200">
                <input
                  type="checkbox"
                  checked={confirm}
                  onChange={(e) => setConfirm(e.target.checked)}
                />
                Estou ciente e quero salvar mesmo assim.
              </label>
            )}
            {error && problems.length === 0 && (
              <p
                role="alert"
                className="rounded-lg bg-red-50 p-3 text-red-800 dark:bg-red-950/40 dark:text-red-200"
              >
                {error}
              </p>
            )}
          </>
        )}

        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 px-4 py-2 font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            {editable ? 'Cancelar' : 'Fechar'}
          </button>
          {editable && (
            <button
              type="button"
              disabled={!ready || run.isPending}
              onClick={() => {
                setError(null);
                run.mutate();
              }}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {run.isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              Confirmar
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}

function Choice({
  active,
  icon: Icon,
  title,
  text,
  onClick,
}: {
  active: boolean;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  text: string;
  onClick: () => void;
}): React.JSX.Element {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      className={`flex items-start gap-2 rounded-xl border p-3 text-left transition-colors hover:border-blue-400 ${active ? 'border-blue-500 ring-2 ring-blue-200 dark:ring-blue-900' : 'border-slate-200 dark:border-slate-700'}`}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
      <span>
        <strong className="block text-slate-900 dark:text-white">{title}</strong>
        <span className="text-xs text-slate-500 dark:text-slate-400">{text}</span>
      </span>
    </button>
  );
}
