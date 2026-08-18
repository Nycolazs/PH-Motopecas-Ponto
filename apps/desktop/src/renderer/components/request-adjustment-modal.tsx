import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, Clock } from 'lucide-react';

import { useAuth } from '../auth/use-auth.js';
import { formatDateBR, formatInstantTime } from '../lib/format.js';
import { Modal } from './modal.js';
import { useToast } from './toast-context.js';

interface RequestAdjustmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  punch: {
    id: string;
    originalOccurredAt: string;
    effectiveOccurredAt: string;
    kind: 'CLOCK_IN' | 'CLOCK_OUT';
  } | null;
  businessDate: string;
}

export function RequestAdjustmentModal({
  isOpen,
  onClose,
  punch,
  businessDate,
}: RequestAdjustmentModalProps): React.JSX.Element | null {
  const { api } = useAuth();
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  const [timeValue, setTimeValue] = useState('');
  const [reason, setReason] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Set initial time from punch when opening
  useEffect(() => {
    if (punch) {
      const initialTime = formatInstantTime(punch.effectiveOccurredAt);
      setTimeValue(initialTime);
      setReason('');
      setErrorMessage(null);
    }
  }, [punch]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!punch) return;
      if (!timeValue) {
        throw new Error('Informe o horário correto do ponto.');
      }
      if (!reason.trim()) {
        throw new Error('Informe a justificativa do ajuste.');
      }

      // Construct ISO timestamp with -03:00 timezone for Fortaleza
      const requestedOccurredAt = `${businessDate}T${timeValue}:00-03:00`;

      return api.createAdjustmentRequest({
        timePunchId: punch.id,
        requestedOccurredAt,
        reason: reason.trim(),
      });
    },
    onSuccess: () => {
      showToast(
        'success',
        'O administrador avaliará seu pedido de ajuste.',
        'Solicitação enviada!',
      );
      void queryClient.invalidateQueries({ queryKey: ['attendance'] });
      void queryClient.invalidateQueries({ queryKey: ['my-adjustment-requests'] });
      onClose();
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Não foi possível enviar a solicitação.';
      setErrorMessage(msg);
      showToast('error', msg, 'Erro ao solicitar ajuste');
    },
  });

  if (!punch) return null;

  const currentFormattedTime = formatInstantTime(punch.effectiveOccurredAt);
  const kindLabel = punch.kind === 'CLOCK_IN' ? 'Entrada' : 'Saída';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Solicitar Ajuste de Ponto">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setErrorMessage(null);
          mutation.mutate();
        }}
        className="space-y-4"
      >
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Caso tenha registrado o horário incorretamente, informe o horário real e a justificativa
          para avaliação da administração.
        </p>

        {errorMessage && (
          <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 rounded-lg flex items-start gap-2 text-sm text-rose-700 dark:text-rose-300">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700/60 text-sm">
          <div>
            <span className="text-slate-400 block text-xs">Data:</span>
            <span className="font-semibold text-slate-800 dark:text-slate-200">
              {formatDateBR(businessDate)}
            </span>
          </div>
          <div>
            <span className="text-slate-400 block text-xs">Tipo de Ponto:</span>
            <span className="font-semibold text-slate-800 dark:text-slate-200">
              {kindLabel} (Registrado: {currentFormattedTime})
            </span>
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Horário Correto Pretendido:
          </label>
          <div className="relative">
            <input
              type="time"
              required
              value={timeValue}
              onChange={(e) => setTimeValue(e.target.value)}
              className="w-full pl-10 pr-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 font-medium"
            />
            <Clock className="w-5 h-5 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Justificativa / Motivo do Ajuste:
          </label>
          <textarea
            required
            rows={3}
            maxLength={500}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Exemplo: Esqueci de bater na entrada após o almoço, comecei às 13:00."
            className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-sm"
          />
          <div className="flex justify-end text-xs text-slate-400 mt-1">
            {reason.length}/500 caracteres
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            disabled={mutation.isPending}
            className="px-4 py-2 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-sm font-medium transition"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={mutation.isPending}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-slate-950 rounded-lg text-sm font-bold shadow-sm transition disabled:opacity-50"
          >
            {mutation.isPending ? 'Enviando...' : 'Enviar Solicitação'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
