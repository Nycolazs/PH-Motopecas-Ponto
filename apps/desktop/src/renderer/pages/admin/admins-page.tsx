import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Edit2, KeyRound, Plus, Power, RefreshCw, Search, ShieldCheck } from 'lucide-react';

import { useApiClient, useAuth } from '../../auth/use-auth.js';
import type { ManagedUser } from '../../api/contracts.js';
import { AvatarImage } from '../../components/avatar-image.js';
import { Modal } from '../../components/modal.js';
import { Pagination } from '../../components/pagination.js';
import { StatusBadge } from '../../components/status-badge.js';
import { useToast } from '../../components/toast-context.js';
import { formatDateBR } from '../../lib/format.js';

export function AdminUsersPage(): React.JSX.Element {
  const api = useApiClient();
  const { session } = useAuth();
  const toast = useToast();

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  // Modals state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editUser, setEditUser] = useState<ManagedUser | null>(null);
  const [passwordUser, setPasswordUser] = useState<ManagedUser | null>(null);

  // Form states
  const [formName, setFormName] = useState('');
  const [formLogin, setFormLogin] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [formLoading, setFormLoading] = useState(false);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['admin-users-list', search, page],
    queryFn: () =>
      api.getAdmins({
        ...(search.trim() ? { search: search.trim() } : {}),
        page,
        limit: 10,
      }),
  });

  const activeAdminsCount = data?.items.filter((u: ManagedUser) => u.isActive).length ?? 0;

  const handleOpenCreate = (): void => {
    setFormName('');
    setFormLogin('');
    setFormPassword('');
    setFormError(null);
    setCreateModalOpen(true);
  };

  const handleCreateSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (formPassword.trim().length < 8) {
      setFormError('A senha inicial deve conter no mínimo 8 caracteres.');
      return;
    }
    try {
      setFormLoading(true);
      setFormError(null);
      await api.createAdmin({
        name: formName.trim(),
        login: formLogin.trim(),
        password: formPassword.trim(),
      });
      setCreateModalOpen(false);
      toast.success('Administrador cadastrado com sucesso!');
      void refetch();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Falha ao criar conta de administrador.');
    } finally {
      setFormLoading(false);
    }
  };

  const handleOpenEdit = (user: ManagedUser): void => {
    setEditUser(user);
    setFormName(user.name);
    setFormLogin(user.login);
    setFormError(null);
  };

  const handleEditSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (!editUser) return;
    try {
      setFormLoading(true);
      setFormError(null);
      await api.updateAdmin(editUser.id, {
        name: formName.trim(),
        login: formLogin.trim(),
      });
      setEditUser(null);
      toast.success('Dados do administrador atualizados!');
      void refetch();
    } catch (err: unknown) {
      setFormError(
        err instanceof Error ? err.message : 'Falha ao atualizar dados do administrador.',
      );
    } finally {
      setFormLoading(false);
    }
  };

  const handleToggleStatus = async (user: ManagedUser): Promise<void> => {
    if (user.isActive && activeAdminsCount <= 1) {
      toast.error('Não é possível desativar o último administrador ativo do sistema.');
      return;
    }

    const action = user.isActive ? 'desativar' : 'ativar';
    if (!confirm(`Deseja realmente ${action} o administrador ${user.name}?`)) return;

    try {
      await api.updateAdminStatus(user.id, !user.isActive);
      toast.success(`Administrador ${user.isActive ? 'desativado' : 'ativado'} com sucesso!`);
      void refetch();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : `Falha ao ${action} administrador.`);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (!passwordUser) return;
    if (formPassword.trim().length < 8) {
      setFormError('A nova senha deve conter no mínimo 8 caracteres.');
      return;
    }
    try {
      setFormLoading(true);
      setFormError(null);
      await api.resetAdminPassword(passwordUser.id, formPassword.trim());
      setPasswordUser(null);
      toast.success('Senha do administrador redefinida com sucesso!');
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Falha ao redefinir a senha.');
    } finally {
      setFormLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center">
            <ShieldCheck className="w-5 h-5 mr-2 text-blue-600" /> Contas de Administrador
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Gerencie os acessos com privilégios administrativos ao sistema PH-Ponto
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenCreate}
          className="primary-button text-xs py-2 px-4 shrink-0"
        >
          <Plus className="w-4 h-4 mr-1.5" />
          Novo Administrador
        </button>
      </div>

      {/* Search Bar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por nome ou login do administrador..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Admin Users Table */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
        {isLoading && (
          <div className="p-12 flex flex-col items-center justify-center space-y-3 text-slate-500">
            <RefreshCw className="w-6 h-6 animate-spin text-blue-600" />
            <p className="text-sm font-medium">Carregando administradores...</p>
          </div>
        )}

        {error && (
          <div className="p-6 text-center text-rose-600 text-sm">
            Falha ao carregar administradores. Tente novamente.
          </div>
        )}

        {data && (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-3.5 px-4">Administrador</th>
                    <th className="py-3.5 px-4">Login</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4">Criado em</th>
                    <th className="py-3.5 px-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {data.items.map((admin: ManagedUser) => {
                    const isSelf = session?.user.id === admin.id;
                    const isLastActive = admin.isActive && activeAdminsCount <= 1;

                    return (
                      <tr
                        key={admin.id}
                        className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                      >
                        <td className="py-3.5 px-4">
                          <div className="flex items-center space-x-3">
                            <AvatarImage
                              userId={admin.id}
                              name={admin.name}
                              hasAvatar={admin.hasAvatar}
                              size="sm"
                            />
                            <div>
                              <div className="font-bold text-slate-900 dark:text-white flex items-center space-x-1.5">
                                <span>{admin.name}</span>
                                {isSelf && (
                                  <span className="text-[10px] bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 font-semibold px-1.5 py-0.2 rounded-sm">
                                    Você
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-slate-500">
                                ID: {admin.id.substring(0, 8)}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 font-mono text-xs text-slate-700 dark:text-slate-300">
                          {admin.login}
                        </td>
                        <td className="py-3.5 px-4">
                          <StatusBadge isActive={admin.isActive} />
                        </td>
                        <td className="py-3.5 px-4 text-xs text-slate-500">
                          {formatDateBR(admin.createdAt)}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end space-x-2">
                            <button
                              type="button"
                              onClick={() => handleOpenEdit(admin)}
                              title="Editar dados"
                              aria-label="Editar"
                              className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setPasswordUser(admin);
                                setFormPassword('');
                                setFormError(null);
                              }}
                              title="Redefinir senha"
                              aria-label="Redefinir senha"
                              className="p-1.5 text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40 rounded-md transition-colors"
                            >
                              <KeyRound className="w-4 h-4" />
                            </button>

                            <button
                              type="button"
                              disabled={isLastActive}
                              onClick={() => void handleToggleStatus(admin)}
                              title={
                                isLastActive
                                  ? 'O último administrador ativo não pode ser desativado.'
                                  : admin.isActive
                                    ? 'Desativar administrador'
                                    : 'Ativar administrador'
                              }
                              aria-label={admin.isActive ? 'Desativar' : 'Ativar'}
                              className={`p-1.5 rounded-md transition-colors ${
                                isLastActive
                                  ? 'opacity-30 cursor-not-allowed text-slate-400'
                                  : admin.isActive
                                    ? 'text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40'
                                    : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40'
                              }`}
                            >
                              <Power className="w-4 h-4" />
                            </button>
                          </div>
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

      {/* Create Admin Modal */}
      <Modal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="Cadastrar Novo Administrador"
      >
        <form onSubmit={(e) => void handleCreateSubmit(e)} className="space-y-4">
          {formError && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-lg text-rose-700 dark:text-rose-300 text-sm">
              {formError}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Nome Completo *
            </label>
            <input
              type="text"
              required
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="Ex.: Carlos Souza"
              className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Login *
            </label>
            <input
              type="text"
              required
              value={formLogin}
              onChange={(e) => setFormLogin(e.target.value.toLowerCase())}
              placeholder="Ex.: carlos.admin"
              className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white text-sm font-mono focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Senha Inicial *
            </label>
            <input
              type="password"
              required
              minLength={8}
              value={formPassword}
              onChange={(e) => setFormPassword(e.target.value)}
              placeholder="Mínimo 8 caracteres"
              className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            />
            <span className="text-[11px] text-slate-500 mt-1 block">
              A senha inicial deve conter no mínimo 8 caracteres.
            </span>
          </div>

          <div className="flex justify-end space-x-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              disabled={formLoading}
              onClick={() => setCreateModalOpen(false)}
              className="secondary-button text-sm px-4 py-2"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={formLoading}
              className="primary-button text-sm px-5 py-2"
            >
              {formLoading ? 'Salvando...' : 'Cadastrar Admin'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Admin Modal */}
      {editUser && (
        <Modal
          isOpen={true}
          onClose={() => setEditUser(null)}
          title={`Editar Administrador — ${editUser.name}`}
        >
          <form onSubmit={(e) => void handleEditSubmit(e)} className="space-y-4">
            {formError && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-lg text-rose-700 dark:text-rose-300 text-sm">
                {formError}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Nome Completo *
              </label>
              <input
                type="text"
                required
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Login *
              </label>
              <input
                type="text"
                required
                value={formLogin}
                onChange={(e) => setFormLogin(e.target.value.toLowerCase())}
                className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white text-sm font-mono focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex justify-end space-x-3 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                disabled={formLoading}
                onClick={() => setEditUser(null)}
                className="secondary-button text-sm px-4 py-2"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={formLoading}
                className="primary-button text-sm px-5 py-2"
              >
                {formLoading ? 'Salvando...' : 'Salvar Alterações'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Reset Password Modal */}
      {passwordUser && (
        <Modal
          isOpen={true}
          onClose={() => setPasswordUser(null)}
          title={`Redefinir Senha do Admin — ${passwordUser.name}`}
        >
          <form onSubmit={(e) => void handlePasswordSubmit(e)} className="space-y-4">
            {formError && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-lg text-rose-700 dark:text-rose-300 text-sm">
                {formError}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Nova Senha *
              </label>
              <input
                type="password"
                required
                minLength={8}
                value={formPassword}
                onChange={(e) => setFormPassword(e.target.value)}
                placeholder="Mínimo 8 caracteres"
                className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-[11px] text-slate-500 mt-1 block">
                A nova senha deve conter no mínimo 8 caracteres.
              </span>
            </div>

            <div className="flex justify-end space-x-3 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                disabled={formLoading}
                onClick={() => setPasswordUser(null)}
                className="secondary-button text-sm px-4 py-2"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={formLoading}
                className="primary-button text-sm px-5 py-2"
              >
                {formLoading ? 'Salvando...' : 'Confirmar Senha'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
