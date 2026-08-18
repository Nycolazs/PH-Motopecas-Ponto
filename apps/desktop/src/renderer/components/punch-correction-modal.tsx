import { useEffect, useState } from 'react';
import { useApiClient } from '../auth/use-auth.js';
import { formatDateTimeBR } from '../lib/format.js';
import { Modal } from './modal.js';

interface PunchCorrectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  punchId: string;
  employeeName: string;
  originalOccurredAt: string;
  currentSequence?: number;
  onSuccess: () => void;
}

export function PunchCorrectionModal({
  isOpen,
  onClose,
  punchId,
  employeeName,
  originalOccurredAt,
  currentSequence = 0,
  onSuccess,
}: PunchCorrectionModalProps): React.JSX.Element {
  const api = useApiClient();
  const [correctedDateTime, setCorrectedDateTime] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && originalOccurredAt) {
      const date = new Date(originalOccurredAt);
      // Format to YYYY-MM-DDTHH:mm in local time for datetime-local input
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      setCorrectedDateTime(`${year}-${month}-${day}T${hours}:${minutes}`);
      setReason('');
      setError(null);
    }
  }, [isOpen, originalOccurredAt]);

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (!reason.trim()) {
      setError('O motivo da correção é obrigatório.');
      return;
    }
    if (!correctedDateTime) {
      setError('Informe a nova data e horário corrigido.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const isoDate = new Date(correctedDateTime).toISOString();
      const idempotencyKey = crypto.randomUUID();

      await api.correctPunch(
        punchId,
        {
          correctedOccurredAt: isoDate,
          expectedCurrentOccurredAt: originalOccurredAt,
          expectedSequence: currentSequence,
          reason: reason.trim(),
        },
        idempotencyKey,
      );

      onSuccess();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao aplicar a correção do ponto.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const formattedOriginal = originalOccurredAt ? formatDateTimeBR(originalOccurredAt) : '';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Corrigir Horário de Ponto" maxWidth="md">
      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
        {error && (
          <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-lg text-rose-700 dark:text-rose-300 text-sm">
            {error}
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
            Colaborador
          </label>
          <div className="text-sm font-bold text-slate-900 dark:text-white">{employeeName}</div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
            Horário Original
          </label>
          <div className="text-sm font-mono bg-slate-100 dark:bg-slate-800 p-2.5 rounded-lg text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700">
            {formattedOriginal}
          </div>
        </div>

        <div>
          <label
            htmlFor="corrected-datetime"
            className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
          >
            Novo Horário Corrigido *
          </label>
          <input
            id="corrected-datetime"
            type="datetime-local"
            required
            value={correctedDateTime}
            onChange={(e) => setCorrectedDateTime(e.target.value)}
            className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label
            htmlFor="correction-reason"
            className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
          >
            Motivo da Correção *
          </label>
          <textarea
            id="correction-reason"
            required
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Ex.: Esqueceu de registrar saída para almoço às 12:00..."
            className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex justify-end space-x-3 pt-3 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            disabled={loading}
            onClick={onClose}
            className="secondary-button text-sm px-4 py-2"
          >
            Cancelar
          </button>
          <button type="submit" disabled={loading} className="primary-button text-sm px-5 py-2">
            {loading ? 'Salvando...' : 'Confirmar Correção'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
