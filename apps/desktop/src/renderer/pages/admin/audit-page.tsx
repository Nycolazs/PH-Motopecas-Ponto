import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  CheckCircle2,
  Clock,
  Code,
  Copy,
  Eye,
  Filter,
  Info,
  MessageSquareQuote,
  RefreshCw,
  ScrollText,
  User,
  UserCheck,
} from 'lucide-react';

import { useApiClient } from '../../auth/use-auth.js';
import type { AuditLogItem } from '../../api/contracts.js';
import { Modal } from '../../components/modal.js';
import { Pagination } from '../../components/pagination.js';
import { SelectInput } from '../../components/select-input.js';
import { StatusBadge } from '../../components/status-badge.js';
import { formatDateBR, formatDateTimeBR } from '../../lib/format.js';

export const ACTION_LABELS: Record<string, string> = {
  LOGIN_SUCCEEDED: 'Login efetuado com sucesso',
  LOGIN_FAILED: 'Tentativa de login inválida',
  LOGOUT: 'Logout realizado',
  REFRESH_REUSED: 'Tentativa de reuso de sessão',
  USER_CREATED: 'Colaborador cadastrado',
  USER_UPDATED: 'Colaborador atualizado',
  USER_ACTIVATED: 'Colaborador ativado',
  USER_DEACTIVATED: 'Colaborador desativado',
  USER_PASSWORD_RESET: 'Senha de colaborador redefinida',
  AVATAR_UPLOADED: 'Foto de perfil adicionada',
  AVATAR_REPLACED: 'Foto de perfil substituída',
  AVATAR_REMOVED: 'Foto de perfil removida',
  ADMIN_CREATED: 'Administrador cadastrado',
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
  TIME_PUNCH_DELETED: 'Ponto excluído administrativamente',
  ADJUSTMENT_REQUEST_CREATED: 'Solicitação de ajuste de ponto criada',
  ADJUSTMENT_REQUEST_APPROVED: 'Solicitação de ajuste de ponto aprovada',
  ADJUSTMENT_REQUEST_REJECTED: 'Solicitação de ajuste de ponto rejeitada',
  SETTING_UPDATED: 'Configuração do sistema atualizada',
  REPORT_EXPORTED: 'Relatório exportado',
  VACATION_CREATED: 'Férias cadastradas',
  VACATION_DELETED: 'Férias canceladas/excluídas',
};

const FIELD_LABELS: Record<string, string> = {
  employeeName: 'Colaborador',
  employeeLogin: 'Login do Colaborador',
  employeeId: 'Colaborador Afetado',
  userId: 'Usuário Afetado',
  actorId: 'ID do Autor',
  targetId: 'ID do Alvo',
  occurredAt: 'Data e Horário do Ponto',
  effectiveOccurredAt: 'Horário Efetivo',
  previousOccurredAt: 'Horário Anterior',
  correctedOccurredAt: 'Novo Horário Corrigido',
  requestedOccurredAt: 'Horário Solicitado',
  kind: 'Tipo da Batida',
  origin: 'Origem do Registro',
  reason: 'Motivo / Justificativa',
  note: 'Observação',
  reviewComment: 'Parecer do Administrador',
  comment: 'Comentário',
  sequence: 'Sequência',
  startDate: 'Data Inicial',
  endDate: 'Data Final',
  businessDate: 'Data de Referência',
  name: 'Nome',
  login: 'Login',
  role: 'Perfil de Acesso',
  isActive: 'Status da Conta',
  is_active: 'Status da Conta',
  adjustmentsCount: 'Qtd. de Correções',
  timePunchId: 'ID do Ponto',
  status: 'Status',
  key: 'Chave da Configuração',
  value: 'Valor Definido',
  reportType: 'Tipo de Relatório',
  period: 'Período',
  loginBucket: 'Identificador de Tentativa',
};

