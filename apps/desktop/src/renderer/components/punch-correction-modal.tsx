import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowRight,
  Clock,
  History,
  MessageSquareQuote,
  Trash2,
  User,
} from 'lucide-react';
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

const REASON_TRANSLATIONS: Record<string, string> = {
  esquecimento: 'Esquecimento de registro pelo colaborador',
  ajuste_horario: 'Ajuste de horário incorreto',
  intervalo: 'Ajuste de intervalo / almoço',
  falha_sistema: 'Falha técnica ou indisponibilidade',
  atestado: 'Atestado médico ou declaração',
  servico_externo: 'Serviço externo / Trabalho em campo',
  mudanca_escala: 'Mudança de escala ou jornada',
  compensacao: 'Compensação de horas',
};

function formatReason(text: string): string {
  const trimmed = text.trim();
  const lower = trimmed.toLowerCase();
  return REASON_TRANSLATIONS[trimmed] ?? REASON_TRANSLATIONS[lower] ?? trimmed;
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
  const queryClient = useQueryClient();
  const [correctedDateTime, setCorrectedDateTime] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch full adjustment history for this punch
  const { data: history, isLoading: historyLoading } = useQuery({
    queryKey: ['punch-adjustments-history', punchId],
    queryFn: ({ signal }) => api.getPunchAdjustments(punchId, signal),
    enabled: isOpen && Boolean(punchId),
    staleTime: 0,
  });

  useEffect(() => {
    if (isOpen && originalOccurredAt) {
      const date = new Date(originalOccurredAt);
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

  const invalidateAllPunchData = async (): Promise<void> => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['punch-adjustments-history'] }),
      queryClient.invalidateQueries({ queryKey: ['admin-employee-monthly'] }),
      queryClient.invalidateQueries({ queryKey: ['admin-employee-day'] }),
      queryClient.invalidateQueries({ queryKey: ['admin-overview'] }),
      queryClient.invalidateQueries({ queryKey: ['admin-incomplete-attendance'] }),
      queryClient.invalidateQueries({ queryKey: ['admin-incomplete-count'] }),
      queryClient.invalidateQueries({ queryKey: ['admin-audit-logs'] }),
      queryClient.invalidateQueries({ queryKey: ['attendance'] }),
    ]);
  };

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
      await invalidateAllPunchData();
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
      await invalidateAllPunchData();
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

          {/* Current Punch Header Info */}
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
                Horário Atual do Ponto
              </span>
              <span className="text-sm font-mono font-bold text-blue-600 dark:text-blue-400 block truncate">
                {formattedOriginal}
              </span>
            </div>
          </div>

          {/* Previous Adjustments History Section */}
          {history && history.adjustments.length > 0 && (
            <div className="p-3.5 bg-slate-50/80 dark:bg-slate-850 border border-slate-200/80 dark:border-slate-700/70 rounded-2xl space-y-3">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700/60 pb-2">
                <div className="flex items-center gap-2">
                  <History className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    Histórico de Ajustes Anteriores
                  </span>
                </div>
                <span className="text-[11px] font-semibold px-2 py-0.5 bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 rounded-md border border-amber-200 dark:border-amber-800/40">
                  {history.adjustments.length} ajuste(s) registrado(s)
                </span>
              </div>

              <div className="space-y-2.5 max-h-52 overflow-y-auto pr-1">
                {/* Initial registration card */}
                <div className="p-2.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/60 dark:border-slate-800 text-xs space-y-1.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-bold text-slate-500 uppercase tracking-wide">
                      Registro Original
                    </span>
                    <span className="text-slate-400 font-mono">
                      {formatDateTimeBR(history.createdAt)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="font-mono font-medium text-slate-700 dark:text-slate-300">
                      Horário inicial: {formatDateTimeBR(history.originalOccurredAt)}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Origem:{' '}
                    {history.origin === 'ADMIN_INSERTION'
                      ? `Inserção manual por ${history.createdByAdmin ? `${history.createdByAdmin.name} (@${history.createdByAdmin.login})` : 'Administrador'}`
                      : 'Registro original pelo colaborador'}
                    {history.insertionReason && (
                      <span className="italic ml-1">
                        - Motivo: "{formatReason(history.insertionReason)}"
                      </span>
                    )}
                  </div>
                </div>

                {/* Adjustment steps */}
                {history.adjustments.map((adj) => (
                  <div
                    key={adj.id}
                    className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-amber-200/60 dark:border-amber-900/30 text-xs space-y-2 shadow-2xs"
                  >
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-bold text-amber-700 dark:text-amber-400">
                        Ajuste #{adj.sequence}
                      </span>
                      <span className="text-slate-400 font-mono">
                        {formatDateTimeBR(adj.createdAt)}
                      </span>
                    </div>

                    {/* Transition from previous to new time */}
                    <div className="flex items-center gap-2 p-2 bg-slate-50 dark:bg-slate-800/60 rounded-lg text-xs">
                      <span className="font-mono text-slate-500 line-through">
                        {formatDateTimeBR(adj.previousOccurredAt)}
                      </span>
                      <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        {formatDateTimeBR(adj.correctedOccurredAt)}
                      </span>
                    </div>

                    {/* Author and Reason */}
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-600 dark:text-slate-400">
                      <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>
                        Alterado por <strong>{adj.admin.name}</strong> (@{adj.admin.login})
                      </span>
                    </div>

                    <div className="p-2 bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-900/30 rounded-lg flex items-start gap-2 text-xs">
                      <MessageSquareQuote className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                      <span className="text-slate-800 dark:text-amber-200 italic leading-relaxed">
                        "{formatReason(adj.reason)}"
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {historyLoading && (
            <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl text-center text-xs text-slate-400">
              Carregando histórico de ajustes...
            </div>
          )}

          {/* New Target Correction Fields */}
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
              className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500 transition-colors font-mono"
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

          {/* Modal Action Buttons */}
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
