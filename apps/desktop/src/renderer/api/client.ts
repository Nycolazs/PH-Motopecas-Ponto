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
  incompleteAttendanceSchema,
  managedUserSchema,
  monthlyAttendanceSchema,
  pendingCountSchema,
  reviewAdjustmentResponseSchema,
  scheduleListSchema,
  scheduleVersionSchema,
  timePunchAdjustmentHistorySchema,
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
  type IncompleteAttendance,
  type ManagedUser,
  type MonthlyAttendance,
  type ReviewAdjustmentResponse,
  type ScheduleList,
  type ScheduleVersion,
  type TimePunchAdjustmentHistory,
  type TimePunchMutation,
  type UserList,
  type Vacation,
  type VacationList,
  companySchema,
  setupStatusSchema,
  jobRoleSchema,
  jobRoleVersionSchema,
  employeeRoleAssignmentSchema,
  employeeProfileSchema,
  type CompanyDto,
  type UpdateCompanyDto,
  type SetupStatusDto,
  type JobRoleDto,
  type CreateJobRoleDto,
  type UpdateJobRoleDto,
  type JobRoleVersionDto,
  type CreateJobRoleVersionDto,
  type EmployeeRoleAssignmentDto,
  type AssignEmployeeRoleDto,
  type EmployeeProfileDto,
  type UpdateEmployeeProfileDto,
  documentDraftSchema,
  generatedDocumentSchema,
  documentListSchema,
  cultureProfileSchema,
  type DocumentDraftDto,
  type SaveDocumentDraftDto,
  type PrepareDocumentDraftDto,
  type ConfirmDocumentDraftDto,
  type GeneratedDocumentDto,
  type ListDocumentsQueryDto,
  type VoidDocumentDto,
  type DocumentListDto,
  type CultureProfileDto,
  type DocumentTypeDto,
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

  // Admin Incomplete Days
  public getAdminIncompleteDays(
    month?: string,
    signal?: AbortSignal,
  ): Promise<IncompleteAttendance> {
    const query = month ? `?month=${encodeURIComponent(month)}` : '';
    return this.request(`/attendance/incompletes${query}`, incompleteAttendanceSchema, {
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

  public getPunchAdjustments(
    punchId: string,
    signal?: AbortSignal,
  ): Promise<TimePunchAdjustmentHistory> {
    return this.request(
      `/time-punches/${encodeURIComponent(punchId)}/adjustments`,
      timePunchAdjustmentHistorySchema,
      {
        ...(signal === undefined ? {} : { signal }),
      },
    );
  }

  public deletePunch(
    punchId: string,
    reason: string,
    idempotencyKey: string,
  ): Promise<{ success: boolean; message: string }> {
    return this.request(
      `/time-punches/${encodeURIComponent(punchId)}`,
      z.object({ success: z.boolean(), message: z.string() }),
      {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey },
        body: JSON.stringify({ reason }),
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

  // Company
  public getCompany(signal?: AbortSignal): Promise<CompanyDto> {
    return this.request('/company', companySchema, {
      ...(signal === undefined ? {} : { signal }),
    });
  }

  public updateCompany(data: UpdateCompanyDto): Promise<CompanyDto> {
    return this.request('/company', companySchema, {
      method: 'PUT',
      body: JSON.stringify(data),
      headers: { 'Content-Type': 'application/json' },
    });
  }

  public getSetupStatus(signal?: AbortSignal): Promise<SetupStatusDto> {
    return this.request('/company/setup-status', setupStatusSchema, {
      ...(signal === undefined ? {} : { signal }),
    });
  }

  // Employee Profile & Access
  public toggleEmployeeAccess(
    id: string,
    accessEnabled: boolean,
    password?: string,
  ): Promise<ManagedUser> {
    return this.request(`/employees/${encodeURIComponent(id)}/access`, managedUserSchema, {
      method: 'PATCH',
      body: JSON.stringify({ accessEnabled, ...(password ? { password } : {}) }),
      headers: { 'Content-Type': 'application/json' },
    });
  }

  public getEmployeeProfile(id: string, signal?: AbortSignal): Promise<EmployeeProfileDto> {
    return this.request(`/employees/${encodeURIComponent(id)}/profile`, employeeProfileSchema, {
      ...(signal === undefined ? {} : { signal }),
    });
  }

  public updateEmployeeProfile(
    id: string,
    data: UpdateEmployeeProfileDto,
  ): Promise<EmployeeProfileDto> {
    return this.request(`/employees/${encodeURIComponent(id)}/profile`, employeeProfileSchema, {
      method: 'PUT',
      body: JSON.stringify(data),
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Job Roles
  public getJobRoles(includeInactive?: boolean, signal?: AbortSignal): Promise<JobRoleDto[]> {
    const qs = includeInactive ? '?includeInactive=true' : '';
    return this.request(`/job-roles${qs}`, z.array(jobRoleSchema), {
      ...(signal === undefined ? {} : { signal }),
    });
  }

  public getJobRole(id: string, signal?: AbortSignal): Promise<JobRoleDto> {
    return this.request(`/job-roles/${encodeURIComponent(id)}`, jobRoleSchema, {
      ...(signal === undefined ? {} : { signal }),
    });
  }

  public createJobRole(data: CreateJobRoleDto): Promise<JobRoleDto> {
    return this.request('/job-roles', jobRoleSchema, {
      method: 'POST',
      body: JSON.stringify(data),
      headers: { 'Content-Type': 'application/json' },
    });
  }

  public updateJobRole(id: string, data: UpdateJobRoleDto): Promise<JobRoleDto> {
    return this.request(`/job-roles/${encodeURIComponent(id)}`, jobRoleSchema, {
      method: 'PATCH',
      body: JSON.stringify(data),
      headers: { 'Content-Type': 'application/json' },
    });
  }

  public publishJobRoleVersion(
    id: string,
    data: CreateJobRoleVersionDto,
  ): Promise<JobRoleVersionDto> {
    return this.request(`/job-roles/${encodeURIComponent(id)}/versions`, jobRoleVersionSchema, {
      method: 'POST',
      body: JSON.stringify(data),
      headers: { 'Content-Type': 'application/json' },
    });
  }

  public getEmployeeRoleAssignments(
    employeeId: string,
    signal?: AbortSignal,
  ): Promise<EmployeeRoleAssignmentDto[]> {
    return this.request(
      `/employees/${encodeURIComponent(employeeId)}/roles`,
      z.array(employeeRoleAssignmentSchema),
      {
        ...(signal === undefined ? {} : { signal }),
      },
    );
  }

  public assignEmployeeRole(
    employeeId: string,
    data: AssignEmployeeRoleDto,
  ): Promise<EmployeeRoleAssignmentDto> {
    return this.request(
      `/employees/${encodeURIComponent(employeeId)}/roles`,
      employeeRoleAssignmentSchema,
      {
        method: 'POST',
        body: JSON.stringify(data),
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }

  // Documents & Drafts
  public getDraft(
    documentType: DocumentTypeDto,
    employeeId?: string,
    signal?: AbortSignal,
  ): Promise<DocumentDraftDto | null> {
    const q = new URLSearchParams();
    q.set('documentType', documentType);
    if (employeeId) q.set('employeeId', employeeId);
    return this.request(`/documents/drafts?${q.toString()}`, documentDraftSchema.nullable(), {
      ...(signal === undefined ? {} : { signal }),
    });
  }

  public getDraftById(id: string, signal?: AbortSignal): Promise<DocumentDraftDto> {
    return this.request(`/documents/drafts/${encodeURIComponent(id)}`, documentDraftSchema, {
      ...(signal === undefined ? {} : { signal }),
    });
  }

  public saveDraft(data: SaveDocumentDraftDto): Promise<DocumentDraftDto> {
    return this.request('/documents/drafts', documentDraftSchema, {
      method: 'POST',
      body: JSON.stringify(data),
      headers: { 'Content-Type': 'application/json' },
    });
  }

  public discardDraft(id: string): Promise<{ success: boolean }> {
    return this.request(
      `/documents/drafts/${encodeURIComponent(id)}`,
      z.object({ success: z.boolean() }),
      {
        method: 'DELETE',
      },
    );
  }

  public prepareDraft(id: string, data: PrepareDocumentDraftDto): Promise<DocumentDraftDto> {
    return this.request(
      `/documents/drafts/${encodeURIComponent(id)}/prepare`,
      documentDraftSchema,
      {
        method: 'POST',
        body: JSON.stringify(data),
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }

  public confirmDraft(id: string, data: ConfirmDocumentDraftDto): Promise<GeneratedDocumentDto> {
    return this.request(
      `/documents/drafts/${encodeURIComponent(id)}/confirm`,
      generatedDocumentSchema,
      {
        method: 'POST',
        body: JSON.stringify(data),
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }

  public getDocuments(
    params?: ListDocumentsQueryDto,
    signal?: AbortSignal,
  ): Promise<DocumentListDto> {
    const q = new URLSearchParams();
    if (params?.page) q.set('page', String(params.page));
    if (params?.limit) q.set('limit', String(params.limit));
    if (params?.documentType) q.set('documentType', params.documentType);
    if (params?.employeeId) q.set('employeeId', params.employeeId);
    if (params?.search) q.set('search', params.search);
    if (params?.isVoid !== undefined) q.set('isVoid', String(params.isVoid));
    const qs = q.toString();
    return this.request(`/documents${qs ? `?${qs}` : ''}`, documentListSchema, {
      ...(signal === undefined ? {} : { signal }),
    });
  }

  public getDocumentById(id: string, signal?: AbortSignal): Promise<GeneratedDocumentDto> {
    return this.request(`/documents/${encodeURIComponent(id)}`, generatedDocumentSchema, {
      ...(signal === undefined ? {} : { signal }),
    });
  }

  public voidDocument(id: string, data: VoidDocumentDto): Promise<GeneratedDocumentDto> {
    return this.request(`/documents/${encodeURIComponent(id)}/void`, generatedDocumentSchema, {
      method: 'POST',
      body: JSON.stringify(data),
      headers: { 'Content-Type': 'application/json' },
    });
  }

  public async getArtifactPreviewBlob(artifactId: string, signal?: AbortSignal): Promise<Blob> {
    const res = await this.requestBlob(
      `/documents/artifacts/${encodeURIComponent(artifactId)}/preview`,
      {
        ...(signal === undefined ? {} : { signal }),
      },
    );
    return res.blob;
  }

  public async downloadDocumentBlob(
    id: string,
    signal?: AbortSignal,
  ): Promise<{ blob: Blob; filename: string }> {
    const res = await this.requestBlob(`/documents/${encodeURIComponent(id)}/download`, {
      ...(signal === undefined ? {} : { signal }),
    });
    return {
      blob: res.blob,
      filename: res.filename ?? `documento_${id}.pdf`,
    };
  }

  // Culture
  public getCulture(signal?: AbortSignal): Promise<CultureProfileDto> {
    return this.request('/culture', cultureProfileSchema, {
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

  private async requestBlob(
    path: string,
    init: RequestInit = {},
    didRefresh = false,
  ): Promise<{ blob: Blob; filename?: string }> {
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
      return this.requestBlob(path, init, true);
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

    const disposition = response.headers.get('content-disposition');
    let filename: string | undefined;
    if (disposition) {
      const match = disposition.match(/filename=["']?([^"';]+)["']?/);
      if (match?.[1]) filename = match[1];
    }

    const blob = await response.blob();
    const result: { blob: Blob; filename?: string } = { blob };
    if (filename !== undefined) {
      result.filename = filename;
    }
    return result;
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
