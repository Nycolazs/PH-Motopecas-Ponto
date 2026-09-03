import { useEffect, useState } from 'react';
import { AlertTriangle, Trash2 } from 'lucide-react';
import { useApiClient } from '../auth/use-auth.js';
import { useToast } from './toast-context.js';
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
  const toast = useToast();
  const [correctedDateTime, setCorrectedDateTime] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
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
      setShowDeleteConfirm(false);
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

      toast.success('Horário de ponto corrigido com sucesso.');
      onSuccess();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao aplicar a correção do ponto.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (): Promise<void> => {
    try {
      setDeleting(true);
      setError(null);
      await api.deletePunch(punchId);
      toast.success('Batida de ponto excluída com sucesso.');
      onSuccess();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao excluir a batida de ponto.';
      setError(msg);
    } finally {
      setDeleting(false);
    }
  };

  const formattedOriginal = originalOccurredAt ? formatDateTimeBR(originalOccurredAt) : '';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={showDeleteConfirm ? 'Excluir Batida de Ponto' : 'Corrigir Horário de Ponto'}
      maxWidth="lg"
    >
      {showDeleteConfirm ? (
        <div className="space-y-4">
          <div className="p-4 bg-rose-50/80 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/80 rounded-xl flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
            <div className="space-y-1.5">
              <h4 className="text-sm font-bold text-rose-900 dark:text-rose-200">
                Excluir permanentemente este registro de ponto?
              </h4>
              <p className="text-xs text-rose-700 dark:text-rose-300 leading-relaxed">
                Esta ação removerá a batida de <strong>{formattedOriginal}</strong> do colaborador{' '}
                <strong>{employeeName}</strong>. As demais batidas do dia serão reorganizadas e o
                saldo de horas será recalculado automaticamente.
              </p>
            </div>
          </div>

          {error && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-lg text-rose-700 dark:text-rose-300 text-sm">
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-200/80 dark:border-slate-800">
            <button
              type="button"
              disabled={deleting}
              onClick={() => setShowDeleteConfirm(false)}
              className="secondary-button text-sm px-4 py-2"
            >
              Voltar
            </button>
            <button
              type="button"
              disabled={deleting}
              onClick={() => void handleDelete()}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition-colors cursor-pointer shadow-xs whitespace-nowrap"
            >
              <Trash2 className="w-4 h-4 shrink-0" />
              <span>{deleting ? 'Excluindo...' : 'Sim, Excluir Ponto'}</span>
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-lg text-rose-700 dark:text-rose-300 text-sm">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/80 dark:border-slate-700/60">
            <div className="min-w-0">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400 block mb-0.5">
                Colaborador
              </span>
              <span className="text-sm font-semibold text-slate-900 dark:text-white truncate block">
                {employeeName}
              </span>
            </div>
            <div className="min-w-0">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400 block mb-0.5">
                Horário Original
              </span>
              <span className="text-sm font-mono font-medium text-slate-800 dark:text-slate-200 block truncate">
                {formattedOriginal}
              </span>
            </div>
          </div>

          <div>
            <label
              htmlFor="corrected-datetime"
              className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
            >
              Novo Horário Corrigido *
            </label>
            <input
              id="corrected-datetime"
              type="datetime-local"
              required
              value={correctedDateTime}
              onChange={(e) => setCorrectedDateTime(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500 transition-colors"
            />
          </div>

          <div>
            <label
              htmlFor="correction-reason"
              className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
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
              className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500 transition-colors resize-none"
            />
          </div>

          <div className="flex items-center justify-between gap-3 pt-4 border-t border-slate-200/80 dark:border-slate-800">
            <button
              type="button"
              disabled={loading || deleting}
              onClick={() => setShowDeleteConfirm(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 border border-rose-200 dark:border-rose-900/50 rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <Trash2 className="w-4 h-4 shrink-0" />
              <span>Excluir Batida</span>
            </button>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                disabled={loading || deleting}
                onClick={onClose}
                className="secondary-button text-sm px-3.5 py-2"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading || deleting}
                className="primary-button text-sm px-4 py-2 whitespace-nowrap"
              >
                {loading ? 'Salvando...' : 'Confirmar Correção'}
              </button>
            </div>
          </div>
        </form>
      )}
    </Modal>
  );
}

