import { apiProblemSchema, type ApiProblem } from '@ph-ponto/shared';
import { z, type ZodType } from 'zod';

import {
  adjustmentRequestListSchema,
  adjustmentRequestSchema,
  adminTimePunchMutationSchema,
  attendanceOverviewSchema,
  attendancePeriodSchema,
  auditLogListSchema,
  calendarExceptionListSchema,
  calendarExceptionSchema,
  dailyAttendanceSchema,
  managedUserSchema,
  monthlyAttendanceSchema,
  pendingCountSchema,
  reviewAdjustmentResponseSchema,
  scheduleListSchema,
  scheduleVersionSchema,
  timePunchMutationSchema,
  userListSchema,
  vacationListSchema,
  vacationSchema,
  type AdjustmentRequest,
  type AdjustmentRequestList,
  type AdjustmentRequestStatus,
  type AttendanceOverview,
  type AttendancePeriod,
  type AuditLogList,
  type CalendarException,
  type CalendarExceptionList,
  type CreateVacationInput,
  type DailyAttendance,
  type ManagedUser,
  type MonthlyAttendance,
  type ReviewAdjustmentResponse,
  type ScheduleList,
  type ScheduleVersion,
  type TimePunchMutation,
  type UserList,
  type Vacation,
  type VacationList,
} from './contracts.js';

function getDefaultApiBaseUrl(): string {
  if (
    typeof import.meta !== 'undefined' &&
    typeof import.meta.env?.VITE_API_BASE_URL === 'string' &&
    import.meta.env.VITE_API_BASE_URL.length > 0
  ) {
    return import.meta.env.VITE_API_BASE_URL.replace(/\/+$/, '');
  }
  if (typeof import.meta !== 'undefined' && import.meta.env?.DEV) {
    return 'http://localhost:3000';
  }
  if (typeof window !== 'undefined' && window.location?.hostname) {
    const hostname = window.location.hostname;
    const protocol = window.location.protocol === 'https:' ? 'https:' : 'http:';
    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '0.0.0.0' ||
      /^(\d{1,3}\.){3}\d{1,3}$/.test(hostname)
    ) {
      return `${protocol}//${hostname}:3000`;
    }
  }
  return 'https://ponto-api.phmotopecas.com';
}

export const apiBaseUrl = getDefaultApiBaseUrl();

