import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, Clock, RotateCw, XCircle } from 'lucide-react';

import type { AdjustmentRequest } from '../api/contracts.js';
import { useAuth } from '../auth/use-auth.js';
import { formatDateBR, formatInstantTime } from '../lib/format.js';
import { Modal } from './modal.js';

interface MyAdjustmentRequestsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function MyAdjustmentRequestsModal({
  isOpen,
  onClose,
}: MyAdjustmentRequestsModalProps): React.JSX.Element | null {
  const { api } = useAuth();

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['my-adjustment-requests'],
    queryFn: ({ signal }) => api.getMyAdjustmentRequests({ limit: 50 }, signal),
    enabled: isOpen,
    staleTime: 5_000,
    refetchInterval: isOpen ? 10_000 : false,
  });

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Minhas Solicitações de Ajuste">
      <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
        <div className="flex items-center justify-between gap-2 mb-2">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Histórico de pedidos de correção de ponto enviados para aprovação.
          </p>
          <button
            type="button"
            onClick={() => void refetch()}
            disabled={isFetching}
            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition shrink-0"
            title="Atualizar solicitações"
          >
            <RotateCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
            <span>Atualizar</span>
          </button>
        </div>

        {isLoading && (
          <div className="p-8 text-center text-slate-500">Carregando solicitações...</div>
        )}

        {isError && (
          <div className="p-4 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 rounded-lg text-sm">
            Não foi possível carregar as solicitações.
          </div>
        )}

        {data && data.items.length === 0 && (
          <div className="p-8 text-center bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 text-sm">
            Nenhuma solicitação de ajuste registrada.
          </div>
        )}

        {data &&
          data.items.map((req: AdjustmentRequest) => {
            const originalTime = formatInstantTime(req.currentOccurredAt);
            const requestedTime = formatInstantTime(req.requestedOccurredAt);
            const kindLabel = req.punchKind === 'CLOCK_IN' ? 'Entrada' : 'Saída';

            let statusBadge = (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                <Clock className="w-3.5 h-3.5" /> Pendente
              </span>
            );

            if (req.status === 'APPROVED') {
              statusBadge = (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Aprovado
                </span>
              );
            } else if (req.status === 'REJECTED') {
              statusBadge = (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300">
                  <XCircle className="w-3.5 h-3.5" /> Recusado
                </span>
              );
            }

            return (
              <div
                key={req.id}
                className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-2"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-slate-200">
                    <span>{kindLabel}</span>
                    <span className="text-slate-400 font-normal">
                      ({formatDateBR(req.currentOccurredAt)})
                    </span>
                  </div>
                  {statusBadge}
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800">
                  <div>
                    <span className="text-slate-400 block">Horário Anterior:</span>
                    <span className="font-semibold text-slate-700 dark:text-slate-300 line-through">
                      {originalTime}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Horário Solicitado:</span>
                    <span className="font-bold text-amber-600 dark:text-amber-400">
                      {requestedTime}
                    </span>
                  </div>
                </div>

                <div className="text-xs text-slate-600 dark:text-slate-400">
                  <span className="font-semibold text-slate-700 dark:text-slate-300">Motivo: </span>
                  {req.reason}
                </div>

                {req.reviewComment && (
                  <div className="p-2 bg-slate-100 dark:bg-slate-800/80 rounded border-l-2 border-slate-400 dark:border-slate-600 text-xs text-slate-700 dark:text-slate-300">
                    <span className="font-bold block text-[11px] text-slate-500 dark:text-slate-400">
                      Parecer do Administrador ({req.reviewedBy?.name ?? 'Admin'}):
                    </span>
                    {req.reviewComment}
                  </div>
                )}
              </div>
            );
          })}
      </div>

      <div className="flex justify-end pt-3 border-t border-slate-100 dark:border-slate-800 mt-4">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-sm font-medium transition"
        >
          Fechar
        </button>
      </div>
    </Modal>
  );
}
