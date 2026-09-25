import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, Briefcase, History, Plus, RefreshCw, Search, Users, X } from 'lucide-react';
import { useForm } from 'react-hook-form';

import { useAuth } from '../../auth/use-auth.js';
import type {
  CreateJobRoleDto,
  CreateJobRoleVersionDto,
  JobRoleDto,
  JobRoleVersionDto,
} from '../../api/contracts.js';

export function JobRolesPage(): React.JSX.Element {
  const { api } = useAuth();
  const queryClient = useQueryClient();

  const [searchTerm, setSearchTerm] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedRoleForVersions, setSelectedRoleForVersions] = useState<JobRoleDto | null>(null);
  const [isPublishVersionModalOpen, setIsPublishVersionModalOpen] = useState(false);

  const {
    data: roles = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ['job-roles-list'],
    queryFn: ({ signal }) => api.getJobRoles(true, signal),
  });

  const filteredRoles = roles.filter(
    (role) =>
      role.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (role.department && role.department.toLowerCase().includes(searchTerm.toLowerCase())),
  );

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2.5">
            <Briefcase className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            <span>Cargos e Funções</span>
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Defina a estrutura organizacional, atribuições e versões imutáveis para cada cargo
          </p>
        </div>

        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 shadow-xs transition-colors self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Novo Cargo</span>
        </button>
      </div>

      {/* Filter / Search Bar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <input
            type="text"
            placeholder="Buscar por cargo ou setor..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 outline-hidden"
          />
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
        </div>
      </div>

      {/* Roles List */}
      {isLoading ? (
        <div className="py-16 flex justify-center items-center text-slate-400">
          <RefreshCw className="w-6 h-6 animate-spin mr-2" />
          <span>Carregando cargos cadastrados...</span>
        </div>
      ) : error ? (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>Não foi possível carregar os cargos. Tente novamente.</span>
        </div>
      ) : filteredRoles.length === 0 ? (
        <div className="py-16 text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8">
          <Briefcase className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            Nenhum cargo encontrado
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
            {searchTerm
              ? 'Nenhum resultado corresponde à sua pesquisa.'
              : 'Cadastre os cargos da empresa para vincular aos colaboradores e gerar termos de ciência.'}
          </p>
          {!searchTerm ? (
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-sm text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Cadastrar primeiro cargo</span>
            </button>
          ) : null}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredRoles.map((role) => (
            <div
              key={role.id}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex flex-col justify-between hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white leading-tight">
                      {role.title}
                    </h3>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Setor: {role.department || 'Não informado'}
                    </div>
                  </div>
                  <span
                    className={`text-2xs font-semibold uppercase px-2 py-0.5 rounded-full ${
                      role.isActive
                        ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    {role.isActive ? 'Ativo' : 'Inativo'}
                  </span>
                </div>

                {role.currentVersion ? (
                  <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
                    {role.currentVersion.cbo ? (
                      <div className="text-slate-500 dark:text-slate-400 font-mono">
                        CBO: {role.currentVersion.cbo}
                      </div>
                    ) : null}
                    <p className="text-slate-600 dark:text-slate-300 line-clamp-2">
                      {role.currentVersion.description}
                    </p>
                  </div>
                ) : null}
              </div>

              <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                <div className="flex items-center gap-3 text-slate-500 dark:text-slate-400">
                  <span className="flex items-center gap-1 font-medium">
                    <Users className="w-3.5 h-3.5" />
                    {role.activeEmployeesCount ?? 0}
                  </span>
                  <span className="flex items-center gap-1 font-medium">
                    <History className="w-3.5 h-3.5" />v{role.currentVersion?.versionNumber ?? 1}
                  </span>
                </div>

                <button
                  onClick={() => setSelectedRoleForVersions(role)}
                  className="font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Ver Detalhes
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal: Criar Cargo */}
      {isCreateModalOpen ? (
        <CreateJobRoleModal
          onClose={() => setIsCreateModalOpen(false)}
          onSuccess={() => {
            setIsCreateModalOpen(false);
            void queryClient.invalidateQueries({ queryKey: ['job-roles-list'] });
            void queryClient.invalidateQueries({ queryKey: ['company-setup-status'] });
          }}
        />
      ) : null}

      {/* Modal: Detalhes do Cargo e Histórico de Versões */}
      {selectedRoleForVersions ? (
        <JobRoleDetailModal
          roleId={selectedRoleForVersions.id}
          onClose={() => setSelectedRoleForVersions(null)}
          onPublishNewVersion={() => {
            setIsPublishVersionModalOpen(true);
          }}
        />
      ) : null}

      {/* Modal: Publicar Nova Versão */}
      {isPublishVersionModalOpen && selectedRoleForVersions ? (
        <PublishVersionModal
          roleId={selectedRoleForVersions.id}
          currentTitle={selectedRoleForVersions.title}
          onClose={() => setIsPublishVersionModalOpen(false)}
          onSuccess={() => {
            setIsPublishVersionModalOpen(false);
            void queryClient.invalidateQueries({ queryKey: ['job-roles-list'] });
            void queryClient.invalidateQueries({
              queryKey: ['job-role-detail', selectedRoleForVersions.id],
            });
          }}
        />
      ) : null}
    </div>
  );
}

// Modal Criar Cargo
function CreateJobRoleModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}): React.JSX.Element {
  const { api } = useAuth();
  const [respInput, setRespInput] = useState('');
  const [responsibilities, setResponsibilities] = useState<string[]>([]);
  const [reqInput, setReqInput] = useState('');
  const [requirements, setRequirements] = useState<string[]>([]);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateJobRoleDto>();

  const createMutation = useMutation({
    mutationFn: (data: CreateJobRoleDto) => api.createJobRole(data),
    onSuccess,
  });

  const onSubmit = (data: CreateJobRoleDto): void => {
    createMutation.mutate({
      ...data,
      responsibilities,
      requirements,
    });
  };

  const addResp = (): void => {
    if (respInput.trim()) {
      setResponsibilities([...responsibilities, respInput.trim()]);
      setRespInput('');
    }
  };

  const addReq = (): void => {
    if (reqInput.trim()) {
      setRequirements([...requirements, reqInput.trim()]);
      setReqInput('');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-2xs flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto shadow-2xl p-6 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Briefcase className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <span>Cadastrar Novo Cargo</span>
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {createMutation.isError ? (
          <div className="p-3 rounded-lg bg-rose-50 text-rose-700 text-xs">
            {createMutation.error instanceof Error
              ? createMutation.error.message
              : 'Erro ao cadastrar cargo.'}
          </div>
        ) : null}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1 sm:col-span-2">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Título do Cargo *
              </label>
              <input
                {...register('title', { required: 'Título é obrigatório' })}
                type="text"
                placeholder="Ex: Mecânico de Motos"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-blue-500 outline-hidden"
              />
              {errors.title ? (
                <p className="text-xs text-rose-600">{errors.title.message}</p>
              ) : null}
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Departamento / Setor
              </label>
              <input
                {...register('department')}
                type="text"
                placeholder="Ex: Oficina"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-blue-500 outline-hidden"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Código CBO
              </label>
              <input
                {...register('cbo')}
                type="text"
                placeholder="Ex: 9144-05"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-blue-500 outline-hidden"
              />
            </div>

            <div className="space-y-1 sm:col-span-2">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Descrição Sumária das Atribuições *
              </label>
              <textarea
                {...register('description', { required: 'Descrição é obrigatória' })}
                rows={3}
                placeholder="Descreva as funções básicas do cargo..."
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-blue-500 outline-hidden"
              />
              {errors.description ? (
                <p className="text-xs text-rose-600">{errors.description.message}</p>
              ) : null}
            </div>

            {/* Responsabilidades */}
            <div className="space-y-2 sm:col-span-2">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Responsabilidades Principais
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Adicionar responsabilidade..."
                  value={respInput}
                  onChange={(e) => setRespInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addResp();
                    }
                  }}
                  className="flex-1 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm outline-hidden"
                />
                <button
                  type="button"
                  onClick={addResp}
                  className="px-3 py-1.5 rounded-lg bg-slate-200 dark:bg-slate-700 text-xs font-semibold"
                >
                  Adicionar
                </button>
              </div>
              {responsibilities.length > 0 ? (
                <ul className="space-y-1 max-h-24 overflow-y-auto pt-1">
                  {responsibilities.map((r, i) => (
                    <li
                      key={i}
                      className="text-xs flex items-center justify-between bg-slate-50 dark:bg-slate-800 px-2.5 py-1 rounded-md"
                    >
                      <span>• {r}</span>
                      <button
                        type="button"
                        onClick={() =>
                          setResponsibilities(responsibilities.filter((_, idx) => idx !== i))
                        }
                        className="text-rose-500 hover:text-rose-700 font-bold ml-2"
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>

            {/* Requisitos */}
            <div className="space-y-2 sm:col-span-2">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Requisitos / Formação
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Adicionar requisito..."
                  value={reqInput}
                  onChange={(e) => setReqInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addReq();
                    }
                  }}
                  className="flex-1 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm outline-hidden"
                />
                <button
                  type="button"
                  onClick={addReq}
                  className="px-3 py-1.5 rounded-lg bg-slate-200 dark:bg-slate-700 text-xs font-semibold"
                >
                  Adicionar
                </button>
              </div>
              {requirements.length > 0 ? (
                <ul className="space-y-1 max-h-24 overflow-y-auto pt-1">
                  {requirements.map((r, i) => (
                    <li
                      key={i}
                      className="text-xs flex items-center justify-between bg-slate-50 dark:bg-slate-800 px-2.5 py-1 rounded-md"
                    >
                      <span>• {r}</span>
                      <button
                        type="button"
                        onClick={() => setRequirements(requirements.filter((_, idx) => idx !== i))}
                        className="text-rose-500 hover:text-rose-700 font-bold ml-2"
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm text-slate-600 hover:bg-slate-100"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="px-5 py-2 rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
            >
              {createMutation.isPending ? 'Salvando...' : 'Salvar Cargo'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Modal Detalhes do Cargo e Versões
function JobRoleDetailModal({
  roleId,
  onClose,
  onPublishNewVersion,
}: {
  roleId: string;
  onClose: () => void;
  onPublishNewVersion: () => void;
}): React.JSX.Element {
  const { api } = useAuth();
  const { data: role, isLoading } = useQuery({
    queryKey: ['job-role-detail', roleId],
    queryFn: ({ signal }) => api.getJobRole(roleId, signal),
  });

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-2xs flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl p-6 space-y-5">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              {role?.title ?? 'Detalhes do Cargo'}
            </h2>
            <div className="text-xs text-slate-500">
              Setor: {role?.department ?? 'Geral'} • {role?.activeEmployeesCount ?? 0} colaboradores
              ativos
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {isLoading ? (
          <div className="py-12 flex justify-center text-slate-400">
            <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Carregando versões...
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                Histórico de Versões Imutáveis
              </h3>
              <button
                onClick={onPublishNewVersion}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-purple-600 hover:bg-purple-700 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> Publicar Nova Versão
              </button>
            </div>

            <div className="space-y-4">
              {role?.versions?.map((version: JobRoleVersionDto, index: number) => (
                <div
                  key={version.id}
                  className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 dark:bg-blue-900/60 text-blue-800 dark:text-blue-300">
                      Versão {version.versionNumber} {index === 0 ? '(Vigente)' : ''}
                    </span>
                    <span className="text-xs text-slate-400">
                      Publicado em {new Date(version.publishedAt).toLocaleDateString('pt-BR')}
                    </span>
                  </div>

                  <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-sans">
                    {version.description}
                  </p>

                  {version.responsibilities?.length > 0 ? (
                    <div className="pt-2 text-xs">
                      <strong className="text-slate-700 dark:text-slate-300">
                        Responsabilidades:
                      </strong>
                      <ul className="list-disc list-inside mt-1 space-y-0.5 text-slate-600 dark:text-slate-400 pl-1">
                        {version.responsibilities.map((r: string, i: number) => (
                          <li key={i}>{r}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {version.requirements?.length > 0 ? (
                    <div className="pt-1 text-xs">
                      <strong className="text-slate-700 dark:text-slate-300">Requisitos:</strong>
                      <ul className="list-disc list-inside mt-1 space-y-0.5 text-slate-600 dark:text-slate-400 pl-1">
                        {version.requirements.map((r: string, i: number) => (
                          <li key={i}>{r}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Modal Publicar Nova Versão
function PublishVersionModal({
  roleId,
  currentTitle,
  onClose,
  onSuccess,
}: {
  roleId: string;
  currentTitle: string;
  onClose: () => void;
  onSuccess: () => void;
}): React.JSX.Element {
  const { api } = useAuth();
  const [respInput, setRespInput] = useState('');
  const [responsibilities, setResponsibilities] = useState<string[]>([]);
  const [reqInput, setReqInput] = useState('');
  const [requirements, setRequirements] = useState<string[]>([]);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateJobRoleVersionDto>();

  const publishMutation = useMutation({
    mutationFn: (data: CreateJobRoleVersionDto) => api.publishJobRoleVersion(roleId, data),
    onSuccess,
  });

  const onSubmit = (data: CreateJobRoleVersionDto): void => {
    publishMutation.mutate({
      ...data,
      responsibilities,
      requirements,
    });
  };

  const addResp = (): void => {
    if (respInput.trim()) {
      setResponsibilities([...responsibilities, respInput.trim()]);
      setRespInput('');
    }
  };

  const addReq = (): void => {
    if (reqInput.trim()) {
      setRequirements([...requirements, reqInput.trim()]);
      setReqInput('');
    }
  };

  return (
    <div className="fixed inset-0 z-60 bg-slate-950/70 backdrop-blur-2xs flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto shadow-2xl p-6 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              Publicar Nova Versão
            </h2>
            <div className="text-xs text-slate-500">Cargo: {currentTitle}</div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Código CBO (opcional)
              </label>
              <input
                {...register('cbo')}
                type="text"
                placeholder="Ex: 9144-05"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm outline-hidden"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Descrição Atualizada das Atribuições *
              </label>
              <textarea
                {...register('description', { required: 'Descrição é obrigatória' })}
                rows={3}
                placeholder="Descreva as novas funções e responsabilidades atualizadas..."
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm outline-hidden"
              />
              {errors.description ? (
                <p className="text-xs text-rose-600">{errors.description.message}</p>
              ) : null}
            </div>

            {/* Responsabilidades */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Responsabilidades Principais
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Adicionar..."
                  value={respInput}
                  onChange={(e) => setRespInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addResp();
                    }
                  }}
                  className="flex-1 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm outline-hidden"
                />
                <button
                  type="button"
                  onClick={addResp}
                  className="px-3 py-1.5 rounded-lg bg-slate-200 dark:bg-slate-700 text-xs font-semibold"
                >
                  Adicionar
                </button>
              </div>
              {responsibilities.length > 0 ? (
                <ul className="space-y-1 max-h-24 overflow-y-auto pt-1">
                  {responsibilities.map((r, i) => (
                    <li
                      key={i}
                      className="text-xs flex items-center justify-between bg-slate-50 dark:bg-slate-800 px-2.5 py-1 rounded-md"
                    >
                      <span>• {r}</span>
                      <button
                        type="button"
                        onClick={() =>
                          setResponsibilities(responsibilities.filter((_, idx) => idx !== i))
                        }
                        className="text-rose-500 hover:text-rose-700 font-bold ml-2"
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>

            {/* Requisitos */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Requisitos / Formação
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Adicionar..."
                  value={reqInput}
                  onChange={(e) => setReqInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addReq();
                    }
                  }}
                  className="flex-1 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm outline-hidden"
                />
                <button
                  type="button"
                  onClick={addReq}
                  className="px-3 py-1.5 rounded-lg bg-slate-200 dark:bg-slate-700 text-xs font-semibold"
                >
                  Adicionar
                </button>
              </div>
              {requirements.length > 0 ? (
                <ul className="space-y-1 max-h-24 overflow-y-auto pt-1">
                  {requirements.map((r, i) => (
                    <li
                      key={i}
                      className="text-xs flex items-center justify-between bg-slate-50 dark:bg-slate-800 px-2.5 py-1 rounded-md"
                    >
                      <span>• {r}</span>
                      <button
                        type="button"
                        onClick={() => setRequirements(requirements.filter((_, idx) => idx !== i))}
                        className="text-rose-500 hover:text-rose-700 font-bold ml-2"
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm text-slate-600 hover:bg-slate-100"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={publishMutation.isPending}
              className="px-5 py-2 rounded-lg text-sm font-semibold text-white bg-purple-600 hover:bg-purple-700 disabled:opacity-50"
            >
              {publishMutation.isPending ? 'Publicando...' : 'Publicar Versão'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
