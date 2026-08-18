import { useEffect, useState } from 'react';
import { useApiClient } from '../auth/use-auth.js';
import type { ManagedUser } from '../api/contracts.js';
import { Modal } from './modal.js';
import { SelectInput } from './select-input.js';

interface ManualPunchModalProps {
  isOpen: boolean;
  onClose: () => void;
  employees: Array<Pick<ManagedUser, 'id' | 'name' | 'login'>>;
  initialEmployeeId?: string;
  onSuccess: () => void;
}

export function ManualPunchModal({
  isOpen,
  onClose,
  employees,
  initialEmployeeId,
  onSuccess,
}: ManualPunchModalProps): React.JSX.Element {
  const api = useApiClient();
  const [employeeId, setEmployeeId] = useState('');
  const [occurredAt, setOccurredAt] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
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
      setOccurredAt(`${year}-${month}-${day}T${hours}:${minutes}`);
      setReason('');
      setError(null);
    }
  }, [isOpen, initialEmployeeId, employees]);

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (!employeeId) {
      setError('Selecione o funcionário.');
      return;
    }
    if (!occurredAt) {
      setError('Informe a data e horário da batida.');
      return;
    }
    if (!reason.trim()) {
      setError('A justificativa administrativa é obrigatória.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const isoDate = new Date(occurredAt).toISOString();
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
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Inserir Ponto Manual" maxWidth="md">
      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
        {error && (
          <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-lg text-rose-700 dark:text-rose-300 text-sm">
            {error}
          </div>
        )}

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

        <div>
          <label
            htmlFor="manual-occurred-at"
            className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
          >
            Data e Horário da Batida *
          </label>
          <input
            id="manual-occurred-at"
            type="datetime-local"
            required
            value={occurredAt}
            onChange={(e) => setOccurredAt(e.target.value)}
            className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500"
          />
          <span className="text-[11px] text-slate-500 mt-1 block">
            O tipo de batida (Entrada/Saída) é calculado automaticamente pela sequência cronológica
            do dia.
          </span>
        </div>

        <div>
          <label
            htmlFor="manual-reason"
            className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
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
            className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex justify-end space-x-3 pt-3 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            disabled={loading}
            onClick={onClose}
            className="secondary-button text-sm px-4 py-2"
          >
            Cancelar
          </button>
          <button type="submit" disabled={loading} className="primary-button text-sm px-5 py-2">
            {loading ? 'Salvando...' : 'Inserir Ponto'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
