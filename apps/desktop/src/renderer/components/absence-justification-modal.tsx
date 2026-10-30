import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { BadgeCheck, Info, Loader2, Stethoscope } from 'lucide-react';

import { ApiClientError } from '../api/client.js';
import type { AbsenceJustificationKind } from '../api/contracts.js';
import { useApiClient } from '../auth/use-auth.js';
import { formatDateBR, formatDisplayName } from '../lib/format.js';
import { DateInput } from './date-input.js';
import { Modal } from './modal.js';
import { useToast } from './toast-context.js';

/** Same limit as the API: longer leaves go through the INSS. */
export const MAX_MEDICAL_LEAVE_DAYS = 31;

export function addDaysToBusinessDate(date: string, days: number): string {
  const instant = new Date(`${date}T12:00:00Z`);
  instant.setUTCDate(instant.getUTCDate() + days);
  return instant.toISOString().slice(0, 10);
}

const OPTIONS: ReadonlyArray<{
  kind: AbsenceJustificationKind;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  {
    kind: 'ALLOWANCE',
    title: 'Abono',
    description: 'A empresa perdoa a falta de um dia.',
    icon: BadgeCheck,
  },
  {
    kind: 'MEDICAL_CERTIFICATE',
    title: 'Atestado médico',
    description: 'Afastamento com atestado, por um ou mais dias.',
    icon: Stethoscope,
  },
];

interface AbsenceJustificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  employee: { id: string; name: string };
  /** Day the administrator clicked; defaults to today. */
  initialDate?: string | undefined;
}

/**
 * Excuses an employee's absence. The missing hours stop counting against the balance;
 * hours actually worked on those days still count.
 */
export function AbsenceJustificationModal({
  isOpen,
  onClose,
  employee,
  initialDate,
}: AbsenceJustificationModalProps): React.JSX.Element | null {
  const api = useApiClient();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [kind, setKind] = useState<AbsenceJustificationKind>('ALLOWANCE');
  const [startDate, setStartDate] = useState(initialDate ?? '');
  const [days, setDays] = useState('1');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setKind('ALLOWANCE');
    setStartDate(
      initialDate ?? new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }),
    );
    setDays('1');
    setReason('');
    setError(null);
  }, [isOpen, initialDate]);

  const dayCount = kind === 'ALLOWANCE' ? 1 : Number(days);
  const daysValid =
    Number.isInteger(dayCount) && dayCount >= 1 && dayCount <= MAX_MEDICAL_LEAVE_DAYS;
  const endDate = startDate && daysValid ? addDaysToBusinessDate(startDate, dayCount - 1) : '';
  const name = formatDisplayName(employee.name);

  const save = useMutation({
    mutationFn: () =>
      api.createAbsenceJustification({
        employeeId: employee.id,
        kind,
        startDate,
        endDate,
        reason: reason.trim(),
      }),
    onSuccess: () => {
      toast.success(
        kind === 'ALLOWANCE'
          ? `Dia ${formatDateBR(startDate)} abonado para ${name}.`
          : `Atestado de ${name} registrado.`,
      );
      // Days, months, reports and dashboards all change.
      void queryClient.invalidateQueries();
      onClose();
    },
    onError: (err) =>
      setError(err instanceof ApiClientError ? err.message : 'Não foi possível salvar.'),
  });

  const submit = (): void => {
    if (!startDate) return setError('Escolha o dia.');
    if (!daysValid) {
      return setError(`Informe de 1 a ${MAX_MEDICAL_LEAVE_DAYS} dias de afastamento.`);
    }
    if (reason.trim().length < 3) return setError('Descreva o motivo.');
    setError(null);
    save.mutate();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Justificar falta — ${name}`} maxWidth="lg">
      <form
        className="space-y-5"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <fieldset>
          <legend className="mb-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
            Tipo de justificativa
          </legend>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {OPTIONS.map((option) => {
              const Icon = option.icon;
              const selected = kind === option.kind;
              return (
                <label
                  key={option.kind}
                  className={`flex cursor-pointer gap-3 rounded-xl border p-3 transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-blue-500 ${
                    selected
                      ? 'border-blue-500 bg-blue-50/60 dark:border-blue-500 dark:bg-blue-950/30'
                      : 'border-slate-200 hover:border-slate-300 dark:border-slate-700'
                  }`}
                >
                  <input
                    type="radio"
                    name="justification-kind"
                    value={option.kind}
                    checked={selected}
                    onChange={() => setKind(option.kind)}
                    className="sr-only"
                  />
                  <Icon
                    className={`mt-0.5 h-5 w-5 shrink-0 ${selected ? 'text-blue-600' : 'text-slate-400'}`}
                    aria-hidden="true"
                  />
                  <span>
                    <span className="block text-sm font-semibold text-slate-900 dark:text-white">
                      {option.title}
                    </span>
                    <span className="block text-xs text-slate-500 dark:text-slate-400">
                      {option.description}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>

        <div
          className={`grid gap-4 ${kind === 'ALLOWANCE' ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2'}`}
        >
          <DateInput
            label={kind === 'ALLOWANCE' ? 'Dia abonado' : 'Primeiro dia de afastamento'}
            labelPosition="top"
            required
            value={startDate}
            onChange={setStartDate}
            className="w-full"
          />
          {kind === 'MEDICAL_CERTIFICATE' && (
            <div>
              <label
                htmlFor="justification-days"
                className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300"
              >
                Dias de afastamento <span className="text-rose-500">*</span>
              </label>
              <input
                id="justification-days"
                type="number"
                inputMode="numeric"
                min={1}
                max={MAX_MEDICAL_LEAVE_DAYS}
                value={days}
                onChange={(event) => setDays(event.target.value)}
                className="h-[42px] w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
          )}
        </div>
        {kind === 'MEDICAL_CERTIFICATE' && startDate && daysValid && (
          <p className="-mt-2 text-xs text-slate-600 dark:text-slate-300">
            {dayCount === 1
              ? `Cobre o dia ${formatDateBR(startDate)}.`
              : `Cobre de ${formatDateBR(startDate)} a ${formatDateBR(endDate)} (${dayCount} dias).`}
          </p>
        )}

        <div>
          <label
            htmlFor="justification-reason"
            className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300"
          >
            {kind === 'ALLOWANCE' ? 'Motivo do abono' : 'Detalhes do atestado'}{' '}
            <span className="text-rose-500">*</span>
          </label>
          <textarea
            id="justification-reason"
            rows={3}
            maxLength={500}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder={
              kind === 'ALLOWANCE'
                ? 'Ex.: Liberado pela gerência para resolver assunto pessoal.'
                : 'Ex.: Atestado da Dra. Ana Souza, CRM 12345, consulta e repouso.'
            }
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          />
        </div>

        <p className="flex gap-2 rounded-lg bg-slate-50 p-3 text-xs leading-relaxed text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" aria-hidden="true" />
          As horas que faltaram {kind === 'ALLOWANCE' ? 'neste dia' : 'nesses dias'} não serão
          descontadas do saldo. Se o colaborador trabalhou parte do dia, essas horas continuam
          contando normalmente.
        </p>

        {error && (
          <p role="alert" className="text-sm font-semibold text-rose-600 dark:text-rose-400">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={save.isPending}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {save.isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            {kind === 'ALLOWANCE' ? 'Abonar dia' : 'Registrar atestado'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
