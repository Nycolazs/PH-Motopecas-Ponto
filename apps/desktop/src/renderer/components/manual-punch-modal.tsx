import { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useApiClient } from '../auth/use-auth.js';
import type { ManagedUser, DailyAttendance } from '../api/contracts.js';
import { Modal } from './modal.js';
import { SelectInput } from './select-input.js';
import { formatDateBR } from '../lib/format.js';

export interface ManualPunchModalProps {
  isOpen: boolean;
  onClose: () => void;
  employees: Array<Pick<ManagedUser, 'id' | 'name' | 'login'>>;
  initialEmployeeId?: string | undefined;
  initialDate?: string | null | undefined;
  existingDays?: DailyAttendance[] | undefined;
  onSuccess: () => void;
}

export function ManualPunchModal({
  isOpen,
  onClose,
  employees,
  initialEmployeeId,
  initialDate,
  existingDays,
  onSuccess,
}: ManualPunchModalProps): React.JSX.Element {
  const api = useApiClient();
  const [employeeId, setEmployeeId] = useState('');
  const [punchDate, setPunchDate] = useState('');
  const [punchTime, setPunchTime] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [showFullDayConfirm, setShowFullDayConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setEmployeeId(initialEmployeeId ?? employees[0]?.id ?? '');
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');

      setPunchDate(initialDate || `${year}-${month}-${day}`);
      setPunchTime(`${hours}:${minutes}`);
      setReason('');
      setError(null);
      setShowFullDayConfirm(false);
    }
  }, [isOpen, initialEmployeeId, initialDate, employees]);

  const selectedEmployee = employees.find((emp) => emp.id === employeeId);
  const targetDay = existingDays?.find((d) => d.businessDate === punchDate);
  const hasFullPunches = Boolean(
    targetDay &&
      (targetDay.punchCount >= 4 ||
        (targetDay.punchCount > 0 &&
          targetDay.status !== 'INCOMPLETE' &&
          targetDay.workState === 'OFF_DUTY')),
  );

  const executeInsert = async (): Promise<void> => {
    try {
      setLoading(true);
      setError(null);

      const fullDateTime = `${punchDate}T${punchTime}:00`;
      const isoDate = new Date(fullDateTime).toISOString();
      const idempotencyKey = crypto.randomUUID();

      await api.insertManualPunch(
        {
          employeeId,
          occurredAt: isoDate,
          reason: reason.trim(),
        },
        idempotencyKey,
      );

      onSuccess();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao inserir o ponto manual.';
      setError(msg);
      setShowFullDayConfirm(false);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault();
    if (!employeeId) {
      setError('Selecione o funcionário.');
      return;
    }
    if (!punchDate) {
      setError('Informe a data da batida.');
      return;
    }
    if (!punchTime) {
      setError('Informe o horário da batida.');
      return;
    }
    if (!reason.trim()) {
      setError('A justificativa administrativa é obrigatória.');
      return;
    }

    if (hasFullPunches && !showFullDayConfirm) {
      setShowFullDayConfirm(true);
      return;
    }

    void executeInsert();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={showFullDayConfirm ? 'Confirmar Batida Adicional' : 'Inserir Ponto Manual'}
      maxWidth="lg"
    >
      {showFullDayConfirm ? (
        <div className="space-y-4">
          <div className="p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/80 rounded-xl flex items-start gap-3.5">
            <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1.5">
              <h4 className="text-sm font-bold text-amber-900 dark:text-amber-200">
                Dia com total de batidas já atingido
              </h4>
              <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
                O dia <strong>{formatDateBR(punchDate)}</strong> já possui{' '}
                <strong>{targetDay?.punchCount} batidas registradas</strong> (jornada completa) para{' '}
                <strong>{selectedEmployee?.name ?? 'o colaborador'}</strong>.
              </p>
              <p className="text-xs text-amber-700 dark:text-amber-300/90 leading-relaxed mt-1">
                Deseja realmente adicionar uma nova batida às <strong>{punchTime}</strong> neste
                dia?
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
              disabled={loading}
              onClick={() => setShowFullDayConfirm(false)}
              className="secondary-button text-sm px-4 py-2"
            >
              Voltar
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={() => void executeInsert()}
              className="inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors cursor-pointer shadow-xs whitespace-nowrap"
            >
              <span>{loading ? 'Salvando...' : 'Sim, Inserir Batida'}</span>
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-lg text-rose-700 dark:text-rose-300 text-sm">
              {error}
            </div>
          )}

          {employees.length === 1 ? (
            <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/80 dark:border-slate-700/60">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400 block mb-0.5">
                Colaborador
              </span>
              <span className="text-sm font-semibold text-slate-900 dark:text-white block truncate">
                {employees[0]?.name ?? ''}
              </span>
            </div>
          ) : (
            <div>
              <SelectInput
                id="manual-employee"
                label="Colaborador *"
                placeholder="Selecione um colaborador..."
                required
                value={employeeId}
                onChange={setEmployeeId}
                options={employees.map((emp) => ({
                  value: emp.id,
                  label: emp.name,
                  sublabel: emp.login,
                }))}
                searchable
                className="w-full"
              />
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label
                htmlFor="manual-date"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
              >
                Data da Batida *
              </label>
              <div className="relative">
                <input
                  id="manual-date"
                  type="date"
                  required
                  value={punchDate}
                  onChange={(e) => setPunchDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500 transition-colors"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="manual-time"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
              >
                Horário da Batida *
              </label>
              <div className="relative">
                <input
                  id="manual-time"
                  type="time"
                  required
                  step="60"
                  value={punchTime}
                  onChange={(e) => setPunchTime(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500 transition-colors"
                />
              </div>
            </div>
          </div>

          <span className="text-[11px] text-slate-500 block -mt-1">
            O tipo de batida (Entrada/Saída) é calculado automaticamente pela sequência cronológica
            do dia.
          </span>

          <div>
            <label
              htmlFor="manual-reason"
              className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
            >
              Justificativa Administrativa *
            </label>
            <textarea
              id="manual-reason"
              required
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ex.: Funcionário esqueceu de registrar o ponto no início da jornada."
              className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500 resize-none transition-colors"
            />
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-200/80 dark:border-slate-800">
            <button
              type="button"
              disabled={loading}
              onClick={onClose}
              className="secondary-button text-sm px-4 py-2"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="primary-button text-sm px-5 py-2 whitespace-nowrap"
            >
              {loading ? 'Salvando...' : 'Inserir Ponto'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
