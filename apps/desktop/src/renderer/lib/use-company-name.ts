import { useQuery } from '@tanstack/react-query';
import { COMPANY_NAME } from '@ph-ponto/shared';

import { useApiClient } from '../auth/use-auth.js';

/**
 * Trade name saved in Minha Empresa; the brand's company name until it is filled in (or when
 * the profile cannot be read). Shares the cache with the other screens that load the company.
 */
export function useCompanyName(): string {
  const api = useApiClient();
  const company = useQuery({
    queryKey: ['company-data'],
    queryFn: ({ signal }) => api.getCompany(signal),
    staleTime: 5 * 60_000,
  });
  return company.data?.tradeName?.trim() || COMPANY_NAME;
}
