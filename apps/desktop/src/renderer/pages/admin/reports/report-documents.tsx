import { formatMinutesDuration } from '@ph-ponto/shared';

import type {
  AttendancePeriodTotals,
  CompanyDto,
  DailyAttendance,
  TimesheetReport,
  TimesheetReportEmployee,
} from '../../../api/contracts.js';
import logoUrl from '../../../assets/phmotos-logo.png';
import {
  formatDateBR,
  formatDateTimeBR,
  formatDisplayName,
  formatMinutes,
  getWeekdayShortBR,
} from '../../../lib/format.js';
import {
  describeDay,
  formatCompanyAddress,
  formatCpf,
  hasConfiguredCnpj,
  isExcludedFromTotals,
  punchCells,
  punchColumnCount,
  type DayTone,
} from './report-model.js';

/*
 * Printable documents are rendered as white "paper" in both themes so the screen
 * preview matches the printed/PDF output exactly. Never use <header> or <button>
 * here: the global print stylesheet hides those elements.
 */

const TONE_TEXT: Record<DayTone, string> = {
  ok: 'text-slate-700',
  extra: 'text-blue-700',
  absence: 'text-rose-700 font-semibold',
  debit: 'text-rose-700',
  incomplete: 'text-amber-700 font-semibold',
  off: 'text-slate-500',
  progress: 'text-sky-700',
};

function balanceClass(value: number | null): string {
  if (value === null || value === 0) return 'text-slate-500';
  return value > 0 ? 'text-emerald-700' : 'text-rose-700';
}

interface DocumentHeaderProps {
  company: CompanyDto | null | undefined;
  title: string;
  subtitle: string;
}

export function ReportDocumentHeader({
  company,
  title,
  subtitle,
}: DocumentHeaderProps): React.JSX.Element {
  const address = formatCompanyAddress(company);
  const contact = [company?.phone, company?.email].filter(Boolean).join(' • ');
  return (
    <div className="report-doc-header flex items-start justify-between gap-6 border-b-2 border-slate-800 pb-3">
      <div className="flex items-center gap-4 min-w-0">
        <img
          src={logoUrl}
          alt="PH Motopeças"
          className="h-10 w-auto shrink-0 object-contain"
          draggable={false}
        />
        <div className="min-w-0">
          <div className="text-[13px] font-bold leading-tight text-slate-900">
            {company?.legalName ?? 'PH Motopeças'}
          </div>
          {hasConfiguredCnpj(company) && (
            <div className="text-[10px] text-slate-600">CNPJ {company?.cnpj}</div>
          )}
          {address && <div className="text-[10px] text-slate-500">{address}</div>}
          {contact && <div className="text-[10px] text-slate-500">{contact}</div>}
        </div>
      </div>
      <div className="text-right shrink-0">
        <div className="text-[15px] font-extrabold uppercase tracking-wide text-slate-900">
          {title}
        </div>
        <div className="text-[11px] font-semibold text-slate-700">{subtitle}</div>
      </div>
    </div>
  );
}

function InfoField({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <div className="min-w-0">
      <div className="text-[9px] font-bold uppercase tracking-wider text-slate-500">{label}</div>
      <div className="truncate text-[12px] font-semibold text-slate-900" title={value}>
        {value}
      </div>
    </div>
  );
}

function TotalsStrip({ totals }: { totals: AttendancePeriodTotals }): React.JSX.Element {
  const items: Array<{ label: string; value: string; className?: string | undefined }> = [
    { label: 'Previsto', value: formatMinutesDuration(totals.expectedMinutes) },
    { label: 'Trabalhado', value: formatMinutesDuration(totals.workedMinutes) },
    {
      label: 'Saldo',
      value: `${totals.balanceMinutes > 0 ? '+' : ''}${formatMinutesDuration(totals.balanceMinutes)}`,
      className: balanceClass(totals.balanceMinutes),
    },
    {
      label: 'Horas extras',
      value: formatMinutesDuration(totals.overtimeMinutes),
      className: totals.overtimeMinutes > 0 ? 'text-emerald-700' : undefined,
    },
    {
      label: 'Faltas e atrasos',
      value: formatMinutesDuration(totals.missingMinutes),
      className: totals.missingMinutes > 0 ? 'text-rose-700' : undefined,
    },
  ];
  return (
    <div className="grid grid-cols-5 divide-x divide-slate-200 rounded-md border border-slate-300">
      {items.map((item) => (
        <div key={item.label} className="px-2 py-1.5 text-center">
          <div className="text-[9px] font-bold uppercase tracking-wider text-slate-500">
            {item.label}
          </div>
          <div
            className={`font-mono text-[13px] font-bold tabular-nums ${item.className ?? 'text-slate-900'}`}
          >
            {item.value}
          </div>
        </div>
      ))}
    </div>
  );
}

