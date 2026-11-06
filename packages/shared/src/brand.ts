/**
 * White-label identity of this build.
 *
 * Every customer branch (clientes/<nome>) changes only this file and the images in
 * `packages/shared/brand/` (logo.png, icon.png). Everything else — screens, PDFs, the desktop
 * installer, the help center — reads from here or from the company data saved in the system
 * (Minha Empresa), so the shared core never mentions a specific customer.
 * See docs/clientes.md.
 */
export interface BrandIdentity {
  /** Product name shown on screens, the desktop app and its installer. */
  productName: string;
  /** Company name used before the company profile is filled in (Minha Empresa). */
  companyName: string;
  /** Legal name fallback for documents, before the company profile is filled in. */
  companyLegalName: string;
  /** Place shown next to the official clock ("Horário de Brasília", "Fortaleza"). */
  clockLabel: string;
  /** City used on documents when the company address has no city. */
  defaultCity: string;
  /** Short line under the login form. */
  loginFooter: string;
  /** Desktop app: unique id, file names, and the GitHub repository with its releases. */
  desktop: {
    appId: string;
    executableName: string;
    artifactPrefix: string;
    releasesOwner: string;
    releasesRepo: string;
    maintainer: string;
  };
}

export const BRAND: BrandIdentity = {
  productName: 'PontoPro',
  companyName: 'Sua Empresa',
  companyLegalName: 'Sua Empresa LTDA',
  clockLabel: 'Brasília',
  defaultCity: '',
  loginFooter: 'Controle de ponto e RH',
  desktop: {
    appId: 'com.yacacode.pontopro',
    executableName: 'pontopro',
    artifactPrefix: 'PontoPro',
    releasesOwner: 'Nycolazs',
    releasesRepo: 'PH-Motopecas-Ponto',
    maintainer: 'PontoPro <suporte@yacacode.com>',
  },
};
