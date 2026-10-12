import { useContext } from 'react';

import { AuthContext } from '../auth/auth-types.js';
import type { HelpAudience } from './help-types.js';

export const HELP_ADMIN_BASE = '/admin/ajuda';
export const HELP_EMPLOYEE_BASE = '/ajuda';

/** Help center path and audience for whoever is signed in. */
export function useHelpContext(): { base: string; audience: HelpAudience } {
  // Read the context directly: screens rendered on their own (e.g. in tests) still work.
  const session = useContext(AuthContext)?.session ?? null;
  return session?.user.role === 'ADMIN'
    ? { base: HELP_ADMIN_BASE, audience: 'admin' }
    : { base: HELP_EMPLOYEE_BASE, audience: 'employee' };
}

export function helpArticlePath(base: string, slug: string, section?: string): string {
  return `${base}/${slug}${section ? `?secao=${encodeURIComponent(section)}` : ''}`;
}

/** Screen → article that explains it; the longest matching prefix wins. */
export const HELP_ROUTE_ARTICLES: ReadonlyArray<readonly [string, string]> = [
  ['/admin/gestao', 'painel-operacional'],
  ['/admin/pontos', 'registros-de-ponto'],
  ['/admin/solicitacoes', 'solicitacoes-de-ajuste'],
  ['/admin/incompletos', 'espelhos-incompletos'],
  ['/admin/funcionarios/', 'ficha-do-colaborador'],
  ['/admin/funcionarios', 'colaboradores'],
  ['/admin/relatorios', 'relatorios-e-espelho'],
  ['/admin/documentos/gerar', 'documentos-e-rh'],
  ['/admin/documentos/regimento', 'regimento-interno'],
  ['/admin/documentos/cultura', 'manual-de-cultura'],
  ['/admin/documentos/entrevista', 'guia-de-entrevista'],
  ['/admin/documentos/ciencia', 'termos-de-ciencia'],
  ['/admin/documentos/disciplina', 'medidas-disciplinares'],
  ['/admin/documentos/avaliacao', 'avaliacao-de-desempenho'],
  ['/admin/documentos', 'documentos-emitidos'],
  ['/admin/empresa', 'minha-empresa'],
  ['/admin/cargos', 'cargos-e-funcoes'],
  ['/admin/administradores', 'administradores'],
  ['/admin/configuracoes', 'jornadas-e-calendario'],
  ['/admin/notificacoes', 'alertas-no-whatsapp'],
  ['/admin/auditoria', 'trilha-de-auditoria'],
  ['/admin/aplicativo', 'aplicativo-desktop'],
  ['/admin', 'inicio-e-metas'],
  ['/historico', 'meu-historico'],
  ['/', 'bater-ponto'],
];

export function articleSlugForRoute(pathname: string): string | null {
  if (pathname.startsWith(HELP_ADMIN_BASE) || pathname.startsWith(HELP_EMPLOYEE_BASE)) return null;
  let best: readonly [string, string] | null = null;
  for (const entry of HELP_ROUTE_ARTICLES) {
    const [prefix] = entry;
    const matches =
      prefix === '/' ? pathname === '/' : pathname === prefix || pathname.startsWith(prefix);
    if (matches && (best === null || prefix.length > best[0].length)) best = entry;
  }
  return best?.[1] ?? null;
}

/** Help center (or the guide of the current screen) for the "?" button and the F1 key. */
export function helpPathForScreen(base: string, pathname: string): string {
  const slug = articleSlugForRoute(pathname);
  return slug === null ? base : helpArticlePath(base, slug);
}
