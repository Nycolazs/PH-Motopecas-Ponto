import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { AlertCircle, CheckCircle2, Eye, EyeOff, KeyRound, Lock } from 'lucide-react';

import { useAuth } from '../auth/use-auth.js';
import { Modal } from './modal.js';
import { useToast } from './toast-context.js';

interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ChangePasswordModal({
  isOpen,
  onClose,
}: ChangePasswordModalProps): React.JSX.Element | null {
  const { api } = useAuth();
  const { showToast } = useToast();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const resetForm = (): void => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setShowCurrent(false);
    setShowNew(false);
    setShowConfirm(false);
    setErrorMessage(null);
  };

  const handleClose = (): void => {
    resetForm();
    onClose();
  };

  const mutation = useMutation({
    mutationFn: async () => {
      if (!currentPassword) {
        throw new Error('Informe sua senha atual.');
      }
      if (!newPassword || newPassword.length < 8) {
        throw new Error('A nova senha deve ter no mínimo 8 caracteres.');
      }
      if (newPassword !== confirmPassword) {
        throw new Error('A confirmação da nova senha não confere.');
      }
      if (currentPassword === newPassword) {
        throw new Error('A nova senha deve ser diferente da senha atual.');
      }

      await api.changeOwnPassword({
        currentPassword,
        newPassword,
      });
    },
    onSuccess: () => {
      showToast(
        'success',
        'Sua nova senha já está ativa para os próximos acessos.',
        'Senha alterada com sucesso!',
      );
      handleClose();
    },
    onError: (error: unknown) => {
      const msg = error instanceof Error ? error.message : 'Não foi possível alterar a senha.';
      setErrorMessage(msg);
    },
  });

  const isMinLengthValid = newPassword.length >= 8;
  const isMatchValid = newPassword.length > 0 && newPassword === confirmPassword;

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Alterar Minha Senha" maxWidth="md">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setErrorMessage(null);
          mutation.mutate();
        }}
        className="space-y-4"
        noValidate
      >
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Para sua segurança, informe sua senha atual antes de cadastrar uma nova senha de acesso.
        </p>

        {errorMessage && (
          <div
            className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 rounded-lg flex items-start gap-2 text-sm text-rose-700 dark:text-rose-300"
            role="alert"
          >
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Senha Atual */}
        <div>
          <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Senha Atual
          </label>
          <div className="relative">
            <input
              type={showCurrent ? 'text' : 'password'}
              required
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Digite sua senha atual"
              className="w-full pl-10 pr-10 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm font-medium"
            />
            <KeyRound className="w-5 h-5 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
            <button
              type="button"
              tabIndex={-1}
              onClick={() => setShowCurrent((v) => !v)}
              className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
              aria-label={showCurrent ? 'Ocultar senha' : 'Exibir senha'}
            >
              {showCurrent ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Nova Senha */}
        <div>
          <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Nova Senha
          </label>
          <div className="relative">
            <input
              type={showNew ? 'text' : 'password'}
              required
              minLength={8}
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Mínimo de 8 caracteres"
              className="w-full pl-10 pr-10 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm font-medium"
            />
            <Lock className="w-5 h-5 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
            <button
              type="button"
              tabIndex={-1}
              onClick={() => setShowNew((v) => !v)}
              className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
              aria-label={showNew ? 'Ocultar nova senha' : 'Exibir nova senha'}
            >
              {showNew ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Confirmar Nova Senha */}
        <div>
          <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Confirmar Nova Senha
          </label>
          <div className="relative">
            <input
              type={showConfirm ? 'text' : 'password'}
              required
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repita a nova senha"
              className="w-full pl-10 pr-10 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm font-medium"
            />
            <Lock className="w-5 h-5 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
            <button
              type="button"
              tabIndex={-1}
              onClick={() => setShowConfirm((v) => !v)}
              className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
              aria-label={showConfirm ? 'Ocultar confirmação' : 'Exibir confirmação'}
            >
              {showConfirm ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Requisitos visuais */}
        <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-slate-700/60 text-xs space-y-1.5">
          <div
            className={`flex items-center gap-1.5 font-medium ${
              isMinLengthValid
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            <CheckCircle2
              className={`w-4 h-4 shrink-0 ${
                isMinLengthValid ? 'text-emerald-500' : 'text-slate-300 dark:text-slate-600'
              }`}
            />
            <span>Mínimo de 8 caracteres</span>
          </div>
          <div
            className={`flex items-center gap-1.5 font-medium ${
              isMatchValid
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            <CheckCircle2
              className={`w-4 h-4 shrink-0 ${
                isMatchValid ? 'text-emerald-500' : 'text-slate-300 dark:text-slate-600'
              }`}
            />
            <span>Senhas conferem</span>
          </div>
        </div>

        {/* Ações */}
        <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={handleClose}
            disabled={mutation.isPending}
            className="px-4 py-2 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-sm font-medium transition disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={mutation.isPending || !currentPassword || !isMinLengthValid || !isMatchValid}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-lg text-sm font-bold shadow-xs transition disabled:opacity-50 flex items-center gap-1.5"
          >
            {mutation.isPending ? 'Alterando…' : 'Salvar Nova Senha'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