const REASON_TRANSLATIONS: Record<string, string> = {
  invalid_credentials: 'Credenciais inválidas (usuário ou senha incorretos)',
  inactive_user: 'Usuário desativado no sistema',
  user_deactivated: 'Usuário desativado no sistema',
  user_not_found: 'Usuário não encontrado',
  session_expired: 'Sessão expirada por tempo limite',
  session_revoked: 'Sessão revogada administrativamente',
  refresh_reuse: 'Tentativa suspeita de reuso de sessão revogada',
  identity_changed_during_login: 'Dados cadastrais alterados durante a autenticação',
  esquecimento: 'Esquecimento de registro pelo colaborador',
  ajuste_horario: 'Ajuste de horário incorreto',
  intervalo: 'Ajuste de intervalo / almoço',
  falha_sistema: 'Falha técnica ou indisponibilidade',
  atestado: 'Atestado médico ou declaração',
  servico_externo: 'Serviço externo / Trabalho em campo',
  mudanca_escala: 'Mudança de escala ou jornada',
  compensacao: 'Compensação de horas',
  LOGOUT: 'Encerramento de sessão voluntário (Logout)',
  EXPIRED: 'Sessão expirada',
  USER_DEACTIVATED: 'Conta de usuário desativada',
  REFRESH_REUSE: 'Reuso de sessão detectado',
};

function formatObservationOrReason(text: string): string {
  const trimmed = text.trim();
  const lower = trimmed.toLowerCase();
  return REASON_TRANSLATIONS[trimmed] ?? REASON_TRANSLATIONS[lower] ?? trimmed;
}

function toRecord(val: unknown): Record<string, unknown> | null {
  if (val && typeof val === 'object' && !Array.isArray(val)) {
    return val as Record<string, unknown>;
  }
  return null;
}

function isUuid(val: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);
}

function getAffectedUser(
  log: AuditLogItem,
  userMap: Map<string, { name: string; login: string; role: string }>,
): { name: string; login?: string; isActor: boolean } | null {
  const meta = toRecord(log.metadata);
  const after = toRecord(log.afterState);
  const before = toRecord(log.beforeState);

  // 1. Check direct employee/user ID in state/meta
  const employeeId =
    (after?.employeeId as string) ||
    (before?.employeeId as string) ||
    (meta?.employeeId as string) ||
    (log.targetType === 'USER' && log.targetId ? log.targetId : null);

  if (employeeId && userMap.has(employeeId)) {
    const u = userMap.get(employeeId)!;
    return { name: u.name, login: u.login, isActor: false };
  }

  // 2. Check direct name in state/meta
  const directName =
    (after?.employeeName as string) ||
    (meta?.employeeName as string) ||
    (before?.employeeName as string) ||
    (after?.name as string) ||
    (before?.name as string);

  const directLogin =
    (after?.employeeLogin as string) ||
    (meta?.employeeLogin as string) ||
    (before?.employeeLogin as string) ||
    (after?.login as string) ||
    (before?.login as string);

  if (directName && typeof directName === 'string' && !isUuid(directName)) {
    return { name: directName, login: directLogin, isActor: false };
  }

  // 3. If the actor themselves is an employee involved in the action
  if (
    log.actor &&
    (log.action.startsWith('LOGIN') ||
      log.action.startsWith('USER_') ||
      log.action === 'ADJUSTMENT_REQUEST_CREATED')
  ) {
    return { name: log.actor.name, login: log.actor.login, isActor: true };
  }

  return null;
}

function formatValue(
  key: string,
  value: unknown,
  userMap: Map<string, { name: string; login: string; role: string }>,
): string {
  if (value === null || value === undefined) return 'Não informado';
  if (typeof value === 'boolean') return value ? 'Ativo / Sim' : 'Inativo / Não';

  const str = String(value);

  // If this key is an ID and we have user info
  if (
    (key === 'employeeId' || key === 'userId' || key === 'targetId' || key === 'actorId') &&
    isUuid(str)
  ) {
    const u = userMap.get(str);
    if (u) {
      return `${u.name} (@${u.login})`;
    }
  }

  // Reasons & Observations
  if (key === 'reason' || key === 'note' || key === 'reviewComment' || key === 'comment') {
    return formatObservationOrReason(str);
  }

  // ISO Date Strings
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(str)) {
    return formatDateTimeBR(str);
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return formatDateBR(str);
  }

  // Domain enums
  if (str === 'CLOCK_IN') return 'Entrada (Início de Turno / Retorno de Almoço)';
  if (str === 'CLOCK_OUT') return 'Saída (Saída de Almoço / Fim de Turno)';
  if (str === 'ADMIN_INSERTION') return 'Inserção Manual por Administrador';
  if (str === 'EMPLOYEE') return 'Registro Original pelo Colaborador';
  if (str === 'ADMIN') return 'Administrador';
  if (str === 'PENDING') return 'Pendente de Análise';
  if (str === 'APPROVED') return 'Aprovado';
  if (str === 'REJECTED') return 'Rejeitado';

  return formatObservationOrReason(str);
}

