import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, Calendar, CheckCircle2, Clock, Filter, XCircle } from 'lucide-react';

import type { AdjustmentRequest, AdjustmentRequestStatus } from '../../api/contracts.js';
import { useApiClient } from '../../auth/use-auth.js';
import { Modal } from '../../components/modal.js';
import { Pagination } from '../../components/pagination.js';
import { useToast } from '../../components/toast-context.js';
import { formatDateBR, formatInstantDateTime, formatInstantTime } from '../../lib/format.js';

export function AdjustmentRequestsPage(): React.JSX.Element {
  const api = useApiClient();
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  const [statusFilter, setStatusFilter] = useState<AdjustmentRequestStatus | 'ALL'>('PENDING');
  const [page, setPage] = useState(1);
  const [selectedRequest, setSelectedRequest] = useState<AdjustmentRequest | null>(null);
  const [actionType, setActionType] = useState<'APPROVE' | 'REJECT' | null>(null);
  const [adminComment, setAdminComment] = useState('');

  const { data, isLoading, isError } = useQuery({
    queryKey: ['admin-adjustment-requests', statusFilter, page],
    queryFn: ({ signal }) =>
      api.getAdjustmentRequests(
        {
          ...(statusFilter !== 'ALL' ? { status: statusFilter } : {}),
          page,
          limit: 15,
        },
        signal,
      ),
    staleTime: 10_000,
  });

  const approveMutation = useMutation({
    mutationFn: async ({ id, comment }: { id: string; comment?: string | undefined }) => {
      return api.approveAdjustmentRequest(
        id,
        comment !== undefined ? { adminComment: comment } : undefined,
      );
    },
    onSuccess: () => {
      showToast('success', 'O ponto foi corrigido e a folha foi recalculada.', 'Ajuste Aprovado');
      closeActionModal();
      void queryClient.invalidateQueries({ queryKey: ['admin-adjustment-requests'] });
      void queryClient.invalidateQueries({ queryKey: ['pending-adjustments-count'] });
      void queryClient.invalidateQueries({ queryKey: ['attendance-overview'] });
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Falha ao efetivar a correção.';
      showToast('error', msg, 'Erro ao aprovar ajuste');
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ id, comment }: { id: string; comment?: string | undefined }) => {
      return api.rejectAdjustmentRequest(
        id,
        comment !== undefined ? { adminComment: comment } : undefined,
      );
    },
    onSuccess: () => {
      showToast('info', 'A solicitação foi rejeitada com sucesso.', 'Solicitação Recusada');
      closeActionModal();
      void queryClient.invalidateQueries({ queryKey: ['admin-adjustment-requests'] });
      void queryClient.invalidateQueries({ queryKey: ['pending-adjustments-count'] });
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Falha ao rejeitar o pedido.';
      showToast('error', msg, 'Erro ao recusar solicitação');
    },
  });

  const openActionModal = (request: AdjustmentRequest, type: 'APPROVE' | 'REJECT') => {
    setSelectedRequest(request);
    setActionType(type);
    setAdminComment('');
  };

  const closeActionModal = () => {
    setSelectedRequest(null);
    setActionType(null);
    setAdminComment('');
  };

  const handleActionSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRequest || !actionType) return;

    const trimmed = adminComment.trim();
    if (actionType === 'APPROVE') {
      approveMutation.mutate({
        id: selectedRequest.id,
        ...(trimmed ? { comment: trimmed } : {}),
      });
    } else {
      rejectMutation.mutate({
        id: selectedRequest.id,
        ...(trimmed ? { comment: trimmed } : {}),
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            Solicitações de Ajuste de Ponto
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Gerencie e avalie pedidos de correção de ponto enviados pelos funcionários.
          </p>
        </div>

        {/* Status Filters */}
        <div className="inline-flex rounded-xl bg-slate-100 dark:bg-slate-800/80 p-1 border border-slate-200 dark:border-slate-700/60 shadow-sm self-start">
          <button
            type="button"
            onClick={() => {
              setStatusFilter('PENDING');
              setPage(1);
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
              statusFilter === 'PENDING'
                ? 'bg-amber-500 text-slate-950 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            Pendentes
          </button>
          <button
            type="button"
            onClick={() => {
              setStatusFilter('APPROVED');
              setPage(1);
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
              statusFilter === 'APPROVED'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            Aprovadas
          </button>
          <button
            type="button"
            onClick={() => {
              setStatusFilter('REJECTED');
              setPage(1);
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
              statusFilter === 'REJECTED'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <XCircle className="w-3.5 h-3.5" />
            Recusadas
          </button>
          <button
            type="button"
            onClick={() => {
              setStatusFilter('ALL');
              setPage(1);
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
              statusFilter === 'ALL'
                ? 'bg-slate-900 dark:bg-slate-700 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Filter className="w-3.5 h-3.5" />
            Todas
          </button>
        </div>
      </div>

      {/* Content List */}
      {isLoading ? (
        <div className="p-12 text-center text-slate-500 font-medium">
          Carregando solicitações de ajuste...
        </div>
      ) : isError ? (
        <div className="p-6 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 rounded-xl border border-rose-200 dark:border-rose-800">
          Erro ao carregar solicitações. Tente atualizar a página.
        </div>
      ) : data && data.items.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <Clock className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
            Nenhuma solicitação encontrada
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
            {statusFilter === 'PENDING'
              ? 'Não há pedidos de ajuste de ponto aguardando avaliação no momento.'
              : 'Nenhum registro corresponde aos filtros selecionados.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {data?.items.map((request: AdjustmentRequest) => {
            const originalTime = formatInstantTime(request.currentOccurredAt);
            const requestedTime = formatInstantTime(request.requestedOccurredAt);
            const punchDate = request.currentOccurredAt.split('T')[0] ?? '';
            const kindLabel = request.punchKind === 'CLOCK_IN' ? 'Entrada' : 'Saída';

            return (
              <div
                key={request.id}
                className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm hover:border-slate-300 dark:hover:border-slate-700 transition"
              >
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                  {/* Left: Employee Info & Punch Context */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center font-black text-sm">
                        {request.employee.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                          <span>{request.employee.name}</span>
                          <span className="text-xs text-slate-400 font-normal">
                            (@{request.employee.login})
                          </span>
                        </div>
                        <div className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
                          <Calendar className="w-3.5 h-3.5" />
                          <span>Data do ponto: {formatDateBR(punchDate)}</span>
                          <span>•</span>
                          <span>Tipo: {kindLabel}</span>
                        </div>
                      </div>
                    </div>

                    {/* Time Transition */}
                    <div className="flex items-center gap-3 pl-12">
                      <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800/60 px-3 py-1.5 rounded-lg border border-slate-100 dark:border-slate-800 text-xs">
                        <span className="text-slate-400">Horário Atual:</span>
                        <span className="font-bold text-slate-700 dark:text-slate-300 line-through">
                          {originalTime}
                        </span>
                        <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                        <span className="text-slate-400">Solicitado:</span>
                        <span className="font-extrabold text-amber-600 dark:text-amber-400">
                          {requestedTime}
                        </span>
                      </div>
                    </div>

                    {/* Reason */}
                    <div className="pl-12 text-xs text-slate-600 dark:text-slate-400 max-w-2xl">
                      <span className="font-bold text-slate-700 dark:text-slate-300">
                        Justificativa:{' '}
                      </span>
                      {request.reason}
                    </div>

                    {/* Admin Feedback (if reviewed) */}
                    {request.reviewComment && (
                      <div className="pl-12">
                        <div className="p-2.5 bg-slate-50 dark:bg-slate-800/80 rounded-lg border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300 max-w-2xl">
                          <span className="font-bold block text-[11px] text-slate-500 dark:text-slate-400">
                            Parecer Administrativo ({request.reviewedBy?.name ?? 'Admin'} em{' '}
                            {request.reviewedAt ? formatInstantDateTime(request.reviewedAt) : ''}):
                          </span>
                          {request.reviewComment}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Right: Actions / Status */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 lg:self-center pl-12 lg:pl-0">
                    {request.status === 'PENDING' ? (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => openActionModal(request, 'REJECT')}
                          className="px-3.5 py-2 border border-rose-200 dark:border-rose-900/60 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl text-xs font-bold transition flex items-center gap-1.5"
                        >
                          <XCircle className="w-4 h-4" />
                          Recusar
                        </button>
                        <button
                          type="button"
                          onClick={() => openActionModal(request, 'APPROVE')}
                          className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl text-xs font-bold shadow-sm transition flex items-center gap-1.5"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          Aprovar Ajuste
                        </button>
                      </div>
                    ) : request.status === 'APPROVED' ? (
                      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Aprovado</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60">
                        <XCircle className="w-4 h-4" />
                        <span>Recusado</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {data && data.pagination.totalPages > 1 && (
            <div className="pt-4">
              <Pagination
                page={data.pagination.page}
                totalPages={data.pagination.totalPages}
                total={data.pagination.total}
                limit={data.pagination.limit}
                onPageChange={setPage}
              />
            </div>
          )}
        </div>
      )}

      {/* Action Modal (Approve / Reject) */}
      {selectedRequest && actionType && (
        <Modal
          isOpen={true}
          onClose={closeActionModal}
          title={
            actionType === 'APPROVE' ? 'Aprovar Ajuste de Ponto' : 'Recusar Solicitação de Ajuste'
          }
        >
          <form onSubmit={handleActionSubmit} className="space-y-4">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {actionType === 'APPROVE'
                ? `Confirme a aprovação para alterar o ponto de ${selectedRequest.employee.name} de ${formatInstantTime(selectedRequest.currentOccurredAt)} para ${formatInstantTime(selectedRequest.requestedOccurredAt)}.`
                : `Você está recusando o pedido de ajuste de ${selectedRequest.employee.name}. O ponto original não será alterado.`}
            </p>

            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {actionType === 'APPROVE'
                  ? 'Parecer / Observação do Administrador (Opcional):'
                  : 'Motivo da Recusa / Parecer (Opcional):'}
              </label>
              <textarea
                rows={3}
                maxLength={500}
                value={adminComment}
                onChange={(e) => setAdminComment(e.target.value)}
                placeholder={
                  actionType === 'APPROVE'
                    ? 'Exemplo: Aprovado conforme registro de câmeras.'
                    : 'Exemplo: Horário divergente da folha de atividades.'
                }
                className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 text-sm focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={closeActionModal}
                disabled={approveMutation.isPending || rejectMutation.isPending}
                className="px-4 py-2 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-sm font-medium transition"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={approveMutation.isPending || rejectMutation.isPending}
                className={`px-4 py-2 rounded-lg text-sm font-bold text-white shadow-sm transition disabled:opacity-50 ${
                  actionType === 'APPROVE'
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : 'bg-rose-600 hover:bg-rose-700'
                }`}
              >
                {approveMutation.isPending || rejectMutation.isPending
                  ? 'Processando...'
                  : actionType === 'APPROVE'
                    ? 'Confirmar e Aprovar'
                    : 'Confirmar Recusa'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
