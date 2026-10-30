import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BadgeCheck, CalendarCheck, Loader2, Plus, Stethoscope } from 'lucide-react';

import { ApiClientError } from '../api/client.js';
import type { AbsenceJustification } from '../api/contracts.js';
import { useApiClient } from '../auth/use-auth.js';
import { HelpHint } from '../help/help-hint.js';
import { formatDateBR, formatDisplayName, formatInstantDateTime } from '../lib/format.js';
import { Modal } from './modal.js';
import { useToast } from './toast-context.js';

function periodLabel(item: AbsenceJustification): string {
  return item.startDate === item.endDate
    ? formatDateBR(item.startDate)
    : `${formatDateBR(item.startDate)} a ${formatDateBR(item.endDate)} · ${item.daysCount} dias`;
}

/** Abonos e atestados of one employee, inside the "Ponto & Frequência" tab of the profile. */
export function AbsenceJustificationsCard({
  employee,
  onJustify,
}: {
  employee: { id: string; name: string };
  onJustify: () => void;
}): React.JSX.Element {
  const api = useApiClient();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [revoking, setRevoking] = useState<AbsenceJustification | null>(null);
  const [revokeReason, setRevokeReason] = useState('');
  const [revokeError, setRevokeError] = useState<string | null>(null);

  const list = useQuery({
    queryKey: ['absence-justifications', employee.id],
    queryFn: ({ signal }) => api.getAbsenceJustifications({ employeeId: employee.id }, signal),
  });

  const revoke = useMutation({
    mutationFn: () => api.revokeAbsenceJustification(revoking!.id, revokeReason.trim()),
    onSuccess: () => {
      toast.success('Justificativa cancelada. O dia volta a contar como falta.');
      setRevoking(null);
      void queryClient.invalidateQueries();
    },
    onError: (err) =>
      setRevokeError(err instanceof ApiClientError ? err.message : 'Não foi possível cancelar.'),
  });

  const items = list.data ?? [];

  return (
    <section
      aria-labelledby="justifications-title"
      className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900"
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <CalendarCheck className="h-4 w-4 text-blue-600" aria-hidden="true" />
          <h3
            id="justifications-title"
            className="text-sm font-bold text-slate-900 dark:text-white"
          >
            Abonos e atestados
          </h3>
          <HelpHint article="abonos-e-atestados" section="como-conta" title="O que muda no saldo?">
            Nos dias justificados, as horas que faltaram não são descontadas. Se o colaborador
            trabalhou parte do dia, essas horas continuam contando.
          </HelpHint>
        </div>
        <button
          type="button"
          onClick={onJustify}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 text-xs font-semibold text-white hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Justificar falta
        </button>
      </div>

      {list.isPending ? (
        <p className="py-4 text-center text-xs text-slate-500">Carregando...</p>
      ) : list.isError ? (
        <p role="alert" className="py-4 text-center text-xs text-rose-600">
          Não foi possível carregar os abonos e atestados.
        </p>
      ) : items.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-300 py-5 text-center text-xs text-slate-500 dark:border-slate-700">
          Nenhuma falta justificada. Clique em um dia do calendário ou em Justificar falta.
        </p>
      ) : (
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {items.map((item) => {
            const isAllowance = item.kind === 'ALLOWANCE';
            const Icon = isAllowance ? BadgeCheck : Stethoscope;
            const cancelled = item.revokedAt !== null;
            return (
              <li
                key={item.id}
                className={`flex flex-col gap-2 py-3 sm:flex-row sm:items-start sm:justify-between ${cancelled ? 'opacity-60' : ''}`}
              >
                <div className="flex min-w-0 gap-3">
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                      isAllowance
                        ? 'bg-cyan-50 text-cyan-700 dark:bg-cyan-950/50 dark:text-cyan-300'
                        : 'bg-sky-50 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300'
                    }`}
                  >
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">
                      {isAllowance ? 'Abono' : 'Atestado médico'} · {periodLabel(item)}
                      {cancelled && (
                        <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                          Cancelado
                        </span>
                      )}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-300">
                      {item.reason}
                    </p>
                    <p className="mt-0.5 text-[11px] text-slate-400">
                      Registrado por {formatDisplayName(item.createdBy.name)} em{' '}
                      {formatInstantDateTime(item.createdAt)}
                      {cancelled && item.revokedBy && (
                        <>
                          {' '}
                          · cancelado por {formatDisplayName(item.revokedBy.name)}:{' '}
                          {item.revokeReason}
                        </>
                      )}
                    </p>
                  </div>
                </div>
                {!cancelled && (
                  <button
                    type="button"
                    onClick={() => {
                      setRevoking(item);
                      setRevokeReason('');
                      setRevokeError(null);
                    }}
                    aria-label={`Cancelar ${isAllowance ? 'abono' : 'atestado'} de ${periodLabel(item)}`}
                    className="self-start rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:border-rose-300 hover:text-rose-600 dark:border-slate-700 dark:text-slate-300"
                  >
                    Cancelar
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <Modal
        isOpen={revoking !== null}
        onClose={() => setRevoking(null)}
        title="Cancelar justificativa"
      >
        {revoking && (
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (revokeReason.trim().length < 3) {
                setRevokeError('Descreva o motivo do cancelamento.');
                return;
              }
              revoke.mutate();
            }}
          >
            <p className="text-sm text-slate-600 dark:text-slate-300">
              {revoking.kind === 'ALLOWANCE' ? 'O abono' : 'O atestado'} de{' '}
              <strong>{periodLabel(revoking)}</strong> será cancelado e{' '}
              {revoking.daysCount === 1 ? 'o dia volta' : 'os dias voltam'} a contar como falta. O
              registro continua no histórico.
            </p>
            <div>
              <label
                htmlFor="revoke-reason"
                className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300"
              >
                Motivo do cancelamento <span className="text-rose-500">*</span>
              </label>
              <textarea
                id="revoke-reason"
                rows={2}
                maxLength={500}
                value={revokeReason}
                onChange={(event) => setRevokeReason(event.target.value)}
                placeholder="Ex.: Lançado no dia errado."
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
            {revokeError && (
              <p role="alert" className="text-sm font-semibold text-rose-600">
                {revokeError}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRevoking(null)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 dark:border-slate-700 dark:text-slate-300"
              >
                Voltar
              </button>
              <button
                type="submit"
                disabled={revoke.isPending}
                className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
              >
                {revoke.isPending && (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                )}
                Cancelar justificativa
              </button>
            </div>
          </form>
        )}
      </Modal>
    </section>
  );
}
