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
import { formatDateBR, formatDateTimeBR, formatInstantTime } from '../lib/format.js';
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

function formatTransitionDisplay(fromIso: string, toIso: string): { from: string; to: string } {
  const fromDate = fromIso.slice(0, 10);
  const toDate = toIso.slice(0, 10);

  if (fromDate === toDate) {
    const fromTime = formatInstantTime(fromIso);
    const toTime = formatInstantTime(toIso);
    return { from: fromTime, to: toTime };
  }

  const fromFormatted = `${formatDateBR(fromDate).slice(0, 5)} ${formatInstantTime(fromIso)}`;
  const toFormatted = `${formatDateBR(toDate).slice(0, 5)} ${formatInstantTime(toIso)}`;
  return { from: fromFormatted, to: toFormatted };
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
  const { data: history } = useQuery({
    queryKey: ['punch-adjustments-history', punchId],
    queryFn: ({ signal }) => api.getPunchAdjustments(punchId, signal),
    enabled: isOpen && Boolean(punchId),
    staleTime: 0,
  });

  const hasAdjustments = Boolean(history && history.adjustments.length > 0);

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
      maxWidth={hasAdjustments ? '3xl' : 'lg'}
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
              className="secondary-button text-sm px-4 py-2 cursor-pointer"
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
        <div
          className={`grid gap-6 ${
            hasAdjustments ? 'grid-cols-1 md:grid-cols-12 items-start' : 'grid-cols-1'
          }`}
        >
          {/* Left Column: History & Origin (Shown on the left when adjustments exist) */}
          {hasAdjustments && history && (
            <div className="md:col-span-6 space-y-4 border-b md:border-b-0 md:border-r border-slate-200 dark:border-slate-800 pb-5 md:pb-0 md:pr-6">
              {/* Header Box: Current Punch info */}
              <div className="p-3.5 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700/80 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500 dark:text-slate-400 font-medium">
                    Colaborador:
                  </span>
                  <span className="font-bold text-slate-900 dark:text-white truncate max-w-[180px]">
                    {employeeName}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs border-t border-slate-200/60 dark:border-slate-700/50 pt-2">
                  <span className="text-slate-500 dark:text-slate-400 font-medium">
                    Horário Atual Efetivo:
                  </span>
                  <span className="font-mono font-bold text-blue-600 dark:text-blue-400">
                    {formattedOriginal}
                  </span>
                </div>
              </div>

              {/* Adjustments Timeline Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <History className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                  <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wide">
                    Histórico de Ajustes
                  </h3>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 rounded-md border border-amber-200 dark:border-amber-800/50">
                  {history.adjustments.length} ajuste(s)
                </span>
              </div>

              {/* Timeline Container */}
              <div className="space-y-3 max-h-[340px] overflow-y-auto pr-1">
                {/* Initial registration card */}
                <div className="p-3 bg-slate-50 dark:bg-slate-850 rounded-xl border border-slate-200 dark:border-slate-800 text-xs space-y-1.5 shadow-2xs">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-bold text-slate-500 uppercase tracking-wider text-[10px]">
                      Batida Original
                    </span>
                    <span className="text-slate-400 font-mono text-[11px]">
                      {formatDateTimeBR(history.createdAt)}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 pt-0.5">
                    <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">
                      Horário inicial: {formatDateTimeBR(history.originalOccurredAt)}
                    </span>
                  </div>

                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    {history.origin === 'ADMIN_INSERTION'
                      ? `Inserção manual por ${
                          history.createdByAdmin
                            ? `${history.createdByAdmin.name} (@${history.createdByAdmin.login})`
                            : 'Administrador'
                        }`
                      : 'Registro original pelo colaborador'}
                    {history.insertionReason && (
                      <span className="italic ml-1">
                        - Motivo: "{formatReason(history.insertionReason)}"
                      </span>
                    )}
                  </div>
                </div>

                {/* Adjustments */}
                {history.adjustments.map((adj) => {
                  const transition = formatTransitionDisplay(
                    adj.previousOccurredAt,
                    adj.correctedOccurredAt,
                  );
                  return (
                    <div
                      key={adj.id}
                      className="p-3 bg-white dark:bg-slate-900 rounded-xl border-l-4 border-l-amber-500 border border-slate-200 dark:border-slate-800 text-xs space-y-2 shadow-2xs"
                    >
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-bold text-amber-700 dark:text-amber-400">
                          Ajuste #{adj.sequence}
                        </span>
                        <span className="text-slate-400 font-mono text-[11px]">
                          {formatDateTimeBR(adj.createdAt)}
                        </span>
                      </div>

                      {/* Transition */}
                      <div className="flex items-center gap-2 p-2 bg-slate-50 dark:bg-slate-800/80 rounded-lg text-xs">
                        <span className="font-mono text-slate-400 line-through">
                          {transition.from}
                        </span>
                        <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                          {transition.to}
                        </span>
                      </div>

                      {/* Author */}
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-600 dark:text-slate-400">
                        <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>
                          Por <strong>{adj.admin.name}</strong> (@{adj.admin.login})
                        </span>
                      </div>

                      {/* Reason */}
                      <div className="p-2 bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-900/40 rounded-lg flex items-start gap-2 text-xs">
                        <MessageSquareQuote className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                        <span className="text-slate-800 dark:text-amber-200 italic leading-relaxed">
                          "{formatReason(adj.reason)}"
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Right Column: Correction Form */}
          <div className={hasAdjustments ? 'md:col-span-6 space-y-4' : 'col-span-1 space-y-4'}>
            <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
              {error && (
                <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-lg text-rose-700 dark:text-rose-300 text-sm">
                  {error}
                </div>
              )}

              {/* If no adjustments exist yet, show the top employee summary */}
              {!hasAdjustments && (
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
              )}

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
                  rows={4}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Ex.: Esqueceu de registrar saída para almoço às 12:00..."
                  className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500 transition-colors resize-none"
                />
              </div>

              {/* Actions Footer */}
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
                    className="secondary-button text-sm px-3.5 py-2 cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={loading || deleting}
                    className="primary-button text-sm px-4 py-2 whitespace-nowrap cursor-pointer"
                  >
                    {loading ? 'Salvando...' : 'Confirmar Correção'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </Modal>
  );
}