function getEventNarrative(
  log: AuditLogItem,
  userMap: Map<string, { name: string; login: string; role: string }>,
): string {
  const actorName = log.actor ? `${log.actor.name} (@${log.actor.login})` : 'Sistema';
  const affected = getAffectedUser(log, userMap);
  const affectedStr = affected
    ? `${affected.name}${affected.login ? ` (@${affected.login})` : ''}`
    : null;
  const meta = toRecord(log.metadata);
  const after = toRecord(log.afterState);
  const before = toRecord(log.beforeState);

  switch (log.action) {
    case 'TIME_PUNCH_INSERTED': {
      const punchTime = after?.occurredAt ? formatDateTimeBR(after.occurredAt as string) : '';
      const kindStr = after?.kind === 'CLOCK_IN' ? 'Entrada' : 'Saída';
      return `O administrador ${actorName} realizou a inserção manual de um ponto de ${kindStr}${affectedStr ? ` para o colaborador ${affectedStr}` : ''}${punchTime ? ` no horário ${punchTime}` : ''}.`;
    }
    case 'TIME_PUNCH_CORRECTED': {
      const prevTime = before?.occurredAt ? formatDateTimeBR(before.occurredAt as string) : '';
      const nextTime = after?.occurredAt ? formatDateTimeBR(after.occurredAt as string) : '';
      return `O administrador ${actorName} corrigiu o horário do ponto${affectedStr ? ` do colaborador ${affectedStr}` : ''}${prevTime && nextTime ? ` de ${prevTime} para ${nextTime}` : ''}.`;
    }
    case 'TIME_PUNCH_DELETED': {
      const punchTime = before?.occurredAt ? formatDateTimeBR(before.occurredAt as string) : '';
      return `O administrador ${actorName} excluiu uma batida de ponto${affectedStr ? ` do colaborador ${affectedStr}` : ''}${punchTime ? ` registrada originalmente em ${punchTime}` : ''}.`;
    }
    case 'ADJUSTMENT_REQUEST_CREATED': {
      const reqTime = after?.requestedOccurredAt
        ? formatDateTimeBR(after.requestedOccurredAt as string)
        : '';
      return `O colaborador ${actorName} enviou uma solicitação de ajuste de ponto${reqTime ? ` para o horário ${reqTime}` : ''}.`;
    }
    case 'ADJUSTMENT_REQUEST_APPROVED':
      return `O administrador ${actorName} aprovou a solicitação de ajuste de ponto${affectedStr ? ` do colaborador ${affectedStr}` : ''}.`;
    case 'ADJUSTMENT_REQUEST_REJECTED':
      return `O administrador ${actorName} rejeitou a solicitação de ajuste de ponto${affectedStr ? ` do colaborador ${affectedStr}` : ''}.`;
    case 'USER_CREATED':
      return `Novo colaborador cadastrado no sistema: ${affected?.name || after?.name || 'Colaborador'}${affected?.login || after?.login ? ` (Login: @${affected?.login || after?.login})` : ''} por ${actorName}.`;
    case 'USER_UPDATED':
      return `Os dados cadastrais do colaborador ${affectedStr || 'usuário'} foram atualizados por ${actorName}.`;
    case 'USER_ACTIVATED':
      return `O colaborador ${affectedStr || 'usuário'} foi reativado no sistema por ${actorName}.`;
    case 'USER_DEACTIVATED':
      return `O colaborador ${affectedStr || 'usuário'} foi desativado no sistema por ${actorName}.`;
    case 'USER_PASSWORD_RESET':
      return `A senha de acesso do colaborador ${affectedStr || 'usuário'} foi redefinida por ${actorName}.`;
    case 'ADMIN_CREATED':
      return `Novo administrador cadastrado no sistema: ${after?.name || 'Administrador'} por ${actorName}.`;
    case 'ADMIN_UPDATED':
      return `Os dados do administrador ${after?.name || 'usuário'} foram atualizados por ${actorName}.`;
    case 'ADMIN_ACTIVATED':
      return `O administrador ${after?.name || 'usuário'} foi reativado por ${actorName}.`;
    case 'ADMIN_DEACTIVATED':
      return `O administrador ${after?.name || 'usuário'} foi desativado por ${actorName}.`;
    case 'ADMIN_PASSWORD_RESET':
      return `A senha do administrador foi redefinida com sucesso por ${actorName}.`;
    case 'VACATION_CREATED': {
      const start = after?.startDate ? formatDateBR(after.startDate as string) : '';
      const end = after?.endDate ? formatDateBR(after.endDate as string) : '';
      return `Férias cadastradas por ${actorName}${affectedStr ? ` para o colaborador ${affectedStr}` : ''}${start && end ? ` no período de ${start} a ${end}` : ''}.`;
    }
    case 'VACATION_DELETED':
      return `O registro de férias${affectedStr ? ` do colaborador ${affectedStr}` : ''} foi cancelado/excluído por ${actorName}.`;
    case 'SCHEDULE_CREATED':
      return `Uma nova versão da jornada de trabalho padrão da empresa foi cadastrada por ${actorName}.`;
    case 'CALENDAR_EXCEPTION_CREATED':
      return `Novo feriado ou horário especial registrado no calendário por ${actorName}.`;
    case 'CALENDAR_EXCEPTION_UPDATED':
      return `Exceção de calendário / feriado atualizado por ${actorName}.`;
    case 'CALENDAR_EXCEPTION_RETRACTED':
      return `Exceção de calendário cancelada por ${actorName}.`;
    case 'AVATAR_UPLOADED':
    case 'AVATAR_REPLACED':
      return `Foto de perfil atualizada com sucesso por ${actorName}.`;
    case 'AVATAR_REMOVED':
      return `Foto de perfil removida por ${actorName}.`;
    case 'LOGIN_SUCCEEDED':
      return `Autenticação realizada com sucesso pelo usuário ${actorName}.`;
    case 'LOGIN_FAILED': {
      const rawReason = (meta?.reason as string) || 'invalid_credentials';
      const reasonPt = formatObservationOrReason(rawReason);
      return `Tentativa de login sem sucesso${affectedStr ? ` para a conta de ${affectedStr}` : ''} — Motivo: ${reasonPt}.`;
    }
    case 'LOGOUT':
      return `Logout de sessão efetuado por ${actorName}.`;
    case 'REFRESH_REUSED':
      return `Tentativa suspeita de reutilização de token de atualização detectada e revogada para ${actorName}.`;
    case 'SETTING_UPDATED':
      return `Configuração global do sistema atualizada por ${actorName}.`;
    case 'REPORT_EXPORTED':
      return `Exportação de relatório ou folha de ponto executada por ${actorName}.`;
    default:
      return `Evento de auditoria registrado no sistema por ${actorName}.`;
  }
}

