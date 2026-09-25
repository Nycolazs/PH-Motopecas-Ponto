import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  Mail,
  MapPin,
  Phone,
  RefreshCw,
  Save,
  User,
} from 'lucide-react';
import { useForm } from 'react-hook-form';

import { useAuth } from '../../auth/use-auth.js';
import type { UpdateCompanyDto } from '../../api/contracts.js';

export function CompanyPage(): React.JSX.Element {
  const { api } = useAuth();
  const queryClient = useQueryClient();
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const {
    data: company,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['company-data'],
    queryFn: ({ signal }) => api.getCompany(signal),
  });

  const defaultValues: UpdateCompanyDto = {
    legalName: company?.legalName ?? '',
    tradeName: company?.tradeName ?? '',
    cnpj: company?.cnpj ?? '',
    stateRegistration: company?.stateRegistration ?? '',
    email: company?.email ?? '',
    phone: company?.phone ?? '',
    addressStreet: company?.addressStreet ?? '',
    addressNumber: company?.addressNumber ?? '',
    addressComplement: company?.addressComplement ?? '',
    addressNeighborhood: company?.addressNeighborhood ?? '',
    addressCity: company?.addressCity ?? '',
    addressState: company?.addressState ?? '',
    addressPostalCode: company?.addressPostalCode ?? '',
    primaryContactName: company?.primaryContactName ?? '',
  };

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<UpdateCompanyDto>({
    values: defaultValues,
  });

  const updateMutation = useMutation({
    mutationFn: (data: UpdateCompanyDto) => api.updateCompany(data),
    onSuccess: (updated) => {
      queryClient.setQueryData(['company-data'], updated);
      void queryClient.invalidateQueries({ queryKey: ['company-setup-status'] });
      setSuccessMessage('Dados cadastrais da empresa salvos com sucesso.');
      setTimeout(() => setSuccessMessage(null), 4000);
      reset(updated as unknown as UpdateCompanyDto);
    },
  });

  const onSubmit = (data: UpdateCompanyDto): void => {
    setSuccessMessage(null);
    updateMutation.mutate(data);
  };

  if (isLoading) {
    return (
      <div className="p-8 flex justify-center items-center text-slate-400">
        <RefreshCw className="w-6 h-6 animate-spin mr-2" />
        <span>Carregando dados da empresa...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>Não foi possível carregar os dados da empresa. Tente novamente mais tarde.</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2.5">
            <Building2 className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            <span>Dados da Empresa</span>
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Informações cadastrais e endereço oficial utilizados em documentos e relatórios
          </p>
        </div>

        {company?.updatedAt ? (
          <span className="text-xs text-slate-400 dark:text-slate-500 self-start sm:self-auto">
            Última atualização: {new Date(company.updatedAt).toLocaleDateString('pt-BR')}
          </span>
        ) : null}
      </div>

      {successMessage ? (
        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 flex items-center gap-3 animate-in fade-in duration-300">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span className="text-sm font-medium">{successMessage}</span>
        </div>
      ) : null}

      {updateMutation.isError ? (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0" />
          <span className="text-sm font-medium">
            {updateMutation.error instanceof Error
              ? updateMutation.error.message
              : 'Ocorreu um erro ao salvar os dados da empresa.'}
          </span>
        </div>
      ) : null}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Identificação */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs space-y-4">
          <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Building2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span>Identificação Cadastral</span>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1 sm:col-span-2">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Razão Social <span className="text-rose-500">*</span>
              </label>
              <input
                {...register('legalName', { required: 'Razão Social é obrigatória' })}
                type="text"
                placeholder="Ex: PH MOTOPECAS LTDA"
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 outline-hidden"
              />
              {errors.legalName ? (
                <p className="text-xs text-rose-600">{errors.legalName.message}</p>
              ) : null}
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Nome Fantasia <span className="text-rose-500">*</span>
              </label>
              <input
                {...register('tradeName', { required: 'Nome Fantasia é obrigatório' })}
                type="text"
                placeholder="Ex: PH Motopeças"
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 outline-hidden"
              />
              {errors.tradeName ? (
                <p className="text-xs text-rose-600">{errors.tradeName.message}</p>
              ) : null}
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                CNPJ <span className="text-rose-500">*</span>
              </label>
              <input
                {...register('cnpj', { required: 'CNPJ é obrigatório' })}
                type="text"
                placeholder="00.000.000/0001-00"
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm font-mono focus:ring-2 focus:ring-blue-500 outline-hidden"
              />
              {errors.cnpj ? <p className="text-xs text-rose-600">{errors.cnpj.message}</p> : null}
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Inscrição Estadual
              </label>
              <input
                {...register('stateRegistration')}
                type="text"
                placeholder="Isento ou número"
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 outline-hidden"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Contato Principal / Administrador
              </label>
              <div className="relative">
                <input
                  {...register('primaryContactName')}
                  type="text"
                  placeholder="Nome do gestor responsável"
                  className="w-full pl-9 pr-3.5 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 outline-hidden"
                />
                <User className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              </div>
            </div>
          </div>
        </div>

        {/* Contato & Localização */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs space-y-4">
          <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <MapPin className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span>Endereço e Contato</span>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-1 sm:col-span-2">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Logradouro / Rua
              </label>
              <input
                {...register('addressStreet')}
                type="text"
                placeholder="Ex: Av. Principal"
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 outline-hidden"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Número
              </label>
              <input
                {...register('addressNumber')}
                type="text"
                placeholder="Ex: 123"
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 outline-hidden"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Complemento
              </label>
              <input
                {...register('addressComplement')}
                type="text"
                placeholder="Galpão, Sala..."
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 outline-hidden"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Bairro
              </label>
              <input
                {...register('addressNeighborhood')}
                type="text"
                placeholder="Ex: Centro"
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 outline-hidden"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Cidade
              </label>
              <input
                {...register('addressCity')}
                type="text"
                placeholder="Ex: Fortaleza"
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 outline-hidden"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                UF (Estado)
              </label>
              <input
                {...register('addressState')}
                type="text"
                maxLength={2}
                placeholder="CE"
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm uppercase focus:ring-2 focus:ring-blue-500 outline-hidden"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                CEP
              </label>
              <input
                {...register('addressPostalCode')}
                type="text"
                placeholder="60000-000"
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm font-mono focus:ring-2 focus:ring-blue-500 outline-hidden"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Telefone
              </label>
              <div className="relative">
                <input
                  {...register('phone')}
                  type="text"
                  placeholder="(85) 98888-7777"
                  className="w-full pl-9 pr-3.5 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 outline-hidden"
                />
                <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              </div>
            </div>

            <div className="space-y-1 sm:col-span-2 lg:col-span-2">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                E-mail Institucional
              </label>
              <div className="relative">
                <input
                  {...register('email')}
                  type="email"
                  placeholder="contato@phmotos.com.br"
                  className="w-full pl-9 pr-3.5 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 outline-hidden"
                />
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="submit"
            disabled={!isDirty || updateMutation.isPending}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed shadow-xs transition-colors"
          >
            {updateMutation.isPending ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            <span>Salvar Alterações</span>
          </button>
        </div>
      </form>
    </div>
  );
}
