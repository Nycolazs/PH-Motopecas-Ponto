import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Eye, Filter, RefreshCw, ScrollText } from 'lucide-react';

import { useApiClient } from '../../auth/use-auth.js';
import type { AuditLogItem } from '../../api/contracts.js';
import { Modal } from '../../components/modal.js';
import { Pagination } from '../../components/pagination.js';
import { SelectInput } from '../../components/select-input.js';
import { StatusBadge } from '../../components/status-badge.js';
import { formatDateTimeBR } from '../../lib/format.js';

const ACTION_LABELS: Record<string, string> = {
  LOGIN_SUCCEEDED: 'Login efetuado com sucesso',
  LOGIN_FAILED: 'Tentativa de login inválida',
  LOGOUT: 'Logout realizado',
  REFRESH_REUSED: 'Tentativa de reuso de sessão',
  USER_CREATED: 'Colaborador criado',
  USER_UPDATED: 'Colaborador atualizado',
  USER_ACTIVATED: 'Colaborador ativado',
  USER_DEACTIVATED: 'Colaborador desativado',
  USER_PASSWORD_RESET: 'Senha de colaborador redefinida',
  AVATAR_UPLOADED: 'Foto de perfil adicionada',
  AVATAR_REPLACED: 'Foto de perfil substituída',
  AVATAR_REMOVED: 'Foto de perfil removida',
  ADMIN_CREATED: 'Administrador criado',
  ADMIN_UPDATED: 'Administrador atualizado',
  ADMIN_ACTIVATED: 'Administrador ativado',
  ADMIN_DEACTIVATED: 'Administrador desativado',
  ADMIN_PASSWORD_RESET: 'Senha de administrador redefinida',
  SCHEDULE_CREATED: 'Nova jornada de trabalho cadastrada',
  CALENDAR_EXCEPTION_CREATED: 'Feriado / Exceção criada',
  CALENDAR_EXCEPTION_UPDATED: 'Exceção de calendário atualizada',
  CALENDAR_EXCEPTION_RETRACTED: 'Exceção de calendário cancelada',
  TIME_PUNCH_CORRECTED: 'Ponto corrigido administrativamente',
  TIME_PUNCH_INSERTED: 'Ponto inserido manualmente',
  SETTING_UPDATED: 'Configuração atualizada',
  REPORT_EXPORTED: 'Relatório exportado',
};

