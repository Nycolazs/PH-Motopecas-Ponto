import { useEffect, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  BadgeCheck,
  FileText,
  ImageIcon,
  Info,
  Loader2,
  Paperclip,
  Stethoscope,
  X,
} from 'lucide-react';

import { ApiClientError } from '../api/client.js';
import type { AbsenceJustificationKind } from '../api/contracts.js';
import { useApiClient } from '../auth/use-auth.js';
import {
  ATTACHMENT_ACCEPT,
  AttachmentFileError,
  formatFileSize,
  MAX_ATTACHMENTS_PER_CERTIFICATE,
  prepareAttachment,
  type PreparedAttachment,
} from '../lib/attachment-files.js';
import { formatDateBR, formatDisplayName } from '../lib/format.js';
import { DateInput } from './date-input.js';
import { Modal } from './modal.js';
import { useToast } from './toast-context.js';

/** Same limit as the API: longer leaves go through the INSS. */
export const MAX_MEDICAL_LEAVE_DAYS = 31;

export function addDaysToBusinessDate(date: string, days: number): string {
  const instant = new Date(`${date}T12:00:00Z`);
  instant.setUTCDate(instant.getUTCDate() + days);
  return instant.toISOString().slice(0, 10);
}

const OPTIONS: ReadonlyArray<{
  kind: AbsenceJustificationKind;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  {
    kind: 'ALLOWANCE',
    title: 'Abono',
    description: 'A empresa perdoa a falta de um dia.',
    icon: BadgeCheck,
  },
  {
    kind: 'MEDICAL_CERTIFICATE',
    title: 'Atestado médico',
    description: 'Afastamento com atestado, por um ou mais dias.',
    icon: Stethoscope,
  },
];

interface AbsenceJustificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  employee: { id: string; name: string };
  /** Day the administrator clicked; defaults to today. */
  initialDate?: string | undefined;
}

/**
 * Excuses an employee's absence. The missing hours stop counting against the balance;
 * hours actually worked on those days still count.
 */
