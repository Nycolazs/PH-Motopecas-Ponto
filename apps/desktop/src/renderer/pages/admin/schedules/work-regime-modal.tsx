import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';

import { ApiClientError } from '../../../api/client.js';
import type { WorkRegimeSettings } from '../../../api/schedule-contracts.js';
import { useApiClient } from '../../../auth/use-auth.js';
import { Modal } from '../../../components/modal.js';
import { useToast } from '../../../components/toast-context.js';

type AgreementAnswer = 'YES' | 'NO' | 'UNKNOWN';

function toAnswer(value: boolean | null): AgreementAnswer {
  if (value === true) return 'YES';
  if (value === false) return 'NO';
  return 'UNKNOWN';
}

/** Three questions that set the limits used by every check of the escalas. */
export function WorkRegimeModal({
  isOpen,
  onClose,
  settings,
}: {
  isOpen: boolean;
  onClose: () => void;
  settings: WorkRegimeSettings;
}): React.JSX.Element | null {
  const api = useApiClient();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [agreement, setAgreement] = useState<AgreementAnswer>('UNKNOWN');
  const [sunday, setSunday] = useState(3);
  const [minimumStaff, setMinimumStaff] = useState('1');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setAgreement(toAnswer(settings.hasCollectiveAgreement));
    setSunday(settings.sundayRestEveryWeeks);
    setMinimumStaff(String(settings.minimumStaff));
    setError(null);
  }, [isOpen, settings]);

  const save = useMutation({
    mutationFn: () =>
      api.updateWorkRegimeSettings({
        hasCollectiveAgreement: agreement === 'YES' ? true : agreement === 'NO' ? false : null,
        sundayRestEveryWeeks: sunday,
        minimumStaff: Number(minimumStaff),
      }),
    onSuccess: async () => {
      toast.success('Regras de jornada salvas.');
      await queryClient.invalidateQueries({ queryKey: ['team-schedule'] });
      await queryClient.invalidateQueries({ queryKey: ['schedule-preview'] });
      onClose();
    },
    onError: (err) =>
      setError(err instanceof ApiClientError ? err.message : 'Não foi possível salvar.'),
  });

  const staff = Number(minimumStaff);
  const staffValid = Number.isInteger(staff) && staff >= 0 && staff <= 50;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Regras de jornada da empresa" maxWidth="xl">
      <div className="space-y-5 text-sm">
        <fieldset>
          <legend className="mb-1 font-semibold text-slate-800 dark:text-slate-100">
            A empresa tem acordo ou convenção coletiva que permite trabalhar 8h24 por dia?
          </legend>
          <p className="mb-2 text-xs text-slate-500 dark:text-slate-400">
            Na transição da escala 5x2 (a partir de 15/12/2026) o limite é 42h por semana, mas sem
            acordo cada dia vai até 8h, então na prática são 40h. Em dezembro de 2027 o limite passa
            a ser 40h para todos.
          </p>
          <div className="flex flex-wrap gap-2">
            {(
              [
                ['YES', 'Sim, temos acordo'],
                ['NO', 'Não temos'],
                ['UNKNOWN', 'Não sei (usar 40h, mais seguro)'],
              ] as const
            ).map(([value, label]) => (
              <label
                key={value}
                className={`cursor-pointer rounded-lg border px-3 py-2 ${agreement === value ? 'border-blue-500 bg-blue-50 font-semibold text-blue-900 dark:bg-blue-950/40 dark:text-blue-100' : 'border-slate-300 dark:border-slate-600'}`}
              >
                <input
                  type="radio"
                  name="agreement"
                  value={value}
                  checked={agreement === value}
                  onChange={() => setAgreement(value)}
                  className="sr-only"
                />
                {label}
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="mb-1 font-semibold text-slate-800 dark:text-slate-100">
            Quem trabalha aos domingos deve folgar um domingo a cada:
          </legend>
          <div className="flex flex-wrap gap-2">
            {(
              [
                [3, '3 semanas (regra do comércio)'],
                [2, '2 semanas (mais conservador)'],
              ] as const
            ).map(([value, label]) => (
              <label
                key={value}
                className={`cursor-pointer rounded-lg border px-3 py-2 ${sunday === value ? 'border-blue-500 bg-blue-50 font-semibold text-blue-900 dark:bg-blue-950/40 dark:text-blue-100' : 'border-slate-300 dark:border-slate-600'}`}
              >
                <input
                  type="radio"
                  name="sunday"
                  checked={sunday === value}
                  onChange={() => setSunday(value)}
                  className="sr-only"
                />
                {label}
              </label>
            ))}
          </div>
        </fieldset>

        <label className="block">
          <span className="mb-1 block font-semibold text-slate-800 dark:text-slate-100">
            Quantas pessoas, no mínimo, precisam trabalhar em cada dia que a loja abre?
          </span>
          <input
            type="number"
            min={0}
            max={50}
            value={minimumStaff}
            onChange={(event) => setMinimumStaff(event.target.value)}
            className="w-28 rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-600 dark:bg-slate-800"
          />
          <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">
            Os dias com menos gente ficam em vermelho na grade da equipe.
          </span>
        </label>

        <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          Estas regras ajudam a montar a escala, mas não substituem a orientação do contador ou do
          sindicato.
        </p>

        {error && (
          <p role="alert" className="text-red-700 dark:text-red-300">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 px-4 py-2 font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={!staffValid || save.isPending}
            onClick={() => save.mutate()}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {save.isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            Salvar regras
          </button>
        </div>
      </div>
    </Modal>
  );
}