export function AdminAuditPage(): React.JSX.Element {
  const api = useApiClient();
  const [page, setPage] = useState(1);
  const [actionFilter, setActionFilter] = useState('');
  const [detailItem, setDetailItem] = useState<AuditLogItem | null>(null);

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['admin-audit-logs', page, actionFilter],
    queryFn: () =>
      api.getAuditLogs({
        page,
        limit: 15,
        ...(actionFilter ? { action: actionFilter } : {}),
      }),
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center">
            <ScrollText className="w-5 h-5 mr-2 text-blue-600" /> Registro de Auditoria
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Trilha imutável de todas as ações administrativas e eventos de autenticação
          </p>
        </div>

        <button
          type="button"
          onClick={() => void refetch()}
          disabled={isFetching}
          className="p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 transition-colors self-start sm:self-auto"
          title="Atualizar registros"
        >
          <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <SelectInput
          label="Filtrar por Ação Auditada"
          placeholder="Todas as ações auditadas"
          value={actionFilter}
          onChange={(newVal) => {
            setActionFilter(newVal);
            setPage(1);
          }}
          options={[
            { value: '', label: 'Todas as ações auditadas' },
            ...Object.entries(ACTION_LABELS).map(([actionKey, actionLabel]) => ({
              value: actionKey,
              label: actionLabel,
              sublabel: actionKey,
            })),
          ]}
          icon={<Filter className="w-4 h-4" />}
          searchable
          clearable
          className="w-full"
        />
      </div>

      {/* Audit Table */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
        {isLoading && (
          <div className="p-12 flex flex-col items-center justify-center space-y-3 text-slate-500">
            <RefreshCw className="w-6 h-6 animate-spin text-blue-600" />
            <p className="text-sm font-medium">Carregando eventos de auditoria...</p>
          </div>
        )}

        {error && (
          <div className="p-6 text-center text-rose-600 text-sm">
            Falha ao carregar registros de auditoria. Tente novamente.
          </div>
        )}

        {data && (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-3.5 px-4">Data e Hora</th>
                    <th className="py-3.5 px-4">Ação</th>
                    <th className="py-3.5 px-3">Resultado</th>
                    <th className="py-3.5 px-4">Autor</th>
                    <th className="py-3.5 px-4">Alvo</th>
                    <th className="py-3.5 px-4 text-right">Detalhes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-sans">
                  {data.items.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-10 text-center text-slate-500 text-sm">
                        Nenhum evento de auditoria encontrado.
                      </td>
                    </tr>
                  )}
                  {data.items.map((log: AuditLogItem) => (
                    <tr
                      key={log.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors text-xs"
                    >
                      <td className="py-3 px-4 font-mono text-slate-600 dark:text-slate-400">
                        {formatDateTimeBR(log.createdAt)}
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white">
                        {ACTION_LABELS[log.action] ?? log.action}
                      </td>
                      <td className="py-3 px-3">
                        <StatusBadge status={log.outcome} />
                      </td>
                      <td className="py-3 px-4 text-slate-800 dark:text-slate-200">
                        {log.actor ? (
                          <span>
                            {log.actor.name}{' '}
                            <span className="text-slate-400 font-mono text-[11px]">
                              ({log.actor.login})
                            </span>
                          </span>
                        ) : (
                          <span className="text-slate-400 italic">Sistema / Anônimo</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-500 font-mono text-[11px]">
                        {log.targetType} {log.targetId ? `(${log.targetId.substring(0, 8)})` : ''}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => setDetailItem(log)}
                          title="Inspecionar evento"
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-md transition-colors"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Pagination
              page={data.pagination.page}
              totalPages={data.pagination.totalPages}
              total={data.pagination.total}
              limit={data.pagination.limit}
              onPageChange={setPage}
            />
          </>
        )}
      </div>

      {/* Audit Detail Modal */}
      {detailItem && (
        <Modal
          isOpen={true}
          onClose={() => setDetailItem(null)}
          title="Detalhes do Evento de Auditoria"
          maxWidth="lg"
        >
          <div className="space-y-4 text-xs font-mono">
            <div className="grid grid-cols-2 gap-3 bg-slate-50 dark:bg-slate-800/60 p-3 rounded-lg border">
              <div>
                <span className="text-slate-400 block">ID do Evento:</span>
                <span className="text-slate-900 dark:text-white font-bold">{detailItem.id}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Data e Hora:</span>
                <span className="text-slate-900 dark:text-white">
                  {new Date(detailItem.createdAt).toLocaleString('pt-BR')}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block">Ação:</span>
                <span className="text-slate-900 dark:text-white font-bold">
                  {detailItem.action}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block">Resultado:</span>
                <StatusBadge status={detailItem.outcome} />
              </div>
            </div>

            {detailItem.beforeState ? (
              <div>
                <span className="text-slate-500 font-bold block mb-1">Estado Anterior:</span>
                <pre className="p-3 bg-slate-900 text-slate-100 rounded-lg overflow-x-auto text-[11px]">
                  {JSON.stringify(detailItem.beforeState, null, 2)}
                </pre>
              </div>
            ) : null}

            {detailItem.afterState ? (
              <div>
                <span className="text-slate-500 font-bold block mb-1">Estado Posterior:</span>
                <pre className="p-3 bg-slate-900 text-slate-100 rounded-lg overflow-x-auto text-[11px]">
                  {JSON.stringify(detailItem.afterState, null, 2)}
                </pre>
              </div>
            ) : null}

            {detailItem.metadata ? (
              <div>
                <span className="text-slate-500 font-bold block mb-1">Metadados:</span>
                <pre className="p-3 bg-slate-900 text-slate-100 rounded-lg overflow-x-auto text-[11px]">
                  {JSON.stringify(detailItem.metadata, null, 2)}
                </pre>
              </div>
            ) : null}

            <div className="flex justify-end pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setDetailItem(null)}
                className="secondary-button text-xs px-4 py-2"
              >
                Fechar
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