export function AbsenceJustificationModal({
  isOpen,
  onClose,
  employee,
  initialDate,
}: AbsenceJustificationModalProps): React.JSX.Element | null {
  const api = useApiClient();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [kind, setKind] = useState<AbsenceJustificationKind>('ALLOWANCE');
  const [startDate, setStartDate] = useState(initialDate ?? '');
  const [days, setDays] = useState('1');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [files, setFiles] = useState<PreparedAttachment[]>([]);
  const [preparing, setPreparing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    setKind('ALLOWANCE');
    setStartDate(
      initialDate ?? new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }),
    );
    setDays('1');
    setReason('');
    setError(null);
    setFiles([]);
    setUploadProgress(null);
  }, [isOpen, initialDate]);

  const addFiles = async (selected: FileList | null): Promise<void> => {
    if (selected === null || selected.length === 0) return;
    const room = MAX_ATTACHMENTS_PER_CERTIFICATE - files.length;
    const chosen = Array.from(selected).slice(0, Math.max(0, room));
    setPreparing(true);
    setError(null);
    const prepared: PreparedAttachment[] = [];
    try {
      for (const file of chosen) prepared.push(await prepareAttachment(file));
      if (selected.length > room) {
        setError(`Cada atestado aceita até ${MAX_ATTACHMENTS_PER_CERTIFICATE} arquivos.`);
      }
    } catch (err) {
      setError(
        err instanceof AttachmentFileError ? err.message : 'Não foi possível ler o arquivo.',
      );
    } finally {
      setFiles((current) => [...current, ...prepared]);
      setPreparing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const dayCount = kind === 'ALLOWANCE' ? 1 : Number(days);
  const daysValid =
    Number.isInteger(dayCount) && dayCount >= 1 && dayCount <= MAX_MEDICAL_LEAVE_DAYS;
  const endDate = startDate && daysValid ? addDaysToBusinessDate(startDate, dayCount - 1) : '';
  const name = formatDisplayName(employee.name);

  const save = useMutation({
    mutationFn: async () => {
      const created = await api.createAbsenceJustification({
        employeeId: employee.id,
        kind,
        startDate,
        endDate,
        reason: reason.trim(),
      });
      // The atestado exists from here on: a failed file is reported, not a failed save.
      const failed: string[] = [];
      if (kind === 'MEDICAL_CERTIFICATE') {
        for (const [index, file] of files.entries()) {
          setUploadProgress(`Enviando arquivos (${index + 1}/${files.length})…`);
          try {
            await api.uploadJustificationAttachment(created.id, {
              fileName: file.fileName,
              dataBase64: file.dataBase64,
            });
          } catch (err) {
            failed.push(
              `${file.fileName}${err instanceof ApiClientError ? ` (${err.message})` : ''}`,
            );
          }
        }
      }
      return failed;
    },
    onSuccess: (failed) => {
      toast.success(
        kind === 'ALLOWANCE'
          ? `Dia ${formatDateBR(startDate)} abonado para ${name}.`
          : `Atestado de ${name} registrado${files.length > failed.length ? ' com o arquivo anexado' : ''}.`,
      );
      if (failed.length > 0) {
        toast.error(
          `Não foi possível enviar: ${failed.join(', ')}. Anexe de novo pelo quadro Abonos e atestados.`,
        );
      }
      // Days, months, reports and dashboards all change.
      void queryClient.invalidateQueries();
      onClose();
    },
    onError: (err) =>
      setError(err instanceof ApiClientError ? err.message : 'Não foi possível salvar.'),
    onSettled: () => setUploadProgress(null),
  });

  const submit = (): void => {
    if (!startDate) return setError('Escolha o dia.');
    if (!daysValid) {
      return setError(`Informe de 1 a ${MAX_MEDICAL_LEAVE_DAYS} dias de afastamento.`);
    }
    if (reason.trim().length < 3) return setError('Descreva o motivo.');
    setError(null);
    save.mutate();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Justificar falta — ${name}`} maxWidth="lg">
      <form
        className="space-y-5"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <fieldset>
          <legend className="mb-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
            Tipo de justificativa
          </legend>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {OPTIONS.map((option) => {
              const Icon = option.icon;
              const selected = kind === option.kind;
              return (
                <label
                  key={option.kind}
                  className={`flex cursor-pointer gap-3 rounded-xl border p-3 transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-blue-500 ${
                    selected
                      ? 'border-blue-500 bg-blue-50/60 dark:border-blue-500 dark:bg-blue-950/30'
                      : 'border-slate-200 hover:border-slate-300 dark:border-slate-700'
                  }`}
                >
                  <input
                    type="radio"
                    name="justification-kind"
                    value={option.kind}
                    checked={selected}
                    onChange={() => setKind(option.kind)}
                    className="sr-only"
                  />
                  <Icon
                    className={`mt-0.5 h-5 w-5 shrink-0 ${selected ? 'text-blue-600' : 'text-slate-400'}`}
                    aria-hidden="true"
                  />
                  <span>
                    <span className="block text-sm font-semibold text-slate-900 dark:text-white">
                      {option.title}
                    </span>
                    <span className="block text-xs text-slate-500 dark:text-slate-400">
                      {option.description}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>

        <div
          className={`grid gap-4 ${kind === 'ALLOWANCE' ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2'}`}
        >
          <DateInput
            label={kind === 'ALLOWANCE' ? 'Dia abonado' : 'Primeiro dia de afastamento'}
            labelPosition="top"
            required
            value={startDate}
            onChange={setStartDate}
            className="w-full"
          />
          {kind === 'MEDICAL_CERTIFICATE' && (
            <div>
              <label
                htmlFor="justification-days"
                className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300"
              >
                Dias de afastamento <span className="text-rose-500">*</span>
              </label>
              <input
                id="justification-days"
                type="number"
                inputMode="numeric"
                min={1}
                max={MAX_MEDICAL_LEAVE_DAYS}
                value={days}
                onChange={(event) => setDays(event.target.value)}
                className="h-[42px] w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
          )}
        </div>
        {kind === 'MEDICAL_CERTIFICATE' && startDate && daysValid && (
          <p className="-mt-2 text-xs text-slate-600 dark:text-slate-300">
            {dayCount === 1
              ? `Cobre o dia ${formatDateBR(startDate)}.`
              : `Cobre de ${formatDateBR(startDate)} a ${formatDateBR(endDate)} (${dayCount} dias).`}
          </p>
        )}

        <div>
          <label
            htmlFor="justification-reason"
            className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300"
          >
            {kind === 'ALLOWANCE' ? 'Motivo do abono' : 'Detalhes do atestado'}{' '}
            <span className="text-rose-500">*</span>
          </label>
          <textarea
            id="justification-reason"
            rows={3}
            maxLength={500}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder={
              kind === 'ALLOWANCE'
                ? 'Ex.: Liberado pela gerência para resolver assunto pessoal.'
                : 'Ex.: Atestado da Dra. Ana Souza, CRM 12345, consulta e repouso.'
            }
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          />
        </div>

        {kind === 'MEDICAL_CERTIFICATE' && (
          <div>
            <p className="mb-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
              Foto ou PDF do atestado{' '}
              <span className="font-normal text-slate-500">(opcional, até 5 arquivos)</span>
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept={ATTACHMENT_ACCEPT}
              multiple
              className="sr-only"
              aria-label="Escolher foto ou PDF do atestado"
              onChange={(event) => void addFiles(event.target.files)}
            />
            {files.length > 0 && (
              <ul className="mb-2 space-y-1.5">
                {files.map((file, index) => {
                  const Icon = file.isImage ? ImageIcon : FileText;
                  return (
                    <li
                      key={`${file.fileName}-${index}`}
                      className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs dark:border-slate-700"
                    >
                      <Icon className="h-4 w-4 shrink-0 text-sky-600" aria-hidden="true" />
                      <span className="min-w-0 flex-1 truncate font-medium text-slate-800 dark:text-slate-100">
                        {file.fileName}
                      </span>
                      <span className="shrink-0 text-slate-500">
                        {formatFileSize(file.byteSize)}
                      </span>
                      <button
                        type="button"
                        aria-label={`Remover ${file.fileName}`}
                        onClick={() => setFiles((current) => current.filter((_, i) => i !== index))}
                        className="rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-rose-600 dark:hover:bg-slate-800"
                      >
                        <X className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
            {files.length < MAX_ATTACHMENTS_PER_CERTIFICATE && (
              <button
                type="button"
                disabled={preparing}
                onClick={() => fileInputRef.current?.click()}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 px-3 py-3 text-xs font-semibold text-slate-600 hover:border-blue-400 hover:text-blue-700 disabled:opacity-60 dark:border-slate-700 dark:text-slate-300"
              >
                {preparing ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Paperclip className="h-4 w-4" aria-hidden="true" />
                )}
                {files.length === 0 ? 'Anexar foto ou PDF do atestado' : 'Anexar outro arquivo'}
              </button>
            )}
            <p className="mt-1 text-[11px] text-slate-500">
              Fica guardado no servidor, criptografado. Fotos grandes são reduzidas sem perder a
              leitura.
            </p>
          </div>
        )}

        <p className="flex gap-2 rounded-lg bg-slate-50 p-3 text-xs leading-relaxed text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" aria-hidden="true" />
          As horas que faltaram {kind === 'ALLOWANCE' ? 'neste dia' : 'nesses dias'} não serão
          descontadas do saldo. Se o colaborador trabalhou parte do dia, essas horas continuam
          contando normalmente.
        </p>

        {error && (
          <p role="alert" className="text-sm font-semibold text-rose-600 dark:text-rose-400">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={save.isPending || preparing}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {save.isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            {uploadProgress ?? (kind === 'ALLOWANCE' ? 'Abonar dia' : 'Registrar atestado')}
          </button>
        </div>
      </form>
    </Modal>
  );
}