export class ApiClientError extends Error {
  public constructor(
    public readonly kind: 'HTTP' | 'NETWORK' | 'INVALID_RESPONSE',
    message: string,
    public readonly status?: number,
    public readonly code?: string,
    public readonly details?: ApiProblem['details'],
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

export interface AccessSession {
  accessToken: string;
}

interface ApiClientDependencies {
  getSession: () => AccessSession | null;
  refreshSession: () => Promise<AccessSession>;
  onSessionExpired: () => void;
}

function createNetworkError(): ApiClientError {
  const offline = typeof navigator !== 'undefined' && !navigator.onLine;
  return new ApiClientError(
    'NETWORK',
    offline
      ? 'Você está sem conexão. Verifique a rede e tente novamente.'
      : 'Não foi possível acessar o servidor. Tente novamente em alguns instantes.',
  );
}

function formatProblemMessage(problem?: ApiProblem): string {
  if (!problem) return 'Não foi possível concluir a solicitação.';
  if (problem.details && Object.keys(problem.details).length > 0) {
    const fieldTranslations: Record<string, string> = {
      password: 'Senha',
      login: 'Login',
      name: 'Nome',
      reason: 'Motivo',
      occurredAt: 'Data/Hora',
      correctedOccurredAt: 'Data/Hora corrigida',
      expectedCurrentOccurredAt: 'Data/Hora atual',
      expectedSequence: 'Sequência',
      effectiveDate: 'Data de vigência',
      businessDate: 'Data',
      kind: 'Tipo',
      days: 'Grade semanal',
    };
    const errors = Object.entries(problem.details).map(([field, msgs]) => {
      const label = fieldTranslations[field] ?? field;
      return `${label}: ${msgs.join(', ')}`;
    });
    return `${problem.message} (${errors.join(' | ')})`;
  }
  return problem.message;
}

async function parseProblem(response: Response): Promise<ApiProblem | undefined> {
  try {
    const result = apiProblemSchema.safeParse(await response.clone().json());
    return result.success ? result.data : undefined;
  } catch {
    return undefined;
  }
}

export class ApiClient {
  public constructor(private readonly dependencies: ApiClientDependencies) {}

  // Employee methods
  public getToday(signal?: AbortSignal): Promise<DailyAttendance> {
    return this.request('/attendance/today', dailyAttendanceSchema, {
      ...(signal === undefined ? {} : { signal }),
    });
  }

  public getHistory(from: string, to: string, signal?: AbortSignal): Promise<AttendancePeriod> {
    const query = new URLSearchParams({ from, to });
    return this.request(`/attendance/history?${query.toString()}`, attendancePeriodSchema, {
      ...(signal === undefined ? {} : { signal }),
    });
  }

  public getMonthly(month: string, signal?: AbortSignal): Promise<MonthlyAttendance> {
    const query = new URLSearchParams({ month });
    return this.request(`/attendance/monthly?${query.toString()}`, monthlyAttendanceSchema, {
      ...(signal === undefined ? {} : { signal }),
    });
  }

  public createPunch(idempotencyKey: string): Promise<TimePunchMutation> {
    return this.request('/time-punches', timePunchMutationSchema, {
      method: 'POST',
      body: '{}',
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey },
    });
  }

  // Admin Overview
  public getAdminOverview(date?: string, signal?: AbortSignal): Promise<AttendanceOverview> {
    const query = date ? `?date=${encodeURIComponent(date)}` : '';
    return this.request(`/attendance/overview${query}`, attendanceOverviewSchema, {
      ...(signal === undefined ? {} : { signal }),
    });
  }

  // Admin Employees
  public getEmployees(
    params?: { search?: string; status?: 'ACTIVE' | 'INACTIVE'; page?: number; limit?: number },
    signal?: AbortSignal,
  ): Promise<UserList> {
    const q = new URLSearchParams();
    if (params?.search) q.set('search', params.search);
    if (params?.status === 'ACTIVE') q.set('isActive', 'true');
    if (params?.status === 'INACTIVE') q.set('isActive', 'false');
    if (params?.page) q.set('page', String(params.page));
    if (params?.limit) q.set('limit', String(params.limit));
    const qs = q.toString();
    return this.request(`/employees${qs ? `?${qs}` : ''}`, userListSchema, {
      ...(signal === undefined ? {} : { signal }),
    });
  }

  public getEmployee(id: string, signal?: AbortSignal): Promise<ManagedUser> {
    return this.request(`/employees/${encodeURIComponent(id)}`, managedUserSchema, {
      ...(signal === undefined ? {} : { signal }),
    });
  }

  public createEmployee(data: {
    name: string;
    login: string;
    password: string;
  }): Promise<ManagedUser> {
    return this.request('/employees', managedUserSchema, {
      method: 'POST',
      body: JSON.stringify({
        name: data.name,
        login: data.login,
        password: data.password,
      }),
      headers: { 'Content-Type': 'application/json' },
    });
  }

  public updateEmployee(id: string, data: { name?: string; login?: string }): Promise<ManagedUser> {
    return this.request(`/employees/${encodeURIComponent(id)}`, managedUserSchema, {
      method: 'PATCH',
      body: JSON.stringify(data),
      headers: { 'Content-Type': 'application/json' },
    });
  }

  public updateEmployeeStatus(id: string, isActive: boolean): Promise<ManagedUser> {
    return this.request(`/employees/${encodeURIComponent(id)}/status`, managedUserSchema, {
      method: 'PATCH',
      body: JSON.stringify({ isActive }),
      headers: { 'Content-Type': 'application/json' },
    });
  }

  public async resetEmployeePassword(id: string, password?: string): Promise<void> {
    await this.requestVoid(`/employees/${encodeURIComponent(id)}/password-reset`, {
      method: 'POST',
      body: JSON.stringify(password ? { password } : {}),
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Avatars
  public uploadAvatar(
    userId: string,
    dataBase64: string,
    mimeType: 'image/jpeg' | 'image/png' | 'image/webp',
  ): Promise<{ id: string }> {
    return this.request(
      `/users/${encodeURIComponent(userId)}/avatar`,
      z.object({ id: z.string().uuid() }).passthrough(),
      {
        method: 'POST',
        body: JSON.stringify({ dataBase64, mimeType }),
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }

  public async removeAvatar(userId: string): Promise<void> {
    await this.requestVoid(`/users/${encodeURIComponent(userId)}/avatar`, {
      method: 'DELETE',
    });
  }

  // Admin Attendance for employee
  public getAdminEmployeeDay(
    employeeId: string,
    date: string,
    signal?: AbortSignal,
  ): Promise<DailyAttendance> {
    const q = new URLSearchParams({ date });
    return this.request(
      `/attendance/employees/${encodeURIComponent(employeeId)}/day?${q.toString()}`,
      dailyAttendanceSchema,
      { ...(signal === undefined ? {} : { signal }) },
    );
  }

  public getAdminEmployeeHistory(
    employeeId: string,
    from: string,
    to: string,
    signal?: AbortSignal,
  ): Promise<AttendancePeriod> {
    const q = new URLSearchParams({ from, to });
    return this.request(
      `/attendance/employees/${encodeURIComponent(employeeId)}/history?${q.toString()}`,
      attendancePeriodSchema,
      { ...(signal === undefined ? {} : { signal }) },
    );
  }

  public getAdminEmployeeMonthly(
    employeeId: string,
    month: string,
    signal?: AbortSignal,
  ): Promise<MonthlyAttendance> {
    const q = new URLSearchParams({ month });
    return this.request(
      `/attendance/employees/${encodeURIComponent(employeeId)}/monthly?${q.toString()}`,
      monthlyAttendanceSchema,
      { ...(signal === undefined ? {} : { signal }) },
    );
  }

  // Punch insertions and corrections
  public insertManualPunch(
    data: {
      employeeId: string;
      occurredAt: string;
      reason: string;
    },
    idempotencyKey: string,
  ): Promise<TimePunchMutation> {
    return this.request('/time-punches/manual', adminTimePunchMutationSchema, {
      method: 'POST',
      body: JSON.stringify({
        employeeId: data.employeeId,
        occurredAt: data.occurredAt,
        reason: data.reason,
      }),
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey },
    });
  }

  public correctPunch(
    punchId: string,
    data: {
      correctedOccurredAt: string;
      expectedCurrentOccurredAt: string;
      expectedSequence: number;
      reason: string;
    },
    idempotencyKey: string,
  ): Promise<TimePunchMutation> {
    return this.request(
      `/time-punches/${encodeURIComponent(punchId)}/adjustments`,
      adminTimePunchMutationSchema,
      {
        method: 'POST',
        body: JSON.stringify({
          correctedOccurredAt: data.correctedOccurredAt,
          expectedCurrentOccurredAt: data.expectedCurrentOccurredAt,
          expectedSequence: data.expectedSequence,
          reason: data.reason,
        }),
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey },
      },
    );
  }

  // Admin Users
  public getAdmins(
    params?: { search?: string; status?: 'ACTIVE' | 'INACTIVE'; page?: number; limit?: number },
    signal?: AbortSignal,
  ): Promise<UserList> {
    const q = new URLSearchParams();
    if (params?.search) q.set('search', params.search);
    if (params?.status === 'ACTIVE') q.set('isActive', 'true');
    if (params?.status === 'INACTIVE') q.set('isActive', 'false');
    if (params?.page) q.set('page', String(params.page));
    if (params?.limit) q.set('limit', String(params.limit));
    const qs = q.toString();
    return this.request(`/admins${qs ? `?${qs}` : ''}`, userListSchema, {
      ...(signal === undefined ? {} : { signal }),
    });
  }

  public createAdmin(data: {
    name: string;
    login: string;
    password: string;
  }): Promise<ManagedUser> {
    return this.request('/admins', managedUserSchema, {
      method: 'POST',
      body: JSON.stringify({
        name: data.name,
        login: data.login,
        password: data.password,
      }),
      headers: { 'Content-Type': 'application/json' },
    });
  }

  public updateAdmin(id: string, data: { name?: string; login?: string }): Promise<ManagedUser> {
    return this.request(`/admins/${encodeURIComponent(id)}`, managedUserSchema, {
      method: 'PATCH',
      body: JSON.stringify(data),
      headers: { 'Content-Type': 'application/json' },
    });
  }

  public updateAdminStatus(id: string, isActive: boolean): Promise<ManagedUser> {
    return this.request(`/admins/${encodeURIComponent(id)}/status`, managedUserSchema, {
      method: 'PATCH',
      body: JSON.stringify({ isActive }),
      headers: { 'Content-Type': 'application/json' },
    });
  }

  public async resetAdminPassword(id: string, password?: string): Promise<void> {
    await this.requestVoid(`/admins/${encodeURIComponent(id)}/password-reset`, {
      method: 'POST',
      body: JSON.stringify(password ? { password } : {}),
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Schedules
  public getSchedules(
    params?: { page?: number; limit?: number },
    signal?: AbortSignal,
  ): Promise<ScheduleList> {
    const q = new URLSearchParams();
    if (params?.page) q.set('page', String(params.page));
    if (params?.limit) q.set('limit', String(params.limit));
    const qs = q.toString();
    return this.request(`/schedules${qs ? `?${qs}` : ''}`, scheduleListSchema, {
      ...(signal === undefined ? {} : { signal }),
    });
  }

  public createSchedule(data: {
    effectiveDate: string;
    note?: string;
    days: Array<{
      weekday: string;
      isOpen: boolean;
      openingMinute?: number | null;
      closingMinute?: number | null;
      lunchEnabled?: boolean;
      lunchStartMinute?: number | null;
      lunchEndMinute?: number | null;
    }>;
  }): Promise<ScheduleVersion> {
    return this.request('/schedules', scheduleVersionSchema, {
      method: 'POST',
      body: JSON.stringify(data),
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Calendar Exceptions
  public getCalendarExceptions(
    params?: { page?: number; limit?: number; from?: string; to?: string },
    signal?: AbortSignal,
  ): Promise<CalendarExceptionList> {
    const q = new URLSearchParams();
    if (params?.page) q.set('page', String(params.page));
    if (params?.limit) q.set('limit', String(params.limit));
    if (params?.from) q.set('from', params.from);
    if (params?.to) q.set('to', params.to);
    const qs = q.toString();
    return this.request(`/calendar-exceptions${qs ? `?${qs}` : ''}`, calendarExceptionListSchema, {
      ...(signal === undefined ? {} : { signal }),
    });
  }

  public upsertCalendarException(data: {
    businessDate: string;
    kind: 'HOLIDAY' | 'CLOSED' | 'SPECIAL_HOURS';
    name: string;
    openingMinute?: number | null;
    closingMinute?: number | null;
    lunchEnabled?: boolean;
    lunchStartMinute?: number | null;
    lunchEndMinute?: number | null;
  }): Promise<CalendarException> {
    return this.request('/calendar-exceptions', calendarExceptionSchema, {
      method: 'POST',
      body: JSON.stringify({
        ...data,
        lunchEnabled: data.lunchEnabled ?? false,
      }),
      headers: { 'Content-Type': 'application/json' },
    });
  }

  public retractCalendarException(id: string): Promise<CalendarException> {
    return this.request(
      `/calendar-exceptions/${encodeURIComponent(id)}/retract`,
      calendarExceptionSchema,
      {
        method: 'POST',
      },
    );
  }

  // Audit Logs
  public getAuditLogs(
    params?: {
      page?: number;
      limit?: number;
      from?: string;
      to?: string;
      action?: string;
      outcome?: string;
      actorId?: string;
      targetType?: string;
      targetId?: string;
    },
    signal?: AbortSignal,
  ): Promise<AuditLogList> {
    const q = new URLSearchParams();
    if (params?.page) q.set('page', String(params.page));
    if (params?.limit) q.set('limit', String(params.limit));
    if (params?.from) q.set('from', params.from);
    if (params?.to) q.set('to', params.to);
    if (params?.action) q.set('action', params.action);
    if (params?.outcome) q.set('outcome', params.outcome);
    if (params?.actorId) q.set('actorId', params.actorId);
    if (params?.targetType) q.set('targetType', params.targetType);
    if (params?.targetId) q.set('targetId', params.targetId);
    const qs = q.toString();
    return this.request(`/audit-logs${qs ? `?${qs}` : ''}`, auditLogListSchema, {
      ...(signal === undefined ? {} : { signal }),
    });
  }

  // Time Punch Adjustment Requests
  public createAdjustmentRequest(data: {
    timePunchId: string;
    requestedOccurredAt: string;
    reason: string;
  }): Promise<AdjustmentRequest> {
    return this.request('/adjustment-requests', adjustmentRequestSchema, {
      method: 'POST',
      body: JSON.stringify(data),
      headers: { 'Content-Type': 'application/json' },
    });
  }

  public getMyAdjustmentRequests(
    params?: {
      status?: AdjustmentRequestStatus;
      page?: number;
      limit?: number;
    },
    signal?: AbortSignal,
  ): Promise<AdjustmentRequestList> {
    const q = new URLSearchParams();
    if (params?.status) q.set('status', params.status);
    if (params?.page) q.set('page', String(params.page));
    if (params?.limit) q.set('limit', String(params.limit));
    const qs = q.toString();
    return this.request(
      `/adjustment-requests/my${qs ? `?${qs}` : ''}`,
      adjustmentRequestListSchema,
      {
        ...(signal === undefined ? {} : { signal }),
      },
    );
  }

  public getAdjustmentRequests(
    params?: {
      status?: AdjustmentRequestStatus;
      employeeId?: string;
      from?: string;
      to?: string;
      page?: number;
      limit?: number;
    },
    signal?: AbortSignal,
  ): Promise<AdjustmentRequestList> {
    const q = new URLSearchParams();
    if (params?.status) q.set('status', params.status);
    if (params?.employeeId) q.set('employeeId', params.employeeId);
    if (params?.from) q.set('from', params.from);
    if (params?.to) q.set('to', params.to);
    if (params?.page) q.set('page', String(params.page));
    if (params?.limit) q.set('limit', String(params.limit));
    const qs = q.toString();
    return this.request(`/adjustment-requests${qs ? `?${qs}` : ''}`, adjustmentRequestListSchema, {
      ...(signal === undefined ? {} : { signal }),
    });
  }

  public getPendingAdjustmentRequestsCount(
    signal?: AbortSignal,
  ): Promise<{ pendingCount: number }> {
    return this.request('/adjustment-requests/pending-count', pendingCountSchema, {
      ...(signal === undefined ? {} : { signal }),
    });
  }

  public approveAdjustmentRequest(
    id: string,
    data?: { adminComment?: string },
    idempotencyKey = crypto.randomUUID(),
  ): Promise<ReviewAdjustmentResponse> {
    return this.request(
      `/adjustment-requests/${encodeURIComponent(id)}/approve`,
      reviewAdjustmentResponseSchema,
      {
        method: 'POST',
        body: JSON.stringify(data ?? {}),
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey,
        },
      },
    );
  }

  public rejectAdjustmentRequest(
    id: string,
    data?: { adminComment?: string },
  ): Promise<ReviewAdjustmentResponse> {
    return this.request(
      `/adjustment-requests/${encodeURIComponent(id)}/reject`,
      reviewAdjustmentResponseSchema,
      {
        method: 'POST',
        body: JSON.stringify(data ?? {}),
        headers: {
          'Content-Type': 'application/json',
        },
      },
    );
  }

  // Vacations
  public getVacations(
    params?: {
      employeeId?: string;
      from?: string;
      to?: string;
      page?: number;
      limit?: number;
    },
    signal?: AbortSignal,
  ): Promise<VacationList> {
    const q = new URLSearchParams();
    if (params?.employeeId) q.set('employeeId', params.employeeId);
    if (params?.from) q.set('from', params.from);
    if (params?.to) q.set('to', params.to);
    if (params?.page) q.set('page', String(params.page));
    if (params?.limit) q.set('limit', String(params.limit));
    const qs = q.toString();
    return this.request(`/vacations${qs ? `?${qs}` : ''}`, vacationListSchema, {
      ...(signal === undefined ? {} : { signal }),
    });
  }

  public createVacation(data: CreateVacationInput): Promise<Vacation> {
    return this.request('/vacations', vacationSchema, {
      method: 'POST',
      body: JSON.stringify(data),
      headers: { 'Content-Type': 'application/json' },
    });
  }

  public deleteVacation(id: string): Promise<{ success: boolean; message: string }> {
    return this.request(
      `/vacations/${encodeURIComponent(id)}`,
      z.object({ success: z.boolean(), message: z.string() }),
      {
        method: 'DELETE',
      },
    );
  }

  public changeOwnPassword(input: { currentPassword: string; newPassword: string }): Promise<void> {
    return this.requestVoid('/users/me/change-password', {
      method: 'POST',
      body: JSON.stringify(input),
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  private async requestVoid(
    path: string,
    init: RequestInit = {},
    didRefresh = false,
  ): Promise<void> {
    const session = this.dependencies.getSession();
    if (session === null) {
      this.dependencies.onSessionExpired();
      throw new ApiClientError(
        'HTTP',
        'Sua sessão expirou. Entre novamente para continuar.',
        401,
        'AUTHENTICATION_REQUIRED',
      );
    }

    let response: Response;
    try {
      response = await fetch(new URL(path, apiBaseUrl), {
        ...init,
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${session.accessToken}`,
          ...init.headers,
        },
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') throw error;
      throw createNetworkError();
    }

    if (response.status === 401 && !didRefresh) {
      try {
        await this.dependencies.refreshSession();
      } catch {
        this.dependencies.onSessionExpired();
        throw new ApiClientError(
          'HTTP',
          'Sua sessão expirou. Entre novamente para continuar.',
          401,
          'AUTHENTICATION_REQUIRED',
        );
      }
      return this.requestVoid(path, init, true);
    }

    if (!response.ok) {
      const problem = await parseProblem(response);
      throw new ApiClientError(
        'HTTP',
        formatProblemMessage(problem),
        response.status,
        problem?.code,
        problem?.details,
      );
    }
  }

  private async request<T>(
    path: string,
    schema: ZodType<T>,
    init: RequestInit = {},
    didRefresh = false,
  ): Promise<T> {
    const session = this.dependencies.getSession();
    if (session === null) {
      this.dependencies.onSessionExpired();
      throw new ApiClientError(
        'HTTP',
        'Sua sessão expirou. Entre novamente para continuar.',
        401,
        'AUTHENTICATION_REQUIRED',
      );
    }

    let response: Response;
    try {
      response = await fetch(new URL(path, apiBaseUrl), {
        ...init,
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${session.accessToken}`,
          ...init.headers,
        },
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') throw error;
      throw createNetworkError();
    }

    if (response.status === 401 && !didRefresh) {
      try {
        await this.dependencies.refreshSession();
      } catch (error) {
        const refreshErrorCode =
          typeof error === 'object' && error !== null && 'code' in error
            ? String((error as { code?: unknown }).code)
            : '';
        if (refreshErrorCode === 'API_UNAVAILABLE' || refreshErrorCode === 'API_TIMEOUT') {
          throw createNetworkError();
        }
        this.dependencies.onSessionExpired();
        throw new ApiClientError(
          'HTTP',
          'Sua sessão expirou. Entre novamente para continuar.',
          401,
          'AUTHENTICATION_REQUIRED',
        );
      }
      return this.request(path, schema, init, true);
    }

    if (!response.ok) {
      const problem = await parseProblem(response);
      throw new ApiClientError(
        'HTTP',
        formatProblemMessage(problem),
        response.status,
        problem?.code,
        problem?.details,
      );
    }

    try {
      return schema.parse(await response.json());
    } catch {
      throw new ApiClientError(
        'INVALID_RESPONSE',
        'O servidor retornou uma resposta inesperada. Tente novamente.',
      );
    }
  }
}