function getObservationText(log: AuditLogItem): string | null {
  const meta = toRecord(log.metadata);
  const after = toRecord(log.afterState);
  const before = toRecord(log.beforeState);

  const candidate =
    meta?.reason ||
    meta?.note ||
    meta?.reviewComment ||
    meta?.comment ||
    meta?.justificativa ||
    after?.reason ||
    after?.note ||
    after?.reviewComment ||
    after?.comment ||
    before?.reason ||
    before?.note;

  if (typeof candidate === 'string' && candidate.trim().length > 0) {
    return formatObservationOrReason(candidate);
  }

  return null;
}

export function AdminAuditPage(): React.JSX.Element {
  const api = useApiClient();
  const [page, setPage] = useState(1);
  const [actionFilter, setActionFilter] = useState('');
  const [detailItem, setDetailItem] = useState<AuditLogItem | null>(null);
  const [showTechnicalJson, setShowTechnicalJson] = useState(false);
  const [copiedJson, setCopiedJson] = useState(false);

  // Load all employees and admins to resolve names from IDs seamlessly
  const { data: employeesData } = useQuery({
    queryKey: ['admin-audit-employees-lookup'],
    queryFn: () => api.getEmployees({ limit: 100 }),
    staleTime: 60_000,
  });

  const { data: adminsData } = useQuery({
    queryKey: ['admin-audit-admins-lookup'],
    queryFn: () => api.getAdmins({ limit: 100 }),
    staleTime: 60_000,
  });

  const userMap = useMemo(() => {
    const map = new Map<string, { name: string; login: string; role: string }>();
    if (employeesData?.items) {
      for (const u of employeesData.items) {
        map.set(u.id, { name: u.name, login: u.login, role: u.role });
      }
    }
    if (adminsData?.items) {
      for (const u of adminsData.items) {
        map.set(u.id, { name: u.name, login: u.login, role: u.role });
      }
    }
    return map;
  }, [employeesData, adminsData]);

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['admin-audit-logs', page, actionFilter],
    queryFn: () =>
      api.getAuditLogs({
        page,
        limit: 15,
        ...(actionFilter ? { action: actionFilter } : {}),
      }),
  });

  const handleCopyJson = (item: AuditLogItem): void => {
    void navigator.clipboard.writeText(JSON.stringify(item, null, 2));
    setCopiedJson(true);
    setTimeout(() => setCopiedJson(false), 2000);
  };

  const observation = detailItem ? getObservationText(detailItem) : null;
  const narrative = detailItem ? getEventNarrative(detailItem, userMap) : '';
  const affectedUser = detailItem ? getAffectedUser(detailItem, userMap) : null;
  const beforeStateRecord = detailItem ? toRecord(detailItem.beforeState) : null;
  const afterStateRecord = detailItem ? toRecord(detailItem.afterState) : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center">
            <ScrollText className="w-5 h-5 mr-2.5 text-blue-600 dark:text-blue-400" /> Registro de
            Auditoria
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Trilha completa e imutável de todas as ações administrativas, alterações de pontos e
            eventos de segurança
          </p>
        </div>

        <button
          type="button"
          onClick={() => void refetch()}
          disabled={isFetching}
          className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 transition-all shadow-2xs self-start sm:self-auto cursor-pointer"
          title="Atualizar registros"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin text-blue-600' : ''}`} />
          <span>Atualizar</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <SelectInput
          label="Filtrar por Tipo de Ação"
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
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
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
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-3.5 px-4">Data e Hora</th>
                    <th className="py-3.5 px-4">Ação Auditada</th>
                    <th className="py-3.5 px-3">Resultado</th>
                    <th className="py-3.5 px-4">Autor da Ação</th>
                    <th className="py-3.5 px-4">Colaborador / Alvo</th>
                    <th className="py-3.5 px-4">Observação / Motivo</th>
                    <th className="py-3.5 px-4 text-right">Inspecionar</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-sans">
                  {data.items.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-500 text-sm">
                        Nenhum evento de auditoria encontrado para o filtro aplicado.
                      </td>
                    </tr>
                  )}
                  {data.items.map((log: AuditLogItem) => {
                    const rowObs = getObservationText(log);
                    const rowAffected = getAffectedUser(log, userMap);
                    return (
                      <tr
                        key={log.id}
                        className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors text-xs"
                      >
                        <td className="py-3.5 px-4 font-mono text-slate-600 dark:text-slate-400 whitespace-nowrap">
                          {formatDateTimeBR(log.createdAt)}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="font-semibold text-slate-900 dark:text-white block">
                            {ACTION_LABELS[log.action] ?? log.action}
                          </span>
                          <span className="text-[10px] font-mono text-slate-400">
                            {log.targetType}
                          </span>
                        </td>
                        <td className="py-3.5 px-3">
                          <StatusBadge status={log.outcome} />
                        </td>
                        <td className="py-3.5 px-4 text-slate-800 dark:text-slate-200">
                          {log.actor ? (
                            <div className="flex flex-col">
                              <span className="font-semibold">{log.actor.name}</span>
                              <span className="text-slate-400 font-mono text-[11px]">
                                @{log.actor.login}
                              </span>
                            </div>
                          ) : (
                            <span className="text-slate-400 italic">Sistema / Automático</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-slate-800 dark:text-slate-200">
                          {rowAffected ? (
                            <div className="flex flex-col">
                              <span className="font-semibold text-indigo-900 dark:text-indigo-300">
                                {rowAffected.name}
                              </span>
                              {rowAffected.login && (
                                <span className="text-slate-400 font-mono text-[11px]">
                                  @{rowAffected.login}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-400 font-mono text-[11px]">
                              {log.targetId ? `ID: ${log.targetId.slice(0, 8)}...` : '—'}
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 max-w-xs">
                          {rowObs ? (
                            <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 px-2.5 py-1 rounded-lg text-[11px] font-medium truncate">
                              <MessageSquareQuote className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                              <span className="truncate" title={rowObs}>
                                {rowObs}
                              </span>
                            </div>
                          ) : (
                            <span className="text-slate-400 italic text-[11px]">Sem observação</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => {
                              setDetailItem(log);
                              setShowTechnicalJson(false);
                            }}
                            title="Inspecionar detalhes completos do evento"
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 rounded-lg transition-colors border border-blue-200/60 dark:border-blue-900/60 cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Ver Detalhes</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
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

      {/* Rich Audit Detail Modal */}
      {detailItem && (
        <Modal
          isOpen={true}
          onClose={() => setDetailItem(null)}
          title="Detalhes do Evento de Auditoria"
          maxWidth="lg"
        >
          <div className="space-y-5 text-slate-800 dark:text-slate-200">
            {/* Header Hero Card */}
            <div className="bg-slate-50 dark:bg-slate-800/80 p-4 rounded-2xl border border-slate-200 dark:border-slate-700/80 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-700/60 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 rounded-xl">
                    <ScrollText className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      {ACTION_LABELS[detailItem.action] ?? detailItem.action}
                    </h3>
                    <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                      Código: {detailItem.action}
                    </span>
                  </div>
                </div>
                <StatusBadge status={detailItem.outcome} />
              </div>

              {/* Event Metadata Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-slate-400 shrink-0" />
                  <div>
                    <span className="text-slate-400 text-[11px] block">Data e Hora do Registro:</span>
                    <span className="font-semibold text-slate-900 dark:text-white font-mono">
                      {formatDateTimeBR(detailItem.createdAt)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-slate-400 shrink-0" />
                  <div>
                    <span className="text-slate-400 text-[11px] block">Autor da Ação:</span>
                    <span className="font-semibold text-slate-900 dark:text-white">
                      {detailItem.actor
                        ? `${detailItem.actor.name} (@${detailItem.actor.login})`
                        : 'Sistema'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Affected Employee Spotlight Card */}
            {affectedUser && (
              <div className="p-3.5 bg-indigo-50/80 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-900/50 rounded-2xl flex items-center justify-between text-xs">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 rounded-xl">
                    <UserCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-indigo-600 dark:text-indigo-400 text-[11px] font-semibold block">
                      Colaborador / Alvo Afetado:
                    </span>
                    <span className="font-bold text-slate-900 dark:text-white text-sm">
                      {affectedUser.name}
                    </span>
                    {affectedUser.login && (
                      <span className="text-slate-500 dark:text-slate-400 font-mono text-xs ml-1.5">
                        (@{affectedUser.login})
                      </span>
                    )}
                  </div>
                </div>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2.5 py-1 bg-white dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 rounded-lg border border-indigo-200 dark:border-indigo-800 shadow-2xs">
                  Colaborador
                </span>
              </div>
            )}

            {/* Narrative Explanation */}
            <div className="p-3.5 bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50 rounded-2xl flex items-start gap-3">
              <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
              <div className="text-xs leading-relaxed text-blue-900 dark:text-blue-200">
                <span className="font-bold block mb-0.5">O que aconteceu:</span>
                {narrative}
              </div>
            </div>

            {/* Prominent Observation / Justification Card */}
            {observation && (
              <div className="p-4 bg-amber-50/90 dark:bg-amber-950/40 border-2 border-amber-300 dark:border-amber-700/60 rounded-2xl space-y-1.5 shadow-2xs">
                <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 text-xs font-bold">
                  <MessageSquareQuote className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Motivo / Observação Registrada</span>
                </div>
                <div className="pl-4 text-sm font-medium text-slate-900 dark:text-amber-100 bg-white dark:bg-slate-900/60 p-3 rounded-xl border border-amber-200 dark:border-amber-800/40 leading-relaxed italic">
                  "{observation}"
                </div>
              </div>
            )}

            {/* Structured Parameters Breakdown */}
            {(beforeStateRecord || afterStateRecord) && (
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Parâmetros e Dados da Ação
                </h4>

                {/* If both before and after state exist -> Show Diff side-by-side */}
                {beforeStateRecord && afterStateRecord ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Before */}
                    <div className="p-3.5 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 rounded-xl space-y-2">
                      <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide block border-b border-slate-200 dark:border-slate-700 pb-1.5">
                        Estado Anterior
                      </span>
                      <div className="space-y-1.5 text-xs">
                        {Object.entries(beforeStateRecord).map(([k, v]) => (
                          <div
                            key={k}
                            className="flex justify-between gap-2 border-b border-slate-100 dark:border-slate-800/40 py-1 last:border-0"
                          >
                            <span className="text-slate-500 text-[11px]">{FIELD_LABELS[k] ?? k}:</span>
                            <span className="font-semibold text-slate-900 dark:text-white text-right">
                              {formatValue(k, v, userMap)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* After */}
                    <div className="p-3.5 bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40 rounded-xl space-y-2">
                      <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wide block border-b border-emerald-200 dark:border-emerald-800/40 pb-1.5">
                        Novo Estado (Atualizado)
                      </span>
                      <div className="space-y-1.5 text-xs">
                        {Object.entries(afterStateRecord).map(([k, v]) => (
                          <div
                            key={k}
                            className="flex justify-between gap-2 border-b border-emerald-100 dark:border-emerald-900/30 py-1 last:border-0"
                          >
                            <span className="text-slate-500 text-[11px]">{FIELD_LABELS[k] ?? k}:</span>
                            <span className="font-semibold text-emerald-950 dark:text-emerald-200 text-right">
                              {formatValue(k, v, userMap)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Single state (afterState or beforeState) */
                  <div className="p-3.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/80 rounded-xl">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-xs">
                      {Object.entries(afterStateRecord || beforeStateRecord || {}).map(([k, v]) => (
                        <div
                          key={k}
                          className="flex flex-col border-b border-slate-200/60 dark:border-slate-700/40 py-1.5 last:border-0"
                        >
                          <span className="text-slate-400 text-[11px]">{FIELD_LABELS[k] ?? k}:</span>
                          <span className="font-semibold text-slate-900 dark:text-white">
                            {formatValue(k, v, userMap)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Technical Context Footer */}
            <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setShowTechnicalJson(!showTechnicalJson)}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-blue-600 transition-colors cursor-pointer"
              >
                <Code className="w-3.5 h-3.5" />
                <span>{showTechnicalJson ? 'Ocultar JSON Técnico' : 'Ver Dados Técnicos (JSON)'}</span>
              </button>

              <div className="flex items-center gap-2">
                {showTechnicalJson && (
                  <button
                    type="button"
                    onClick={() => handleCopyJson(detailItem)}
                    className="inline-flex items-center gap-1 text-xs px-2.5 py-1 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
                  >
                    {copiedJson ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="text-emerald-600 font-semibold">Copiado!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copiar JSON</span>
                      </>
                    )}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setDetailItem(null)}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
                >
                  Fechar
                </button>
              </div>
            </div>

            {/* Collapsible Technical JSON Payload */}
            {showTechnicalJson && (
              <div className="space-y-2 pt-2 animate-in fade-in duration-200">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wide block">
                  Carga Útil Técnica Completa (Payload)
                </span>
                <pre className="p-3.5 bg-slate-900 text-slate-100 dark:bg-black/90 dark:text-emerald-400 rounded-xl overflow-x-auto text-[11px] font-mono leading-relaxed border border-slate-800 shadow-inner max-h-64">
                  {JSON.stringify(detailItem, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