interface TimesheetDocumentProps {
  company: CompanyDto | null | undefined;
  report: Pick<TimesheetReport, 'from' | 'to' | 'generatedAt'>;
  employee: TimesheetReportEmployee;
  className?: string;
}

export function TimesheetDocument({
  company,
  report,
  employee,
  className = '',
}: TimesheetDocumentProps): React.JSX.Element {
  const days: DailyAttendance[] = employee.days ?? [];
  const columns = punchColumnCount(days);
  const hasAdjusted = days.some((day) => punchCells(day).some((cell) => cell.adjusted));
  const pendingDays = days.filter(isExcludedFromTotals).length;
  // Long periods get tighter rows so a full month plus signatures fits on one A4 page.
  const rowPadding = days.length > 26 ? 'py-px' : 'py-[2px]';
  const name = formatDisplayName(employee.name);
  const cpf = formatCpf(employee.cpf);
  const roleLabel = [employee.roleTitle, employee.department].filter(Boolean).join(' • ');

  return (
    <article
      className={`report-paper bg-white text-slate-900 ${className}`}
      aria-label={`Espelho de ponto de ${name}`}
    >
      <ReportDocumentHeader
        company={company}
        title="Espelho de Ponto"
        subtitle={`${formatDateBR(report.from)} a ${formatDateBR(report.to)}`}
      />

      <div className="print-avoid-break mt-3 grid grid-cols-4 gap-x-4 gap-y-2 rounded-md border border-slate-300 bg-slate-50 px-3 py-2">
        <div className="col-span-2">
          <InfoField label="Colaborador" value={name} />
        </div>
        <InfoField label="CPF" value={cpf ?? 'Não informado'} />
        <InfoField
          label="Admissão"
          value={employee.hireDate ? formatDateBR(employee.hireDate) : 'Não informada'}
        />
        <div className="col-span-2">
          <InfoField label="Cargo / Setor" value={roleLabel || 'Não informado'} />
        </div>
        <InfoField label="Login" value={`@${employee.login}`} />
        <InfoField label="Situação" value={employee.isActive ? 'Ativo' : 'Inativo'} />
      </div>

      <div className="print-avoid-break mt-3">
        <TotalsStrip totals={employee.totals} />
      </div>

      <table className="print-table mt-3 w-full table-fixed border-collapse text-[10.5px]">
        <colgroup>
          <col style={{ width: '70px' }} />
          <col style={{ width: '32px' }} />
          {Array.from({ length: columns }, (_, index) => (
            <col key={index} style={{ width: columns > 4 ? '40px' : '46px' }} />
          ))}
          <col />
          <col style={{ width: '54px' }} />
          <col style={{ width: '66px' }} />
          <col style={{ width: '58px' }} />
        </colgroup>
        <thead>
          <tr className="border-y border-slate-400 bg-slate-100 text-[8.5px] font-bold uppercase text-slate-600">
            <th className="px-1.5 py-1.5 text-left">Data</th>
            <th className="px-1 py-1.5 text-left">Dia</th>
            {Array.from({ length: columns }, (_, index) => (
              <th key={index} className="px-1 py-1.5 text-center">
                {index % 2 === 0 ? 'Entrada' : 'Saída'}
              </th>
            ))}
            <th className="px-1.5 py-1.5 text-left">Ocorrência</th>
            <th className="px-1 py-1.5 text-right">Previsto</th>
            <th className="px-1 py-1.5 text-right">Trabalhado</th>
            <th className="px-1.5 py-1.5 text-right">Saldo</th>
          </tr>
        </thead>
        <tbody>
          {days.length === 0 && (
            <tr>
              <td
                colSpan={columns + 6}
                className="px-2 py-6 text-center text-[11px] italic text-slate-500"
              >
                Nenhum dia apurado neste período.
              </td>
            </tr>
          )}
          {days.map((day) => {
            const status = describeDay(day);
            const cells = punchCells(day);
            const muted = status.tone === 'off';
            return (
              <tr
                key={day.businessDate}
                className={`border-b border-slate-200 ${muted ? 'bg-slate-50/70' : ''}`}
              >
                <td className={`px-1.5 ${rowPadding} font-semibold tabular-nums`}>
                  {formatDateBR(day.businessDate)}
                </td>
                <td className={`px-1 ${rowPadding} text-slate-600`}>
                  {getWeekdayShortBR(day.businessDate)}
                </td>
                {Array.from({ length: columns }, (_, index) => {
                  const cell = cells[index];
                  return (
                    <td
                      key={index}
                      className={`px-1 ${rowPadding} text-center font-mono tabular-nums text-slate-900`}
                    >
                      {cell ? (
                        <>
                          {cell.time}
                          {cell.adjusted && <span className="text-amber-700">*</span>}
                        </>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                  );
                })}
                <td
                  className={`truncate px-1.5 ${rowPadding} ${TONE_TEXT[status.tone]}`}
                  title={status.label}
                >
                  {status.label}
                </td>
                <td
                  className={`px-1 ${rowPadding} text-right font-mono tabular-nums text-slate-600`}
                >
                  {formatMinutes(day.expectedMinutes)}
                </td>
                <td
                  className={`px-1 ${rowPadding} text-right font-mono font-semibold tabular-nums`}
                >
                  {formatMinutes(day.workedMinutes)}
                </td>
                <td
                  className={`px-1.5 ${rowPadding} text-right font-mono font-semibold tabular-nums ${balanceClass(day.balanceMinutes)}`}
                >
                  {formatMinutes(day.balanceMinutes, true)}
                </td>
              </tr>
            );
          })}
          <tr className="print-total-row print-avoid-break border-t-2 border-slate-500 bg-slate-100 font-bold">
            <td colSpan={columns + 3} className="px-1.5 py-1.5 text-[10px] uppercase tracking-wide">
              Total do período · {employee.totals.completeDayCount}{' '}
              {employee.totals.completeDayCount === 1 ? 'dia fechado' : 'dias fechados'}
            </td>
            <td className="px-1 py-1.5 text-right font-mono tabular-nums">
              {formatMinutes(employee.totals.expectedMinutes)}
            </td>
            <td className="px-1 py-1.5 text-right font-mono tabular-nums">
              {formatMinutes(employee.totals.workedMinutes)}
            </td>
            <td
              className={`px-1.5 py-1.5 text-right font-mono tabular-nums ${balanceClass(employee.totals.balanceMinutes)}`}
            >
              {formatMinutes(employee.totals.balanceMinutes, true)}
            </td>
          </tr>
        </tbody>
      </table>

      {(hasAdjusted || pendingDays > 0) && (
        <div className="print-avoid-break mt-2 space-y-0.5 text-[9.5px] leading-snug text-slate-600">
          {hasAdjusted && (
            <p>
              <span className="font-bold text-amber-700">*</span> Horário ajustado pela
              administração. O registro original permanece preservado no histórico de auditoria.
            </p>
          )}
          {pendingDays > 0 && (
            <p>
              {pendingDays === 1
                ? '1 dia em andamento ou com batidas incompletas não entra'
                : `${pendingDays} dias em andamento ou com batidas incompletas não entram`}{' '}
              nos totais até serem regularizados.
            </p>
          )}
        </div>
      )}

      <div className="print-signatures print-avoid-break mt-4">
        <p className="text-justify text-[10px] leading-relaxed text-slate-600">
          Declaro que as marcações de entrada e saída e as ocorrências registradas neste espelho
          correspondem à minha jornada de trabalho no período indicado.
        </p>
        <div className="mt-7 grid grid-cols-2 gap-12">
          <div className="text-center">
            <div className="mx-auto mb-1.5 w-4/5 border-t border-slate-700" />
            <div className="text-[11px] font-bold">{name}</div>
            <div className="text-[9.5px] text-slate-500">Colaborador</div>
          </div>
          <div className="text-center">
            <div className="mx-auto mb-1.5 w-4/5 border-t border-slate-700" />
            <div className="text-[11px] font-bold">{company?.legalName ?? 'PH Motopeças'}</div>
            <div className="text-[9.5px] text-slate-500">Responsável pela empresa</div>
          </div>
        </div>
        <div className="mt-4 flex justify-between border-t border-slate-200 pt-1.5 text-[9px] text-slate-400">
          <span>Emitido em {formatDateTimeBR(report.generatedAt)} • PH-Ponto</span>
          <span>Local e data: ____________________, ____/____/________</span>
        </div>
      </div>
    </article>
  );
}

interface TeamSummaryDocumentProps {
  company: CompanyDto | null | undefined;
  report: TimesheetReport;
}

export function TeamSummaryDocument({
  company,
  report,
}: TeamSummaryDocumentProps): React.JSX.Element {
  return (
    <article className="report-paper bg-white text-slate-900" aria-label="Resumo da equipe">
      <ReportDocumentHeader
        company={company}
        title="Resumo de Ponto da Equipe"
        subtitle={`${formatDateBR(report.from)} a ${formatDateBR(report.to)}`}
      />
      <div className="print-avoid-break mt-3">
        <TotalsStrip totals={report.totals} />
      </div>
      <table className="print-table mt-3 w-full border-collapse text-[10.5px]">
        <thead>
          <tr className="border-y border-slate-400 bg-slate-100 text-[9px] font-bold uppercase tracking-wide text-slate-600">
            <th className="px-1.5 py-1.5 text-left">Colaborador</th>
            <th className="px-1.5 py-1.5 text-left">Cargo</th>
            <th className="px-1 py-1.5 text-right">Dias</th>
            <th className="px-1 py-1.5 text-right">Previsto</th>
            <th className="px-1 py-1.5 text-right">Trabalhado</th>
            <th className="px-1 py-1.5 text-right">Saldo</th>
            <th className="px-1 py-1.5 text-right">Extras</th>
            <th className="px-1.5 py-1.5 text-right">Faltas/atrasos</th>
          </tr>
        </thead>
        <tbody>
          {report.employees.map((employee) => (
            <tr key={employee.employeeId} className="border-b border-slate-200">
              <td className="px-1.5 py-[2px] font-semibold">
                {formatDisplayName(employee.name)}
                {!employee.isActive && (
                  <span className="ml-1 text-[9px] font-normal text-slate-500">(inativo)</span>
                )}
              </td>
              <td
                className="max-w-[170px] truncate whitespace-nowrap px-1.5 py-[2px] text-slate-600"
                title={employee.roleTitle ?? undefined}
              >
                {employee.roleTitle ?? '—'}
              </td>
              <td className="px-1 py-[2px] text-right tabular-nums">
                {employee.totals.completeDayCount}
                {employee.totals.incompleteDayCount > 0 && (
                  <span className="text-amber-700"> ({employee.totals.incompleteDayCount}!)</span>
                )}
              </td>
              <td className="px-1 py-[2px] text-right font-mono tabular-nums text-slate-600">
                {formatMinutes(employee.totals.expectedMinutes)}
              </td>
              <td className="px-1 py-[2px] text-right font-mono font-semibold tabular-nums">
                {formatMinutes(employee.totals.workedMinutes)}
              </td>
              <td
                className={`px-1 py-[2px] text-right font-mono font-semibold tabular-nums ${balanceClass(employee.totals.balanceMinutes)}`}
              >
                {formatMinutes(employee.totals.balanceMinutes, true)}
              </td>
              <td className="px-1 py-[2px] text-right font-mono tabular-nums">
                {formatMinutes(employee.totals.overtimeMinutes)}
              </td>
              <td className="px-1.5 py-[2px] text-right font-mono tabular-nums">
                {formatMinutes(employee.totals.missingMinutes)}
              </td>
            </tr>
          ))}
          <tr className="print-total-row print-avoid-break border-t-2 border-slate-500 bg-slate-100 font-bold">
            <td colSpan={2} className="px-1.5 py-1.5 text-[10px] uppercase tracking-wide">
              Total da equipe · {report.employees.length}{' '}
              {report.employees.length === 1 ? 'colaborador' : 'colaboradores'}
            </td>
            <td className="px-1 py-1.5 text-right tabular-nums">
              {report.totals.completeDayCount}
            </td>
            <td className="px-1 py-1.5 text-right font-mono tabular-nums">
              {formatMinutes(report.totals.expectedMinutes)}
            </td>
            <td className="px-1 py-1.5 text-right font-mono tabular-nums">
              {formatMinutes(report.totals.workedMinutes)}
            </td>
            <td
              className={`px-1 py-1.5 text-right font-mono tabular-nums ${balanceClass(report.totals.balanceMinutes)}`}
            >
              {formatMinutes(report.totals.balanceMinutes, true)}
            </td>
            <td className="px-1 py-1.5 text-right font-mono tabular-nums">
              {formatMinutes(report.totals.overtimeMinutes)}
            </td>
            <td className="px-1.5 py-1.5 text-right font-mono tabular-nums">
              {formatMinutes(report.totals.missingMinutes)}
            </td>
          </tr>
        </tbody>
      </table>
      <p className="mt-2 text-[9.5px] text-slate-600">
        Totais consideram apenas dias fechados e completos. Dias em andamento ou com batidas
        incompletas (!) entram após a regularização.
      </p>
      <div className="mt-4 border-t border-slate-200 pt-1.5 text-[9px] text-slate-400">
        Emitido em {formatDateTimeBR(report.generatedAt)} • PH-Ponto
      </div>
    </article>
  );
}
